"""Which printed supplier and recipient names are the same supplier.

Every source prints names its own way: "Microsoft Canada Inc." in one report, "Microsoft
Canada" in the next, "X|X" (English and French) in the federal grants file. build.py calls
match() once every record is loaded, and each record's supplier_key becomes its group's key.

A name is first reduced to its name key (common.entity_key: case, accents, apostrophes,
punctuation and legal suffixes set aside). Name keys are then joined only on evidence:

  bilingual        one record prints the name in English and in French
  business number  federal grant records share a valid business number, and the names
                   are close (a typo apart, or one name inside the other)
  postal code      federal records share a postal code, and the names are a typo apart
  reviewed         a decision in supplier_rules.csv, with its reason

Close names with no such evidence are not joined; they are listed as near matches for review.
supplier_rules.csv also holds "apart" decisions that stop two names from ever joining.

Writes docs/supplier-matching.md (method, counts, largest merges, near matches not joined),
docs/supplier-merges.csv (every name folded into another) and docs/supplier-near-matches.csv.
"""
import csv
import re
from collections import Counter, defaultdict
from datetime import date

from common import ROOT, entity_key

RULES = ROOT / "pipeline" / "supplier_rules.csv"
DOCS = ROOT / "docs"
# Records that repeat money counted elsewhere (payments and notices); shown, not totalled.
OVERLAP = {"pa_pss", "pa_tp", "canadabuys"}


def valid_bn(bn: str | None) -> str | None:
    """A Canada Revenue Agency business number, or None.

    Some departments fill the field with their own placeholders (000000000, 1000xxxxx); a real
    business number's 9-digit root passes the Luhn check digit. Where the full account is
    printed (107833394RR0083), the whole account is the key: one umbrella body can hold a
    separate charity account for each congregation or branch under one root.
    """
    full = re.sub(r"[^0-9A-Z]", "", (bn or "").upper())
    d = full[:9]
    if len(d) != 9 or not d.isdigit() or len(set(d)) == 1 or d.startswith("1000"):
        return None
    total = 0
    for i, c in enumerate(reversed(d)):
        n = int(c) * (2 if i % 2 else 1)
        total += n - 9 if n > 9 else n
    if total % 10:
        return None
    return full if re.fullmatch(r"\d{9}[A-Z]{2}\d{4}", full) else d


def postal(pc: str | None) -> str | None:
    p = re.sub(r"[^A-Z0-9]", "", (pc or "").upper())
    return p if re.fullmatch(r"[A-Z]\d[A-Z]\d[A-Z]\d", p) else None


def compact(key: str) -> str:
    """The name's letters without spaces or "of": "R J G" is "RJG", "Commissionaires of Nfld"
    is "Commissionaires Nfld"."""
    return re.sub(r"\bof\b|\s", "", key)


def digits(key: str) -> list[str]:
    return re.findall(r"\d+", key)


def edits(a: str, b: str, limit: int = 2) -> int:
    """Damerau-Levenshtein distance, stopping early once past limit."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev2, prev = None, list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cost = a[i - 1] != b[j - 1]
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            if prev2 is not None and i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                cur[j] = min(cur[j], prev2[j - 2] + 1)
        if min(cur) > limit:
            return limit + 1
        prev2, prev = prev, cur
    return prev[-1]


def typo_apart(a: str, b: str) -> bool:
    """Names a spelling slip apart: same numbers, the same initials and short words ("H & S"
    and "J & W" are different firms), at most 2 edits (1 below 12 letters)."""
    if digits(a) != digits(b) or [t for t in a.split() if len(t) <= 2] != [t for t in b.split() if len(t) <= 2]:
        return False
    ca, cb = compact(a), compact(b)
    if ca == cb:
        return True
    n = min(len(ca), len(cb))
    return n >= 8 and edits(ca, cb) <= (2 if n >= 12 else 1)


# Some grant records put an operating name or a sub-group after the bar instead of the French
# name ("Cow Head Tourism Committee|Friends of Garden"); a French half has French words.
FRENCH = {"de", "du", "des", "la", "le", "les", "et", "pour", "ville", "gouvernement", "premiere", "universite", "college",
          "societe", "ministere", "conseil", "federation", "reseau", "administration", "portuaire", "autorite"}
PLACEHOLDER = {"n a", "na", "none", "null", "not applicable", "sans objet", "s o", "unknown", "inconnu"}
# The province's name alone never identifies a body.
PLACE = {"newfoundland", "labrador", "and", "of", "the", "nl", "terre", "neuve", "et", "du", "de", "la"}
# Words that name a part of a larger body.
UNIT = {"department", "dept", "ministere", "faculty", "school", "campus", "institute", "division", "branch", "secretariat"}
# Words a company adds to its name without becoming another company.
KIND = {"solutions", "systems", "technologies", "technology", "enterprises", "holdings", "industries", "union",
        "incorporated", "society", "association", "services", "group", "organization"}
# Words that say what kind of body a name is, or where, but not which one.
GENERIC = set("""newfoundland labrador nl and of the for de du la le les et des st saint johns canada canadian
    government gouvernement province provincial department ministere town ville city cite municipality council
    association society centre center club inc first nation nations band community group services service
    foundation fondation board committee regional region north south east west western eastern northern southern
    central atlantic international national""".split())


def contained(a: str, b: str) -> bool:
    """One name's words all appear in the other, and the shorter name has a word of its own
    ("NunatuKavut" in "NunatuKavut Community Council"; not "Newfoundland and Labrador" in
    every name that starts with it)."""
    ta, tb = a.split(), b.split()
    small, big = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    if digits(a) != digits(b) or not set(small) <= set(big):
        return False
    # The longer name may only add words that say what kind of body it is: "Clarenville
    # Pentecostal Tabernacle" names one congregation, not "Pentecostal Tabernacle".
    extra = set(big) - set(small)
    return any(len(t) >= 4 and t not in GENERIC for t in small) and extra <= GENERIC | KIND


def unit_of(a: str, b: str) -> bool:
    """One name is a department, faculty or campus printed after the other, the body it
    belongs to: "Government of Newfoundland and Labrador - Department of Education"."""
    small, big = (a, b) if len(a) <= len(b) else (b, a)
    words = small.split()
    if not big.startswith(small + " ") or digits(a) != digits(b) or len(words) < 2 or set(words) <= PLACE:
        return False
    # The body's own name must say which body: a word of its own ("Memorial University"),
    # or the province's full name ("Government of Newfoundland and Labrador"); not "Town of".
    named = any(len(t) >= 4 and t not in GENERIC for t in words) or sum(t in PLACE for t in words) >= 3
    return named and any(t in UNIT for t in big[len(small):].split())


class Groups:
    def __init__(self, keys, apart):
        self.parent = {k: k for k in keys}
        self.members = {k: {k} for k in keys}
        self.apart = apart
        self.edges = []  # (a, b, evidence, detail) that joined two groups
        self.blocked = []

    def find(self, k):
        while self.parent[k] != k:
            self.parent[k] = self.parent[self.parent[k]]
            k = self.parent[k]
        return k

    def union(self, a, b, evidence, detail=""):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        for x, y, _ in self.apart:
            if (x in self.members[ra] and y in self.members[rb]) or (y in self.members[ra] and x in self.members[rb]):
                self.blocked.append((a, b, evidence, f"kept apart by a reviewed decision ({x} / {y})"))
                return
        if len(self.members[ra]) < len(self.members[rb]):
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.members[ra] |= self.members.pop(rb)
        self.edges.append((a, b, evidence, detail))


def load_rules():
    merges, apart = [], []
    if RULES.exists():
        for r in csv.DictReader(open(RULES, newline="")):
            a, b = entity_key(r["name"]), entity_key(r["same_as"])
            if not a or not b or a == b:
                continue
            (merges if r["decision"] == "merge" else apart).append((a, b, r["reason"]))
    return merges, apart


def match(records: list[dict]) -> dict:
    """records: dicts with name (as printed), forms (from common.name_forms), dataset, amount,
    and optional bn, postal, ref. Returns {name key: group key} plus the report data."""
    stats = defaultdict(lambda: {"n": 0, "value": 0.0, "shown": 0.0, "printed": Counter(), "ds": Counter()})
    by_bn, by_pc = defaultdict(set), defaultdict(set)
    bns = defaultdict(set)  # name key -> valid business numbers printed with it
    accounts = defaultdict(set)  # (name key, 9-digit root) -> full accounts printed with it
    awards = defaultdict(lambda: defaultdict(set))  # (date, amount) -> dataset -> name keys
    bilingual = []
    for r in records:
        keys = [entity_key(f) for f in r["forms"]]
        k = keys[0]
        s = stats[k]
        s["n"] += 1
        a = r.get("amount") or 0
        s["shown"] += a
        if r["dataset"] not in OVERLAP:
            s["value"] += a
        s["printed"][r["forms"][0]] += 1
        s["ds"][r["dataset"]] += 1
        for other in keys[1:]:
            stats[other]  # the other language's name is a key of its own
            bilingual.append((k, other, r.get("ref", "")))
        if bn := valid_bn(r.get("bn")):
            by_bn[bn[:9]].add(k)
            bns[k].add(bn[:9])
            if len(bn) > 9:
                accounts[(k, bn[:9])].add(bn)
        if pc := postal(r.get("postal")):
            by_pc[pc].add(k)
        if r["dataset"] in ("fed_contract", "canadabuys") and r.get("date") and a:
            awards[(r["date"], round(a, 2))][r["dataset"]].add(k)

    merges, apart = load_rules()
    g = Groups(list(stats), apart)
    by_compact = defaultdict(list)
    for k in stats:
        by_compact[compact(k)].append(k)
    for ks in by_compact.values():
        for other in ks[1:]:
            g.union(ks[0], other, "same name", "the same words, spaced differently or without \"of\"")
    # A French half joins only when it names one English name, reads as French, and is a real name (not "N/A").
    firsts = defaultdict(set)
    for a, b, _ in bilingual:
        firsts[b].add(a)
    for a, b, ref in bilingual:
        if len(firsts[b]) == 1 and len(b) >= 6 and b not in PLACEHOLDER and set(b.split()) & FRENCH:
            g.union(a, b, "bilingual", f"one record prints both ({ref})" if ref else "one record prints both")

    rejected = []
    for evidence, index, close in (("business number", by_bn, lambda a, b: typo_apart(a, b) or contained(a, b)),
                                   ("postal code", by_pc, typo_apart)):
        for code, keys in index.items():
            keys = sorted(keys)
            for i, a in enumerate(keys):
                for b in keys[i + 1:]:
                    if evidence == "business number":
                        # One umbrella body holds a charity account per congregation or branch.
                        conflict = accounts[(a, code)] and accounts[(b, code)] and not accounts[(a, code)] & accounts[(b, code)]
                    else:
                        conflict = bns[a] and bns[b] and not bns[a] & bns[b]
                    if close(a, b) and conflict:
                        rejected.append((a, b, "same business number, different accounts under it" if evidence == "business number"
                                            else "same postal code, different business numbers"))
                    elif close(a, b):
                        g.union(a, b, evidence, "federal records share one" if evidence == "postal code" else "federal grant records share one")
                    elif evidence == "business number":
                        rejected.append((a, b, "same business number, different names (a parent body's number, or an owner's)"))
    # The same federal award in both the contracts disclosure and a CanadaBuys notice: same
    # award date, same value to the cent.
    for (d, amt), per in awards.items():
        for a in per.get("fed_contract", ()):
            for b in per.get("canadabuys", ()):
                if a != b and (typo_apart(a, b) or contained(a, b)):
                    g.union(a, b, "same award", f"a federal contract and a CanadaBuys notice of {d}, ${amt:,.2f}")
    units = defaultdict(list)
    for k in stats:
        units[k.split(" ")[0]].append(k)
    for ks in units.values():
        if len(ks) > 1:
            for a in ks:
                for b in ks:
                    if len(a) < len(b) and unit_of(a, b):
                        g.union(a, b, "unit", "a department, faculty or campus printed after the body's own name")
    for a, b, reason in merges:
        if a in g.parent and b in g.parent:
            g.union(a, b, "reviewed", reason)
    for a, b, _ in merges + apart:
        for k in (a, b):
            if k not in g.parent:
                print(f"suppliers: supplier_rules.csv names {k!r}, which no record prints any more")

    # Near matches left apart: a spelling slip or one name inside the other, no evidence.
    blocks = defaultdict(set)
    for k in stats:
        c = compact(k)
        if len(c) >= 8:
            blocks["^" + c[:5]].add(k)
            blocks["$" + c[-5:]].add(k)
    seen = set()
    for keys in blocks.values():
        if len(keys) > 400:
            continue
        keys = sorted(keys)
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                if (a, b) in seen or g.find(a) == g.find(b):
                    continue
                seen.add((a, b))
                if typo_apart(a, b):
                    rejected.append((a, b, "a spelling slip apart, with no business number, postal code or review to confirm it"))
                elif contained(a, b) and min(stats[a]["shown"], stats[b]["shown"]) >= 50000:
                    rejected.append((a, b, "one name inside the other (often a parent and its subsidiary or branch)"))
    rejected = [(a, b, why) for a, b, why in dict(((a, b), (a, b, w)) for a, b, w in rejected).values()
                if g.find(a) != g.find(b)]

    # Group key: the name key with the most records (then the most money), so a supplier's
    # link follows its usual name.
    groups = defaultdict(list)
    for k in stats:
        groups[g.find(k)].append(k)
    key_of = {}
    for members in groups.values():
        root = max(members, key=lambda k: (stats[k]["n"], stats[k]["shown"], k))
        for k in members:
            key_of[k] = root
    return {"key_of": key_of, "stats": stats, "edges": g.edges, "blocked": g.blocked, "rejected": rejected, "groups": groups}


def shown(stats, k):
    return stats[k]["printed"].most_common(1)[0][0] if stats[k]["printed"] else k


def other_printings(stats, k):
    return "; ".join(p for p, _ in stats[k]["printed"].most_common() if p != shown(stats, k))


def money(v):
    return f"${v:,.0f}"


def write_report(m: dict) -> dict:
    stats, key_of, groups = m["stats"], m["key_of"], m["groups"]
    how = {}
    for a, b, ev, detail in m["edges"]:
        how.setdefault(b, (a, ev, detail))
        how.setdefault(a, (b, ev, detail))
    multi = {key_of[ms[0]]: ms for ms in groups.values() if len(ms) > 1}

    DOCS.mkdir(exist_ok=True)
    rows = []
    for root, ms in sorted(multi.items(), key=lambda x: -sum(stats[k]["value"] for k in x[1])):
        for k in sorted(ms, key=lambda k: -stats[k]["n"]):
            if k == root:
                continue
            via, ev, detail = how.get(k, (root, "", ""))
            rows.append({"supplier": shown(stats, root), "supplier_key": root, "name_merged": shown(stats, k), "name_key": k,
                         "records": stats[k]["n"], "value": round(stats[k]["value"], 2), "evidence": ev,
                         "joined_to": shown(stats, via), "detail": detail, "also_printed": other_printings(stats, k)})
    # A supplier's main name, and any name printed more than one way, lists its other printings:
    # those were joined by the same-name rule alone.
    printings = [{"supplier": shown(stats, key_of[k]), "supplier_key": key_of[k], "name_merged": shown(stats, k), "name_key": k,
                  "records": stats[k]["n"], "value": round(stats[k]["value"], 2), "evidence": "same name (printings)",
                  "joined_to": "", "detail": "printed differently: case, punctuation, apostrophes, spacing or legal suffix",
                  "also_printed": other_printings(stats, k)}
                 for k in sorted(stats, key=lambda k: -stats[k]["value"]) if key_of[k] == k and len(stats[k]["printed"]) > 1]
    with open(DOCS / "supplier-merges.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]) if rows else ["supplier"])
        w.writeheader()
        w.writerows(rows + printings)

    near = sorted(m["rejected"], key=lambda x: -min(stats[x[0]]["shown"], stats[x[1]]["shown"]))
    with open(DOCS / "supplier-near-matches.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "records", "value", "other_name", "other_records", "other_value", "why_not_joined"])
        for a, b, why in near:
            w.writerow([shown(stats, a), stats[a]["n"], round(stats[a]["shown"], 2), shown(stats, b), stats[b]["n"],
                        round(stats[b]["shown"], 2), why])

    ev_count = Counter(r["evidence"] for r in rows)
    names_before = len(stats)
    out = ["# Supplier matching", "",
           f"Generated {date.today().isoformat()} by `pipeline/suppliers.py`. A supplier page groups every record whose printed "
           "name is the same supplier. This page says how names are joined, how many were joined, and which close names were "
           "left apart. To question a merge or ask for one, open the **Challenge a method** issue form; a decision goes into "
           "`pipeline/supplier_rules.csv` with its reason.", "",
           "## Method", "",
           "- **Same name.** Case, accents, apostrophes, punctuation and legal suffixes (Inc., Ltd., Limited, Corp., Ltée) are "
           "set aside, \"NL\" and \"Nfld\" are written out, and anything after \"o/a\", \"c/o\" or \"formerly\" is dropped: "
           "the record belongs to the legal name before it.",
           "- **Bilingual.** Federal grant records print the recipient as \"English name|French name\"; both halves are the "
           "same recipient.",
           "- **Business number.** Federal grant records with the same valid business number (Luhn check digit; department "
           "placeholders such as 000000000 and 1000xxxxx are ignored; the full account where printed, since an umbrella body "
           "holds a charity account per branch) are joined when the names are a spelling slip apart, or one name is inside "
           "the other and adds only words such as Inc., Association or Council.",
           "- **Postal code.** Federal records with the same postal code are joined when the names are a spelling slip apart "
           "(initials must match) and no different business numbers are printed with them.",
           "- **Same award.** A federal contract and a CanadaBuys notice with the same award date and value to the cent.",
           "- **Department or campus.** A department, faculty or campus printed after its body's name.",
           "- **Reviewed.** Decisions in `pipeline/supplier_rules.csv`, each with its reason: merges the evidence above cannot "
           "make (a typo in a provincial report, which prints no business number), and pairs kept apart.",
           "- **Never joined:** operating names (\"Cavendish Hotel LP o/a Sheraton\" is not joined to other Sheraton records: "
           "franchise names are shared by different owners), a company and its limited partnership, a parent and its "
           "subsidiary unless a reviewed decision says why, and close names with no evidence.",
           "- Totals: a supplier's headline total counts contract awards, grant agreements and payments once. Public Accounts "
           "payment lines and CanadaBuys notices repeat money already counted and stay out of it, whichever name they were "
           "printed under.", "",
           "## Counts", "",
           f"- Name keys (names after the same-name step): {names_before:,}.",
           f"- Suppliers after joining: {len(groups):,}.",
           f"- Name keys folded into another: {len(rows):,} ({', '.join(f'{v:,} {k}' for k, v in ev_count.most_common())}).",
           f"- Names printed more than one way (same name once spelling is set aside): {len(printings):,}, listed in "
           "`docs/supplier-merges.csv` with their other printings.",
           f"- Close names left apart: {len(near):,} (`docs/supplier-near-matches.csv`).",
           f"- Joins stopped by a reviewed \"apart\" decision: {len(m['blocked'])}.",
           "", "## Largest merges by value", "",
           "| Supplier | Names joined | Records | Value | Evidence |", "|---|---|---:|---:|---|"]
    for root, ms in sorted(multi.items(), key=lambda x: -sum(stats[k]["value"] for k in x[1]))[:25]:
        others = sorted((k for k in ms if k != root), key=lambda k: -stats[k]["n"])
        evs = sorted({how.get(k, ("", "", ""))[1] for k in others})
        names = "; ".join(shown(stats, k) for k in others[:4]) + (f"; and {len(others) - 4} more" if len(others) > 4 else "")
        out.append(f"| {shown(stats, root)} | {names} | {sum(stats[k]['n'] for k in ms):,} | "
                   f"{money(sum(stats[k]['value'] for k in ms))} | {', '.join(evs)} |")
    out += ["", "## Close names left apart (largest 30)", "",
            "| Name | Other name | Why not joined |", "|---|---|---|"]
    for a, b, why in near[:30]:
        out.append(f"| {shown(stats, a)} ({money(stats[a]['shown'])}) | {shown(stats, b)} ({money(stats[b]['shown'])}) | {why} |")
    out += ["", "Every merge, with its evidence: `docs/supplier-merges.csv`.", ""]
    (DOCS / "supplier-matching.md").write_text("\n".join(out))
    summary = {"name_keys": names_before, "suppliers": len(groups), "folded": len(rows), "near": len(near),
               "by_evidence": dict(ev_count)}
    print("suppliers:", summary)
    # For the site's method page: the largest merges and the largest close names left apart.
    summary["largest"] = [{"name": shown(stats, root), "key": root, "names": len(ms), "records": sum(stats[k]["n"] for k in ms),
                           "value": round(sum(stats[k]["value"] for k in ms), 2)}
                          for root, ms in sorted(multi.items(), key=lambda x: -sum(stats[k]["value"] for k in x[1]))[:15]]
    summary["near_sample"] = [{"a": shown(stats, a), "b": shown(stats, b), "why": why} for a, b, why in near[:12]]
    return summary

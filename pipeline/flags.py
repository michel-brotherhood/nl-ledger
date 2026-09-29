"""Patterns people read as waste or perks, computed from the published data.

A flag is a question, not a finding. Every flag here has a method page on the site
generated from CATALOG below; the text there and the computation here stay together
so they cannot drift apart.

Writes table `flags` (one row per flagged item or subject) and `flag_summary` into
data/build/ledger.db, and data/build/flag_catalog.json for the site.
"""
import json
import re
import sqlite3
from collections import defaultdict
from datetime import date

from build import DB
from common import BUILD

OCP = ("The Open Contracting Partnership's guide to red flags puts it this way: a red flag is not evidence "
       "that anything wrong happened. It points at something that may be worth a closer look.")

CATALOG = [
    {
        "id": "no-competition",
        "title": "Awarded without competition",
        "short": "Contracts given to one supplier without an open call for bids.",
        "why": "Open competition is the default way public bodies buy. Awards made without one are allowed for specific "
               "reasons, and people often want to know how much money goes out that way and to whom.",
        "how": [
            "Provincial: every award in the Public Procurement Agency reports that cites an exception clause in section 6 of "
            "the Public Procurement Act: only one source reasonably available (6(a)(v)), emergency or urgency (6(a)(iv)), "
            "pre-qualified supplier (6(a)(vi)), purchase for resale (6(a)(vii)), security (6(a)(ii)) or rates set by the regulator (6(b)).",
            "Federal: contracts the department coded as non-competitive (solicitation procedure \"TN\").",
            "Each public body's share is its exception awards divided by all its awards in the same reports.",
        ],
        "data": ["ppa", "fed_contract"],
        "limits": "The provincial reports list limited calls, exceptions and emergency awards, but open-call awards by "
                  "government departments are posted on MERX and are not in these reports, so a department's share here is "
                  "of the awards the reports cover, not of everything it bought.",
    },
    {
        "id": "emergency",
        "title": "Emergency awards",
        "short": "Contracts awarded under the emergency or urgency exception.",
        "why": "Emergency buying skips competition by design. How often a body uses it, and for what, is a common question.",
        "how": ["Provincial awards citing clause 6(a)(iv), emergency or situation of urgency."],
        "data": ["ppa"],
        "limits": "The reports give a short description, not the nature of the emergency.",
    },
    {
        "id": "repeat-sole-source",
        "title": "Same supplier, sole-sourced again and again",
        "short": "A public body gave the same supplier three or more sole-source awards.",
        "why": "One sole-source award can be the only sensible choice. A long run of them to the same company is the "
               "pattern auditors ask about, because it can mean a supplier never faces competition.",
        "how": ["Provincial awards citing the only-one-source clause, 6(a)(v).",
                "Grouped by public body and supplier (supplier names normalised for spelling and legal suffixes).",
                "Flagged when a pair has three or more such awards across the reports from 2021 on."],
        "data": ["ppa"],
        "limits": "Software licences, maintenance of installed equipment and parts for existing machines are often "
                  "genuinely single-source. The flag cannot tell those from anything else.",
    },
    {
        "id": "contract-growth",
        "title": "Contracts that grew well past their award",
        "short": "Federal contracts whose final value is at least double the original, and at least $25,000 more.",
        "why": "A contract that doubles after it is signed spends money that was never competed for at that size.",
        "how": ["Federal contracts over $10,000: final contract value compared with the original value the department reported.",
                "Flagged when the final value is at least twice the original and the increase is at least $25,000.",
                "Uses the latest version of each contract, so amendments are counted once."],
        "data": ["fed_contract"],
        "limits": "Planned option years are sometimes reported as amendments. The provincial reports do not publish change "
                  "orders at all, so this flag covers federal contracts only.",
    },
    {
        "id": "just-under-limit",
        "title": "Priced just under a limit",
        "short": "Amounts within 5% below an open-call limit.",
        "why": "When far more purchases land just below a limit than just above it, people ask whether work is being sized "
               "to stay under it.",
        "how": ["Limits used: the open-call thresholds in section 5 of the Public Procurement Regulations, which depend on the "
                "kind of public body. Departments and agencies: $34,700 goods, $139,000 services and public works. Towns, cities, "
                "health authorities, school boards, Memorial University and the College of the North Atlantic: $139,000 goods and "
                "services, $347,400 public works. Crown corporations such as NL Hydro: $264,200. Leases of space: $100,000 for all. "
                "Federal: the $25,000 limit below which the Government Contracts Regulations let a contract be awarded without bids.",
                "Each award or payment priced from 95% of a limit up to one cent below it is flagged.",
                "Each source also gets a count of amounts just below each limit against amounts just above it."],
        "data": ["ppa", "fed_contract", "paradise"],
        "limits": "A payment is not a purchase: one purchase can be paid in parts, and one payment can cover several purchases. "
                  "Round budgets ($9,500, $49,000) land under limits for ordinary reasons.",
    },
    {
        "id": "split-invoices",
        "title": "Invoices that add up past a limit",
        "short": "Two or more invoices from one supplier for the same thing, each under a limit, together over it.",
        "why": "Splitting one purchase into several smaller ones to stay under a limit is the classic way around a tender rule.",
        "how": ["Town of Paradise: invoices from the same vendor, paid on the same date, with the same description "
                "(ignoring numbers and punctuation), each under the town's $139,000 open-call threshold for goods and services "
                "and together over it.",
                "Federal contracts: two or more contracts from the same department to the same vendor within 7 days, with "
                "the same description, each under $25,000 and together $25,000 or more. Call-ups against a standing offer are left out, "
                "since a standing offer is meant to be drawn on many times, and so are vendors printed as a person's name."],
        "data": ["paradise", "fed_contract"],
        "limits": "Monthly bills, separate jobs and separate sites are often paid on the same day. The register does not say "
                  "whether invoices were for one piece of work.",
    },
    {
        "id": "year-end",
        "title": "Year-end spending rush",
        "short": "Awards and payments bunched in the last month of the fiscal year.",
        "why": "Unspent budgets lapse at year end. Research on United States federal contracts found spending in the last "
               "week of the year ran several times the weekly average, and year-end projects were rated lower quality.",
        "how": ["Provincial and federal fiscal years end on 31 March; Paradise's year ends on 31 December.",
                "For each public body with at least 20 dated awards or payments, the last month's share of dollars is "
                "compared with an even share (one twelfth).",
                "Flagged when the last month holds at least three times an even share."],
        "data": ["ppa", "fed_contract", "paradise"],
        "limits": "Some work is seasonal. Award dates are as printed, and a few printed dates are plainly wrong (see the date check).",
    },
    {
        "id": "dominant-supplier",
        "title": "One supplier takes most of a body's awards",
        "short": "A single supplier received half or more of a public body's awarded dollars.",
        "why": "When one company gets most of a body's business, the body depends on it and prices face less pressure.",
        "how": ["Provincial awards from 2021 on, grouped by public body.",
                "Flagged when one supplier holds at least 50% of the body's awarded dollars, the body awarded at least "
                "$250,000 in total, and at least three awards are involved."],
        "data": ["ppa"],
        "limits": "Small bodies with one big contract will show up here for ordinary reasons.",
    },
    {
        "id": "late-publication",
        "title": "Published long after the award",
        "short": "Awards that appear in a report more than 90 days after the award date.",
        "why": "Sections 31 and 32 of the Public Procurement Regulations set a 15-day window for reporting an award to the "
               "Chief Procurement Officer and another 15 days for publishing it. How long awards actually take to appear is a "
               "measure of how current the public record is.",
        "how": ["Days from the printed award date to the end of the reporting period of the report it appears in.",
                "Flagged at more than 90 days."],
        "data": ["ppa"],
        "limits": "Some printed dates are typing errors, which look like very late or future awards. Those are listed under the date check instead.",
    },
    {
        "id": "date-check",
        "title": "Dates that cannot be right",
        "short": "Award dates printed years before or after the report they appear in.",
        "why": "A transparency record is only as good as its dates. This is a publishing error, not a spending pattern.",
        "how": ["Provincial awards whose printed award date is after the report's period, or more than three years before it."],
        "data": ["ppa"],
        "limits": "Shown as published; the site does not correct dates.",
    },
    {
        "id": "possible-duplicate",
        "title": "Possible duplicate payments",
        "short": "The same invoice from the same vendor, for the same amount, paid more than once.",
        "why": "Duplicate payments are the most common error auditors find in payment registers.",
        "how": ["Town of Paradise: vendor, invoice number and amount all match on two or more lines with different "
                "payment numbers."],
        "data": ["paradise"],
        "limits": "Recurring charges sometimes reuse an invoice number, and a reversed and reissued payment looks the same. "
                  "The register does not show refunds or reversals.",
    },
    {
        "id": "over-allowance",
        "title": "MHA allowances used past their limit",
        "short": "Members whose spending in an allowance category passed its published limit for the year.",
        "why": "Since the Auditor General's 2006 review of constituency allowances, the House of Assembly publishes each "
               "member's limit and spending. Spending past a limit is the first thing people check.",
        "how": ["House of Assembly annual summary reports: each category with a published limit.",
                "Flagged when spending is more than the limit by more than one dollar."],
        "data": ["mha"],
        "limits": "Some allowances can be topped up or carried over under the Members' rules, which the report does not show.",
    },
    {
        "id": "overtime-over-base",
        "title": "Overtime bigger than salary",
        "short": "Jobs where people on the compensation list earned more in overtime than in base salary, counted by employer and job title.",
        "why": "Very high overtime can mean a unit is short-staffed, or that overtime is not managed. It is one of the most-read "
               "parts of any sunshine list.",
        "how": ["Compensation disclosure lists, 2022 to 2025: people whose overtime was greater than their base salary.",
                "Shown as counts by employer, job title and year. Names are on the government's lists; this page does not repeat them."],
        "data": ["sunshine"],
        "limits": "The list only includes people paid over $100,000, rounded to $100 by the publisher.",
    },
    {
        "id": "severance",
        "title": "Severance payments",
        "short": "Severance paid to people on the compensation list, counted by employer and job title.",
        "why": "Severance and retirement payouts are a common question about public-sector pay.",
        "how": ["Compensation disclosure lists, 2022 to 2025: any severance amount above zero.",
                "Shown as counts and totals by employer, job title and year, without names."],
        "data": ["sunshine"],
        "limits": "Severance in these lists includes negotiated retirement payouts as well as terminations.",
    },
    {
        "id": "vague-description",
        "title": "Descriptions that say almost nothing",
        "short": "Awards described in one or two generic words.",
        "why": "A contract record that does not say what was bought cannot be checked by anyone outside.",
        "how": ["Provincial awards whose description is two words or fewer, or is a generic word such as "
                "\"services\", \"goods\", \"supplies\" or \"consulting\"."],
        "data": ["ppa"],
        "limits": "This grades the record, not the purchase.",
    },
]

# Open-call thresholds, Public Procurement Regulations (NLR 13/18) section 5, by type of public body.
LIMITS_BY_TYPE = {
    "department": [(34_700, "goods"), (100_000, "leases of space"), (139_000, "services and public works")],
    "local": [(100_000, "leases of space"), (139_000, "goods and services"), (347_400, "public works")],
    "crown": [(100_000, "leases of space"), (264_200, "goods, services and public works")],
}
CROWN = re.compile(r"hydro|nalcor|liquor|oil and gas|housing corporation|marble mountain|film development|workplacenl|workplace health|bull arm|labrador island link|research and development|c\.a\. pippy|the rooms|arts council|municipal assessment|tourism board", re.I)
LOCAL = re.compile(r"^(city|town) of|health services|health authorit|regional health|eastern health|central health|western health|labrador-grenfell|centre for health information|school district|conseil scolaire|memorial university|college of the north atlantic", re.I)


def body_type(name: str) -> str:
    if LOCAL.search(name or ""):
        return "local"
    if CROWN.search(name or ""):
        return "crown"
    return "department"


def looks_like_person(name: str) -> bool:
    """A vendor printed as a person's name (two or three words, no business words)."""
    n = (name or "").strip()
    if not n or re.search(r"\d|&|\b(inc|ltd|limited|corp|co|company|llp|lp|ulc|services|group|consult|engineer|associates|solutions|systems|society|association|centre|center|canada|construction|contracting|enterprises|technolog|industr|holdings|partners|agency|marine|electric|university|college|government|club|church|foundation|trust|bank|clinic|pharmacy|law|legal)", n, re.I):
        return False
    return 2 <= len(n.replace(",", " ").split()) <= 3
LIMIT_FED = 25_000
GENERIC = {"services", "service", "goods", "supplies", "consulting", "consulting services", "professional services",
           "equipment", "materials", "various", "misc", "miscellaneous", "parts", "repairs", "maintenance", "software"}


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.executescript("""
        DROP TABLE IF EXISTS flags; DROP TABLE IF EXISTS flag_summary;
        CREATE TABLE flags (flag TEXT, item_id TEXT, subject_type TEXT, subject TEXT, subject_key TEXT, value REAL, detail TEXT);
        CREATE INDEX flags_flag ON flags(flag); CREATE INDEX flags_item ON flags(item_id);
        CREATE TABLE flag_summary (flag TEXT PRIMARY KEY, items INTEGER, subjects INTEGER, amount REAL, detail TEXT);
    """)
    out = []

    def flag(fid, item_id=None, subject_type=None, subject=None, subject_key=None, value=None, **detail):
        out.append((fid, item_id, subject_type, subject, subject_key, value, json.dumps(detail) if detail else None))

    ppa = [dict(r) | {"x": json.loads(r["extra"] or "{}")} for r in con.execute("SELECT * FROM items WHERE dataset='ppa'")]
    fed = [dict(r) | {"x": json.loads(r["extra"] or "{}")} for r in con.execute("SELECT * FROM items WHERE dataset='fed_contract'")]
    par = [dict(r) | {"x": json.loads(r["extra"] or "{}")} for r in con.execute("SELECT * FROM items WHERE dataset='paradise'")]
    extra_detail = {}

    # no-competition and emergency
    exc_methods = {"Sole source", "Emergency", "Pre-qualified supplier", "For resale", "Security", "Rates set by regulator",
                   "Exception (other)", "Exception (clause not given)"}
    by_body = defaultdict(lambda: [0, 0.0, 0, 0.0])
    for r in ppa:
        b = by_body[(r["buyer"], r["buyer_key"])]
        b[0] += 1
        b[1] += r["amount"] or 0
        if r["method"] in exc_methods:
            b[2] += 1
            b[3] += r["amount"] or 0
            flag("no-competition", r["id"], value=r["amount"], method=r["method"])
            if r["method"] == "Emergency":
                flag("emergency", r["id"], value=r["amount"])
    for (name, key), (n, amt, en, eamt) in by_body.items():
        if en:
            flag("no-competition", None, "buyer", name, key, eamt / amt if amt else None,
                 awards=n, amount=amt, exception_awards=en, exception_amount=eamt, source="ppa")
    fb = defaultdict(lambda: [0, 0.0, 0, 0.0])
    for r in fed:
        b = fb[(r["buyer"], r["buyer_key"])]
        b[0] += 1
        b[1] += r["amount"] or 0
        if r["method"] == "Non-competitive":
            b[2] += 1
            b[3] += r["amount"] or 0
            flag("no-competition", r["id"], value=r["amount"], method="Non-competitive (federal)")
    for (name, key), (n, amt, en, eamt) in fb.items():
        if en:
            flag("no-competition", None, "buyer", name, key, eamt / amt if amt else None,
                 awards=n, amount=amt, exception_awards=en, exception_amount=eamt, source="fed_contract")

    # repeat sole source
    pairs = defaultdict(list)
    for r in ppa:
        if r["method"] == "Sole source" and r["supplier_key"]:
            pairs[(r["buyer_key"], r["supplier_key"])].append(r)
    for (bk, sk), rs in pairs.items():
        if len(rs) >= 3:
            tot = sum(x["amount"] or 0 for x in rs)
            flag("repeat-sole-source", None, "pair", f"{rs[0]['buyer']} → {rs[0]['supplier']}", f"{bk}|{sk}", tot,
                 awards=len(rs), buyer=rs[0]["buyer"], supplier=rs[0]["supplier"], buyer_key=bk, supplier_key=sk,
                 first=min(x["date"] for x in rs), last=max(x["date"] for x in rs))
            for x in rs:
                flag("repeat-sole-source", x["id"], value=x["amount"], awards=len(rs))

    # contract growth
    for r in fed:
        orig = r["x"].get("original_value")
        if orig and r["amount"] and orig > 0 and r["amount"] >= 2 * orig and r["amount"] - orig >= 25_000:
            flag("contract-growth", r["id"], value=r["amount"] / orig, original=orig, final=r["amount"])

    # just under a limit (+ distribution counts)
    dist = {}

    def under(rows, limits, source):
        counts = {}
        for lim, label in limits:
            below = above = 0
            for r in rows:
                a = r["amount"]
                if a is None:
                    continue
                if 0.95 * lim <= a < lim:
                    below += 1
                    flag("just-under-limit", r["id"], value=a, limit=lim, limit_label=label)
                elif lim <= a < 1.05 * lim:
                    above += 1
            counts[str(lim)] = {"label": label, "below": below, "above": above}
        dist[source] = counts

    for bt, limits in LIMITS_BY_TYPE.items():
        under([r for r in ppa if body_type(r["buyer"]) == bt], limits, f"ppa ({bt})")
    under(fed, [(LIMIT_FED, "federal contracts without bids")], "fed_contract")
    under(par, LIMITS_BY_TYPE["local"], "paradise")
    extra_detail["just-under-limit"] = dist

    # split invoices
    grp = defaultdict(list)
    for r in par:
        grp[(r["supplier_key"], r["date"], _desc_key(r["description"]))].append(r)
    for (sk, d, _), rs in grp.items():
        if looks_like_person(rs[0]["supplier"]):
            continue
        lim = 139_000  # goods and services open-call threshold for towns, s.5(2)
        small = [x for x in rs if x["amount"] and 0 < x["amount"] < lim]
        if len(small) >= 2 and sum(x["amount"] for x in small) >= lim:
            tot = sum(x["amount"] for x in small)
            flag("split-invoices", None, "group", f"{rs[0]['supplier']}, {d}", f"paradise|{sk}|{d}", tot,
                 source="paradise", supplier=rs[0]["supplier"], supplier_key=sk, date=d, invoices=len(small),
                 buyer="Town of Paradise", items=[x["id"] for x in small])
            for x in small:
                flag("split-invoices", x["id"], value=x["amount"], group_total=tot)
    fg = defaultdict(list)
    for r in fed:
        if r["amount"] and r["amount"] < LIMIT_FED and r["date"] and not looks_like_person(r["supplier"]) \
                and not r["x"].get("standing_offer"):
            fg[(r["buyer_key"], r["supplier_key"], _desc_key(r["description"]))].append(r)
    for (bk, sk, _), rs in fg.items():
        rs.sort(key=lambda x: x["date"])
        i = 0
        while i < len(rs):
            j = i
            d0 = date.fromisoformat(rs[i]["date"])
            while j + 1 < len(rs) and (date.fromisoformat(rs[j + 1]["date"]) - d0).days <= 7:
                j += 1
            cluster = rs[i:j + 1]
            tot = sum(x["amount"] for x in cluster)
            if len(cluster) >= 2 and tot >= LIMIT_FED:
                flag("split-invoices", None, "group", f"{cluster[0]['supplier']}, {cluster[0]['buyer']}, {cluster[0]['date']}",
                     f"fed|{bk}|{sk}|{cluster[0]['date']}", tot, source="fed_contract", supplier=cluster[0]["supplier"],
                     supplier_key=sk, buyer=cluster[0]["buyer"], date=cluster[0]["date"], invoices=len(cluster),
                     items=[x["id"] for x in cluster])
                for x in cluster:
                    flag("split-invoices", x["id"], value=x["amount"], group_total=tot)
            i = j + 1

    # year-end rush
    def yearend(rows, last_month, source, valid):
        by = defaultdict(lambda: [0, 0.0, 0.0, 0])
        for r in rows:
            if not r["date"] or not valid(r) or not r["amount"]:
                continue
            b = by[(r["buyer"], r["buyer_key"])]
            b[0] += 1
            b[1] += r["amount"]
            if int(r["date"][5:7]) == last_month:
                b[2] += r["amount"]
                b[3] += 1
        for (name, key), (n, amt, last, ln) in by.items():
            if n >= 20 and amt > 0:
                ratio = (last / amt) * 12
                if ratio >= 3:
                    flag("year-end", None, "buyer", name, key, ratio, source=source, amount=amt, last_month_amount=last,
                         last_month_items=ln, items=n, last_month=last_month)
        for r in rows:
            if r["date"] and valid(r) and int(r["date"][5:7]) == last_month and (by[(r["buyer"], r["buyer_key"])][2] /
                                                                                   max(by[(r["buyer"], r["buyer_key"])][1], 1)) * 12 >= 3 \
                    and by[(r["buyer"], r["buyer_key"])][0] >= 20:
                flag("year-end", r["id"], value=r["amount"])

    def ppa_ok(r):
        return not r["x"].get("award_date_missing") and not _date_bad(r)

    yearend(ppa, 3, "ppa", ppa_ok)
    yearend(fed, 3, "fed_contract", lambda r: r["date"] >= "2017")
    yearend(par, 12, "paradise", lambda r: True)

    # dominant supplier
    bodies = defaultdict(lambda: defaultdict(lambda: [0, 0.0, ""]))
    for r in ppa:
        if r["amount"] and r["supplier_key"]:
            s = bodies[(r["buyer"], r["buyer_key"])][r["supplier_key"]]
            s[0] += 1
            s[1] += r["amount"]
            s[2] = r["supplier"]
    for (name, key), sups in bodies.items():
        total = sum(v[1] for v in sups.values())
        sk, (n, amt, sname) = max(sups.items(), key=lambda kv: kv[1][1])
        if total >= 250_000 and amt / total >= 0.5 and n >= 3:
            flag("dominant-supplier", None, "buyer", name, key, amt / total, supplier=sname, supplier_key=sk,
                 supplier_amount=amt, awards=n, body_total=total)

    # late publication and date check
    for r in ppa:
        if r["x"].get("award_date_missing"):
            continue
        ps, pe = r["x"]["report_period"].split(" to ")
        if _date_bad(r):
            flag("date-check", r["id"], value=None, printed=r["date"], report_period=r["x"]["report_period"])
            continue
        days = (date.fromisoformat(pe) - date.fromisoformat(r["date"])).days
        if days > 90:
            flag("late-publication", r["id"], value=days, report_period=r["x"]["report_period"])

    # possible duplicates (Paradise)
    dup = defaultdict(list)
    for r in par:
        inv = r["x"].get("invoice", "")
        if inv and inv.upper() not in ("EFT", "N/A") and r["amount"]:
            dup[(r["supplier_key"], inv, r["amount"])].append(r)
    for (sk, inv, amt), rs in dup.items():
        if len({x["x"].get("payment_no") for x in rs}) >= 2:
            flag("possible-duplicate", None, "group", f"{rs[0]['supplier']}, invoice {inv}", f"{sk}|{inv}|{amt}", amt,
                 supplier=rs[0]["supplier"], invoice=inv, times=len(rs), items=[x["id"] for x in rs],
                 dates=sorted(x["date"] for x in rs))
            for x in rs:
                flag("possible-duplicate", x["id"], value=amt, times=len(rs))

    # MHA over allowance: from the summary CSV
    import csv
    from common import CLEAN
    for r in csv.DictReader(open(CLEAN / "mha_summary.csv")):
        lim, spent = r["limit"], r["spent"]
        if lim and spent and float(spent) - float(lim) > 1:
            flag("over-allowance", None, "person", r["member"], r["member"], float(spent) - float(lim),
                 fiscal_year=r["fiscal_year"], category=r["category"], limit=float(lim), spent=float(spent),
                 district=r["district"], source_url=r["source_url"])

    # sunshine: counted by employer and job title, never by person
    agg = defaultdict(lambda: {"ot": [0, 0.0], "sev": [0, 0.0]})
    for r in con.execute("SELECT buyer, description, fiscal_year, extra FROM items WHERE dataset='sunshine'"):
        x = json.loads(r["extra"])
        k = (r["buyer"], r["description"], r["fiscal_year"].replace("calendar ", ""))
        if x.get("overtime") and x["overtime"] > (x.get("base") or 0):
            agg[k]["ot"][0] += 1
            agg[k]["ot"][1] += x["overtime"]
        if x.get("severance") and x["severance"] > 0:
            agg[k]["sev"][0] += 1
            agg[k]["sev"][1] += x["severance"]
    for (emp, title, yr), a in agg.items():
        if a["ot"][0]:
            flag("overtime-over-base", None, "group", f"{emp}: {title}, {yr}", f"{emp}|{title}|{yr}", a["ot"][1],
                 employer=emp, title=title, year=yr, people=a["ot"][0], overtime=a["ot"][1])
        if a["sev"][0]:
            flag("severance", None, "group", f"{emp}: {title}, {yr}", f"{emp}|{title}|{yr}", a["sev"][1],
                 employer=emp, title=title, year=yr, people=a["sev"][0], severance=a["sev"][1])

    # vague descriptions
    for r in ppa:
        d = (r["description"] or "").strip().lower().rstrip(".")
        if not d or d in GENERIC or len(d.split()) <= 2 and not any(ch.isdigit() for ch in d) and len(d) < 18:
            flag("vague-description", r["id"], value=r["amount"], description=r["description"])

    con.executemany("INSERT INTO flags VALUES (?,?,?,?,?,?,?)", out)
    for c in CATALOG:
        fid = c["id"]
        n_items, amt = con.execute("SELECT count(*), sum(i.amount) FROM flags f JOIN items i ON i.id=f.item_id WHERE flag=?",
                                   (fid,)).fetchone()
        n_subj = con.execute("SELECT count(*) FROM flags WHERE flag=? AND item_id IS NULL", (fid,)).fetchone()[0]
        if not n_items:
            amt = con.execute("SELECT sum(value) FROM flags WHERE flag=? AND item_id IS NULL", (fid,)).fetchone()[0] \
                if fid in ("overtime-over-base", "severance", "split-invoices") else None
        con.execute("INSERT INTO flag_summary VALUES (?,?,?,?,?)",
                    (fid, n_items, n_subj, amt, json.dumps(extra_detail.get(fid)) if fid in extra_detail else None))
        print(f"{fid:22} items {n_items:6,d}  subjects {n_subj:5,d}  ${amt or 0:,.0f}")
    con.commit()
    (BUILD / "flag_catalog.json").write_text(json.dumps({"caveat": OCP, "flags": CATALOG}, indent=1))


def _desc_key(d: str | None) -> str:
    """Descriptions compared without numbers, case or punctuation, so "Unit 97 repair" matches "Unit 98 repair"
    but "Sound production" does not match "Stage rental"."""
    import re
    return " ".join(re.sub(r"[^a-z ]+", " ", (d or "").lower()).split())


def _date_bad(r) -> bool:
    ps, pe = r["x"]["report_period"].split(" to ")
    d = r["date"]
    if not d or not ps:
        return False
    return d > pe or (date.fromisoformat(ps) - date.fromisoformat(d)).days > 3 * 365


if __name__ == "__main__":
    main()

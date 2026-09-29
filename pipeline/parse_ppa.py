"""Parse PPA contract-award report PDFs into one clean CSV.

Each PDF has one or more ruled tables. Header wording changed over the years
(2021 split open/limited and exception reports; from August 2021 they are
combined). Columns are mapped by header text, not position.

REVISED issues replace the original for the same fortnight: the original is
dropped and logged in ppa_superseded.csv.
"""
import csv
import re
from collections import Counter, defaultdict
from datetime import date

import pdfplumber

from common import CACHE, CLEAN, load_manifest, money, norm_space

MONTHS = {m: i for i, m in enumerate(
    "jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)}

FIELDS = [
    "public_body", "procurement_type", "clause", "reason", "description", "commodity",
    "supplier", "city", "province", "amount", "contract_no", "award_date", "term", "renewal",
]

HEADER_MAP = [
    ("public_body", ("public body",)),
    ("procurement_type", ("type of procurement", "open call or limited call", "procurement type")),
    ("clause", ("relevant clause", "exception clause", "relevant exception")),
    ("reason", ("reason why",)),
    ("description", ("description",)),
    ("commodity", ("commodity",)),
    ("supplier", ("supplier name", "contractor name", "vendor name")),
    ("city", ("city/town", "(city")),
    ("province", ("province",)),
    ("amount", ("contract price", "contract value")),
    ("contract_no", ("contract #", "contract number", "po#", "po #")),
    ("award_date", ("date of award", "award date")),
    ("term", ("term",)),
    ("renewal", ("renewal",)),
]


def map_header(row: list) -> dict[int, str] | None:
    cells = [norm_space(c).lower() for c in row]
    if not any("public body" in c for c in cells):
        return None
    out: dict[int, str] = {}
    for i, c in enumerate(cells):
        if not c:
            continue
        for field, keys in HEADER_MAP:
            if field in out.values():
                continue
            if any(k in c for k in keys):
                out[i] = field
                break
    return out


MONTH_RE = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*", re.I)


def period_of(filename: str, first_text: str) -> tuple[str, str]:
    """(period_start, period_end) ISO, read from the report's own header line.

    Header formats seen: "03/01/2026 - 03/15/2026", "January 16, 2024 - January 31, 2024",
    "October, 1st, 2023 to October, 15th, 2023", "July 16th - 31st, 2021",
    "Februrary 16th - 28th, 2021". Two August 2021 reports have no header; the file
    name gives the days and the listing page gives the year.
    """
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s*-\s*(\d{2})/(\d{2})/(\d{4})", first_text)
    if m:
        a = date(int(m[3]), int(m[1]), int(m[2]))
        b = date(int(m[6]), int(m[4]), int(m[5]))
        return a.isoformat(), b.isoformat()
    line = ""
    for pat in (r"PERIOD:([^\n]*)", r"BIDS\s*-\s*([^\n]*)"):
        mm = re.search(pat, first_text)
        if mm:
            line = mm.group(1)
            break
    if not line:
        line = filename.replace("_", " ").replace("-", " ")
    years = re.findall(r"(20\d{2})", line)
    months = [MONTHS[x.lower()[:3]] for x in MONTH_RE.findall(line)]
    stripped = re.sub(r"20\d{2}", " ", line)
    days = [int(d) for d in re.findall(r"(?<!\d)(\d{1,2})(?:st|nd|rd|th)?(?!\d)", stripped) if 1 <= int(d) <= 31]
    year = int(years[0]) if years else 2021
    if months and len(days) >= 2:
        m1 = months[0]
        m2 = months[1] if len(months) > 1 else m1
        return date(year, m1, days[0]).isoformat(), date(year, m2, days[1]).isoformat()
    return "", ""


def parse_date(s: str) -> str:
    s = norm_space(s)
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", s)
    if m:
        mo, d, y = int(m[1]), int(m[2]), int(m[3])
        if y < 100:
            y += 2000
        if mo > 12 and d <= 12:  # dd/mm written the other way
            mo, d = d, mo
        try:
            return date(y, mo, d).isoformat()
        except ValueError:
            return ""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return s[:10]
    m = re.match(r"(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$", s)
    if m and m[2][:3].lower() in MONTHS:
        y = int(m[3]) + (2000 if len(m[3]) == 2 else 0)
        try:
            return date(y, MONTHS[m[2][:3].lower()], int(m[1])).isoformat()
        except ValueError:
            return ""
    m = re.match(r"([A-Za-z]+)\.? (\d{1,2}),? (\d{4})", s)
    if m and m[1][:3].lower() in MONTHS:
        return date(int(m[3]), MONTHS[m[1][:3].lower()], int(m[2])).isoformat()
    return ""


NUM = r"\$?\s?S?(\d{1,3}(?:[,.]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)"


def parse_amount(raw: str) -> tuple[float | None, str, float | None]:
    """(amount_cad, currency, amount_original) from a price cell.

    Canadian dollars unless the cell says otherwise. A cell giving both USD and CAD
    uses the CAD figure. A USD-only cell keeps the USD figure in amount_original
    and leaves amount_cad empty: the site never converts currency. Rates, ranges
    and prose ("$1.20 / KM", "$336,000 to $600,000") stay as text with no amount.
    """
    t = norm_space(raw)
    if not t:
        return None, "", None
    up = t.upper()
    if re.search(r"\bTO\b|PER\b|/|HOURLY|RATE|EACH|DETERMINED", up) and "CAD" not in up:
        return None, "text", None
    def num(x: str) -> float | None:
        x = x.replace(" ", "")
        if x.count(".") > 1:  # "$81.911.25"
            head, tail = x.rsplit(".", 1)
            x = head.replace(".", ",") + "." + tail
        return money(x.replace(",", ""))
    m = re.search(NUM + r"\s*\(?(CAD|CDN)\)?", t, re.I)
    if m:
        return num(m[1]), "CAD", None
    m = re.search(NUM + r"\s*\(?(USD|US)\b", t, re.I)
    if m:
        return None, "USD", num(m[1])
    nums = re.findall(NUM, t)
    if len(nums) == 1:
        return num(nums[0]), "CAD", None
    return None, "text", None


CLAUSES = [
    (r"6\s*\(?a?\)?\s*\(?v\)?(?!i)|only (one |available )?source|one source", "Sole source"),
    (r"6\s*\(?a?\)?\s*\(?iv\)?|emergenc|urgen", "Emergency"),
    (r"6\s*\(?a?\)?\s*\(?vii\)?|resale", "For resale"),
    (r"6\s*\(?a?\)?\s*\(?vi\)?|pre.?qualified", "Pre-qualified supplier"),
    (r"6\s*\(?a\)?\s*\(?ii\)?|security", "Security"),
    (r"6\s*\(?b\)?|PUB", "Rates set by regulator"),
]


def method_of(ptype: str, clause: str, section: str) -> str:
    c = clause.strip()
    if c and c.upper() != "N/A":
        for pat, label in CLAUSES:
            if re.search(pat, c, re.I):
                return label
        return "Exception (other)"
    p = ptype.lower()
    if "limited" in p:
        return "Limited call"
    if "open" in p:
        return "Open call"
    if section == "Exception":
        return "Exception (clause not given)"
    return "Not stated"


def section_of(text: str, current: str) -> str:
    t = text.upper()
    if "EMERGENCY" in t:
        return "Emergency"
    if "WITHOUT AN OPEN CALL" in t or "EXCEPTION" in t:
        return "Exception"
    if "CONTRACT AWARD" in t:
        return "Award"
    return current


def parse_file(path, rel):
    rows = []
    with pdfplumber.open(path) as pdf:
        first = pdf.pages[0].extract_text() or ""
        pstart, pend = period_of(path.name, first)
        header: dict[int, str] | None = None
        section = section_of(first[:600], "Award")
        for pno, page in enumerate(pdf.pages, 1):
            award_on_page = 0
            for tno, table in enumerate(page.extract_tables()):
                for rno, row in enumerate(table):
                    joined = " ".join(norm_space(c) for c in row if c)
                    if not joined:
                        continue
                    if len([c for c in row if c]) == 1 and len(joined) > 20 and "$" not in joined:
                        section = section_of(joined, section)
                        continue
                    h = map_header(row)
                    if h:
                        header = h
                        continue
                    if not header:
                        continue
                    rec = {f: "" for f in FIELDS}
                    for i, field in header.items():
                        if i < len(row) and row[i] is not None:
                            rec[field] = norm_space(row[i])
                    raw_amt = rec["amount"]
                    amt, cur, orig = parse_amount(raw_amt)
                    if amt is None and orig is None and not rec["supplier"]:
                        continue
                    rec["amount"] = amt
                    rec["currency"] = cur
                    rec["amount_original"] = orig
                    rec["amount_text"] = raw_amt
                    rec["award_date"] = parse_date(rec["award_date"])
                    rec["section"] = section
                    rec["method"] = method_of(rec["procurement_type"], rec["clause"], section)
                    rec["period_start"], rec["period_end"] = pstart, pend
                    rec["source_file"] = rel
                    rec["page"] = pno
                    rec["row"] = f"t{tno + 1}r{rno + 1}"
                    award_on_page += 1
                    rec["award_on_page"] = award_on_page
                    rows.append(rec)
    return rows


def fortnight_key(first_text: str, pstart: str, pend: str) -> str:
    # Until July 2021 exceptions (section 32) were a separate report from awards (section 31).
    kind = "exc" if "WITHOUT AN OPEN CALL" in first_text.upper() else "all"
    return f"{pstart}|{pend}|{kind}"


def main():
    manifest = load_manifest()
    files = sorted((CACHE / "ppa").glob("*.pdf"))
    by_period = defaultdict(list)
    parsed = {}
    for f in files:
        rel = f"ppa/{f.name}"
        rows = parse_file(f, rel)
        with pdfplumber.open(f) as pdf:
            first = pdf.pages[0].extract_text() or ""
        ps, pe = period_of(f.name, first)
        parsed[rel] = rows
        by_period[fortnight_key(first, ps, pe)].append(rel)
        print(f"{f.name}: {len(rows)} rows  {ps}..{pe}")

    keep, superseded = [], []
    for key, rels in sorted(by_period.items()):
        if len(rels) == 1:
            keep.append(rels[0])
            continue
        revised = [r for r in rels if re.search(r"revised", r, re.I)]
        chosen = sorted(revised or rels)[-1]  # "Revised-1" sorts after "REVISED"
        keep.append(chosen)
        for r in rels:
            if r != chosen:
                superseded.append({"period": key, "dropped": r, "kept": chosen,
                                   "dropped_rows": len(parsed[r]), "kept_rows": len(parsed[chosen])})

    out = []
    for rel in keep:
        for r in parsed[rel]:
            r["source_url"] = manifest.get(r["source_file"], {}).get("url", "")
            out.append(r)
    cols = FIELDS + ["currency", "amount_original", "amount_text", "method", "section", "period_start", "period_end", "source_file", "source_url", "page", "row", "award_on_page"]
    with open(CLEAN / "ppa_awards.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(out)
    with open(CLEAN / "ppa_superseded.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["period", "dropped", "kept", "dropped_rows", "kept_rows"])
        w.writeheader()
        w.writerows(superseded)
    print(f"\n{len(out)} award rows from {len(keep)} reports; {len(superseded)} superseded issues dropped")
    print("no period:", [k for k in by_period if k.startswith("|")])
    print(Counter(r["procurement_type"] for r in out).most_common(25))
    print(Counter(r["section"] for r in out))
    print(Counter(r["method"] for r in out))
    print(Counter(r["currency"] for r in out))
    print("total $", round(sum(r["amount"] or 0 for r in out)))
    print("no amount:", sum(1 for r in out if r["amount"] is None), "no date:", sum(1 for r in out if not r["award_date"]))


if __name__ == "__main__":
    main()

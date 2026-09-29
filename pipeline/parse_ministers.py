"""Ministerial expense claims (Executive Council), December 2020 onward.

Each PDF: a summary table of claims paid in the six-month period, then one detail
page per travel claim with a category breakdown (accommodations, meals, travel,
other) and, from 2022, airfare origin and destination. Payroll lines (car allowance)
appear in the summary with Reference ID "PAYROLL".

The listing page total for each minister is checked against the sum of the parsed
summary lines; mismatches are written to ministers_check.csv.
"""
import csv
import json
import re
from datetime import datetime

from common import CACHE, CLEAN, money, norm_space, pdf_pages

LINE = re.compile(
    r"^\s*(\S+(?: \S+)?)\s+(\d{2}-[A-Z]{3}-\d{4})\s+(.*?)\s+(?:(\d{2}-[A-Z]{3}-\d{4})\s+)?(-?\$[\d,]+\.\d{2}|\(\$[\d,]+\.\d{2}\))\s*$"
)
CAT = re.compile(r"^\s*(Accommodations?|Meals & Incidentals|Travel|Other Expenses|Hospitality|Mileage)\s+(-?\$[\d,]+\.\d{2})\s*$")
AIR = re.compile(r"^\s*Airfare\s+\d{2}-[A-Z]{3}-\d{4}\s+-?\$[\d,]+\.\d{2}\s+(.+?)\s{2,}(.+?)\s*$")


def iso(d: str) -> str:
    return datetime.strptime(d, "%d-%b-%Y").date().isoformat()


def period_of(title: str) -> tuple[str, str]:
    m = re.search(r"(December|June)\s+(?:1,?\s+)?(\d{4})\s*-\s*(May|November)\s+(?:31,?\s+)?(\d{4})", title)
    if not m:
        return "", ""
    start = f"{m[2]}-{'12' if m[1] == 'December' else '06'}-01"
    end = f"{m[4]}-{'05-31' if m[3] == 'May' else '11-30'}"
    return start, end


def parse_pdf(path):
    pages = pdf_pages(path)
    name = dept = ""
    claims: list[dict] = []
    details: dict[str, dict] = {}
    in_summary = False
    current_ref = None
    pdf_total = None
    for pno, text in enumerate(pages, 1):
        for raw in text.splitlines():
            line = raw.rstrip()
            s = line.strip()
            if not s:
                continue
            if s.startswith("Name ") and not name:
                name = norm_space(s[5:])
            elif s.startswith("Department ") and not dept:
                dept = norm_space(s[11:])
            if s.startswith("Expenses Paid Within"):
                in_summary = True
                continue
            if in_summary:
                m = LINE.match(line)
                if m:
                    claims.append({"ref": m[1], "date": iso(m[2]), "purpose": m[3].strip(), "paid": iso(m[4]) if m[4] else "",
                                   "amount": money(m[5]), "page": pno})
                    continue
                if s.startswith("Total"):
                    in_summary = False
                    pdf_total = money(s.split()[-1])
                    continue
                if claims and raw.startswith(" " * 20) and not s.startswith("Reference"):
                    claims[-1]["purpose"] += " " + s
                continue
            m = re.match(r"Reference ID\s+(\S+)", s)
            if m:
                current_ref = m[1]
                details.setdefault(current_ref, {"categories": {}, "routes": [], "page": pno})
                continue
            if current_ref:
                m = CAT.match(line)
                if m:
                    details[current_ref]["categories"][m[1]] = money(m[2])
                    continue
                m = AIR.match(line)
                if m:
                    details[current_ref]["routes"].append(f"{norm_space(m[1])} to {norm_space(m[2])}")
    return name, dept, claims, details, pdf_total


def main():
    index = json.loads((CACHE / "ministers" / "_index.json").read_text())
    out, checks = [], []
    for item in index:
        path = CACHE / item["file"]
        if not path.exists():
            checks.append({"file": item["file"], "issue": "missing file"})
            continue
        name, dept, claims, details, pdf_total = parse_pdf(path)
        pstart, pend = period_of(item["period_title"])
        cells = item["cells"]
        listed_total = next((money(c) for c in cells if c.strip().startswith("$")), None)
        who = cells[0] if cells else name
        parsed_total = round(sum(c["amount"] or 0 for c in claims), 2)
        if pdf_total is not None and abs(parsed_total - pdf_total) > 0.01:
            checks.append({"file": item["file"], "issue": f"PDF total ${pdf_total:,.2f} vs parsed lines ${parsed_total:,.2f}"})
        if listed_total is not None and pdf_total is not None and abs(pdf_total - listed_total) > 0.01:
            checks.append({"file": item["file"], "issue": f"web page total ${listed_total:,.2f} vs PDF total ${pdf_total:,.2f} (publisher discrepancy)"})
        if pdf_total is None and claims:
            checks.append({"file": item["file"], "issue": "no total line found in PDF"})
        for i, c in enumerate(claims):
            d = details.get(c["ref"], {})
            cats = d.get("categories", {})
            kind = "Payroll allowance" if c["ref"] == "PAYROLL" else "Travel and other claim"
            out.append({
                "minister": name or who, "listing_label": who, "department": dept,
                "period_start": pstart, "period_end": pend,
                "ref": c["ref"], "date": c["date"], "paid": c["paid"], "purpose": norm_space(c["purpose"]),
                "amount": c["amount"], "kind": kind,
                "accommodations": cats.get("Accommodations") or cats.get("Accommodation"),
                "meals": cats.get("Meals & Incidentals"), "travel": cats.get("Travel"),
                "other": cats.get("Other Expenses"), "hospitality": cats.get("Hospitality"),
                "routes": "; ".join(dict.fromkeys(d.get("routes", []))),
                "source_file": item["file"], "source_url": item["url"], "page": c["page"], "line": i + 1,
                "detail_page": d.get("page", ""),
            })
    with open(CLEAN / "minister_claims.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    with open(CLEAN / "ministers_check.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["file", "issue"])
        w.writeheader()
        w.writerows(checks)
    print(len(out), "claim lines;", len(checks), "reports not reconciling")
    for c in checks[:20]:
        print(" ", c)
    print("total $", round(sum(r["amount"] or 0 for r in out), 2))


if __name__ == "__main__":
    main()

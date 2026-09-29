"""Compensation disclosure (sunshine list) XLSX files into one clean CSV.

Published as-is: the site shows only what the file shows. RNC files replace names
with identifiers; those stay identifiers. Amounts are rounded to $100 by the publisher.
"""
import csv
import re
from datetime import datetime

import openpyxl

from common import CACHE, CLEAN, load_manifest, money, norm_space

COLS = [
    ("name", ("employee name", "name", "identifier")),
    ("unit", ("department", "campus", "zone", "division", "location", "school")),
    ("title", ("job title", "position", "title")),
    ("base", ("base",)),
    ("overtime", ("overtime",)),
    ("bonus", ("bonus",)),
    ("shift", ("shift",)),
    ("retro", ("retro",)),
    ("severance", ("severance",)),
    ("other", ("other",)),
    ("total", ("total",)),
]


def find_header(rows):
    for i, r in enumerate(rows[:40]):
        cells = [norm_space(str(c)).lower() if c is not None else "" for c in r]
        if any(c.startswith("total") for c in cells) and any("base" in c for c in cells):
            mapping = {}
            for j, c in enumerate(cells):
                for field, keys in COLS:
                    if field in mapping.values() or not c:
                        continue
                    if any(c.startswith(k) or k in c for k in keys):
                        mapping[j] = field
                        break
            # first column is the person when no name-like header exists
            if "name" not in mapping.values():
                mapping[0] = "name"
            return i, mapping
    return None, None


def year_of(rows, filename):
    for r in rows[:12]:
        txt = " ".join(str(c) for c in r if c is not None)
        if "calendar year" in txt.lower() or "job data date" in txt.lower():
            for c in r:
                if isinstance(c, datetime):
                    return c.year
                if isinstance(c, (int, float)) and 2000 < c < 2100:
                    return int(c)
            m = re.search(r"(20\d{2})", txt)
            if m:
                return int(m[1])
    m = re.search(r"(20\d{2})", filename)
    return int(m[1]) if m else None


def employer_of(rows):
    for r in rows[:3]:
        vals = [str(c).strip() for c in r if c is not None and str(c).strip()]
        if not vals:
            continue
        if vals[0].lower().startswith("name of the public entity"):
            return vals[1] if len(vals) > 1 else ""
        return vals[0]
    return ""


EMPLOYER_BY_FILE = {  # files whose title row says only "Name of the Public Entity"
    "CELEBRATE-NL-Inc.-Compensation-Disclosure-2023.xlsx": "Celebrate NL",
    "CNA-Compensation-Disclosure.xlsx": "College of the North Atlantic",
    "MMSB-Compensation-Disclosure-2025.xlsx": "Multi-Materials Stewardship Board",
    "Municipal-Assessment-Agency-Compensation-Disclosure.xlsx": "Municipal Assessment Agency",
    "NLC-Compensation-Disclosure-2025.xlsx": "Newfoundland Labrador Liquor Corporation",
    "NLHS-Compensation-Disclosure-2025-1.xlsx": "Newfoundland and Labrador Health Services",
    "PACSW-Compensation-Disclosure-2025.xlsx": "Provincial Advisory Council on the Status of Women",
}


CANON = [  # (file-name prefix, canonical employer name)
    ("2025-Compensation-Disclosure-List-CORE", "Core public service"),
    ("Core-Public-Service", "Core public service"),
    ("C.A.-Pippy", "C.A. Pippy Park Commission"), ("CA-Pippy", "C.A. Pippy Park Commission"),
    ("CELEBRATE", "Celebrate NL"), ("Celebrate", "Celebrate NL"),
    ("CNA", "College of the North Atlantic"),
    ("CSFP", "Conseil scolaire francophone provincial"),
    ("CUDGC", "Credit Union Deposit Guarantee Corporation"), ("Credit-Union", "Credit Union Deposit Guarantee Corporation"),
    ("HOA", "House of Assembly"),
    ("Human-Rights", "Human Rights Commission"),
    ("Labour-Relations", "Labour Relations Board"), ("2023-Labour-Relations", "Labour Relations Board"),
    ("MAA", "Municipal Assessment Agency"), ("Municipal-Assessment", "Municipal Assessment Agency"),
    ("MMSB", "Multi-Materials Stewardship Board"),
    ("Memorial-University", "Memorial University"),
    ("NL-Film", "NL Film Development Corporation"),
    ("NL-Housing", "NL Housing Corporation"), ("NLHC", "NL Housing Corporation"),
    ("NL-Hydro", "NL Hydro and affiliates"), ("Newfoundland-and-Labrador-Hydro", "NL Hydro and affiliates"),
    ("NLC", "NL Liquor Corporation"),
    ("NLHS", "NL Health Services"),
    ("Oil-and-Gas", "Oil and Gas Corporation of NL"),
    ("PACSW", "Provincial Advisory Council on the Status of Women"),
    ("PILRB", "Provincial Information and Library Resources Board"),
    ("PPA", "Public Procurement Agency"),
    ("PSC", "Public Service Commission"),
    ("PUB", "Board of Commissioners of Public Utilities"),
    ("RNC", "Royal Newfoundland Constabulary"),
    ("The-Rooms", "The Rooms Corporation"),
    ("WHSCRD", "Workplace Health, Safety and Compensation Review Division"),
    ("WorkplaceNL", "WorkplaceNL"),
]


def canonical(filename: str, fallback: str) -> str:
    for prefix, name in sorted(CANON, key=lambda x: -len(x[0])):
        if filename.startswith(prefix):
            return name
    return fallback


def main():
    manifest = load_manifest()
    out, files_report = [], []
    for f in sorted((CACHE / "sunshine").glob("*.xlsx")):
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        employer = year = None
        n = 0
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            employer = employer or EMPLOYER_BY_FILE.get(f.name) or employer_of(rows)
            year = year or year_of(rows, f.name)
            hi, mapping = find_header(rows)
            if hi is None:
                continue
            section = ""
            for ri in range(hi + 1, len(rows)):
                r = rows[ri]
                vals = [c for c in r if c is not None and str(c).strip()]
                if not vals:
                    continue
                rec = {field: (r[j] if j < len(r) else None) for j, field in mapping.items()}
                total = money(rec.get("total")) if not isinstance(rec.get("total"), (int, float)) else float(rec["total"])
                if total is None:
                    if len(vals) == 1 and isinstance(vals[0], str) and len(vals[0]) < 60:
                        section = vals[0].strip()  # e.g. "Eastern Zone" in NLHS files
                    continue
                name = norm_space(str(rec.get("name") or ""))
                if not name or name.lower().startswith("total"):
                    continue
                row = {
                    "year": year, "employer": canonical(f.name, norm_space(employer)), "employer_as_published": norm_space(employer), "unit": norm_space(str(rec.get("unit") or section or "")),
                    "name": name, "title": norm_space(str(rec.get("title") or "")),
                }
                for k in ("base", "overtime", "bonus", "shift", "retro", "severance", "other"):
                    v = rec.get(k)
                    row[k] = float(v) if isinstance(v, (int, float)) else money(str(v)) if v is not None else None
                row["total"] = total
                row["source_file"] = f"sunshine/{f.name}"
                row["source_url"] = manifest.get(f"sunshine/{f.name}", {}).get("url", "")
                row["sheet"] = ws.title
                row["row"] = ri + 1
                out.append(row)
                n += 1
        files_report.append({"file": f.name, "employer": canonical(f.name, employer or ""), "year": year, "rows": n})
    with open(CLEAN / "sunshine.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    with open(CLEAN / "sunshine_files.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["file", "employer", "year", "rows"])
        w.writeheader()
        w.writerows(files_report)
    # links the government page lists that return 404
    links = (CACHE / "sunshine" / "_links.txt").read_text().split()
    broken = [u for u in links if not (CACHE / "sunshine" / u.rsplit("/", 1)[1]).exists()]
    with open(CLEAN / "broken_links_sunshine.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["source", "listed_on", "url", "status"])
        for u in broken:
            w.writerow(["Compensation disclosure", "https://www.gov.nl.ca/exec/tbs/home/publications/compensation-disclosure/", u, "404"])
    from collections import Counter
    print(len(out), "people-years;", len(broken), "broken links")
    print(sorted(Counter(r["year"] for r in out).items()))
    for fr in files_report:
        if fr["rows"] == 0 or not fr["year"] or not fr["employer"]:
            print("  check:", fr)


if __name__ == "__main__":
    main()

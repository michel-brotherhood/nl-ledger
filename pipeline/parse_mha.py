"""MHA (Member of the House of Assembly) annual expense reports, April 2020 onward.

Detail reports: one section per allowance category, each with a line table
(date, source document, vendor, details, amount) and a "Period Activity" total.
Columns are sliced at the header's own offsets because vendor and details wrap.
Summary reports: per category the fiscal-year limit, spending, funds available and
percent used.

Every detail section is checked: the parsed lines must add up to its Period Activity.
"""
import csv
import json
import re
from datetime import datetime

from common import CACHE, CLEAN, money, norm_space, pdf_pages

DATE = re.compile(r"^\s*(\d{2}-[A-Z][a-z]{2}-\d{2})\s+(\S+)\s")
AMT = re.compile(r"(-?[\d,]+\.\d{2}|\([\d,]+\.\d{2}\))\s*$")


def iso(d: str) -> str:
    return datetime.strptime(d, "%d-%b-%y").date().isoformat()


# Column boundaries in PDF points, fixed by the House of Assembly report template
# (checked against several members and years): document number, vendor, details, amount.
X_VENDOR, X_DETAILS, X_AMOUNT = 200, 340, 640


def _lines(page):
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
    rows = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if rows and abs(rows[-1][0] - w["top"]) <= 3:
            rows[-1][1].append(w)
        else:
            rows.append([w["top"], [w]])
    return [(top, sorted(ws, key=lambda w: w["x0"])) for top, ws in rows]


def parse_detail(path):
    """Read each report page as words with positions and assign them to columns."""
    import pdfplumber
    lines_out, sections = [], []
    category = ""
    cur_section = None
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            rows = _lines(page)
            header_top = None
            texts = [" ".join(w["text"] for w in ws) for _, ws in rows]
            for i, (top, ws) in enumerate(rows):
                t = texts[i]
                if t == "Member Accountability and Disclosure Report" and i + 1 < len(rows):
                    category = norm_space(texts[i + 1])
                    if not cur_section or cur_section["category"] != category:
                        cur_section = {"category": category, "period_activity": None, "parsed": 0.0, "limit": None}
                        sections.append(cur_section)
                    continue
                if t.startswith("Expenditure Limit"):
                    cur_section["limit"] = money(t.split(":")[-1])
                    continue
                if "Vendor Name" in t and "Amount" in t:
                    header_top = top
                    continue
                if t.startswith("Period Activity:"):
                    cur_section["period_activity"] = money(t.split(":")[-1])
                    header_top = None
                    continue
                if header_top is None or top <= header_top or cur_section is None:
                    continue
                first = ws[0]["text"]
                amt_words = [w for w in ws if w["x0"] >= X_AMOUNT]
                vendor = " ".join(w["text"] for w in ws if X_VENDOR <= w["x0"] < X_DETAILS)
                details = " ".join(w["text"] for w in ws if X_DETAILS <= w["x0"] < X_AMOUNT)
                if re.fullmatch(r"\d{2}-[A-Z][a-z]{2}-\d{2}", first) and amt_words:
                    doc = " ".join(w["text"] for w in ws[1:] if w["x0"] < X_VENDOR)
                    amt = money(amt_words[-1]["text"])
                    lines_out.append({"category": category, "date": iso(first), "doc": doc,
                                      "vendor": norm_space(vendor), "details": norm_space(details),
                                      "amount": amt, "page": pno})
                    cur_section["parsed"] += amt or 0
                elif lines_out and lines_out[-1]["category"] == category and not amt_words:
                    if vendor:
                        lines_out[-1]["vendor"] = norm_space(lines_out[-1]["vendor"] + " " + vendor)
                    if details:
                        lines_out[-1]["details"] = norm_space(lines_out[-1]["details"] + " " + details)
    return lines_out, sections


SUMROW = re.compile(r"^\s*([A-Za-z&\-\s]+?)\s{2,}(--|[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(?:(--|-?[\d,]+\.\d{2}|\([\d,]+\.\d{2}\))\s+)?(--|-?[\d.]+%)\s*$")


def parse_summary(path):
    out = []
    group = ""
    for text in pdf_pages(path):
        for raw in text.splitlines():
            s = raw.strip()
            if s in ("Office Allowances", "Operational Resources", "Travel & Living Allowances", "Constituency Allowance"):
                group = s
            m = SUMROW.match(raw)
            if m and not s.startswith("Total"):
                out.append({"group": group, "category": norm_space(m[1]), "limit": money(m[2]) if m[2] != "--" else None,
                            "spent": money(m[3]), "available": money(m[5]) if m[5] and m[5] != "--" else None,
                            "pct": float(m[6].rstrip("%")) if m[6] != "--" else None})
    return out


def main():
    index = json.loads((CACHE / "mha" / "_index.json").read_text())
    det, summ, checks = [], [], []
    broken = []
    for item in index:
        path = CACHE / item["file"]
        if not path.exists():
            broken.append(item)
            continue
        fy = f"{item['fy_start']}-{str(item['fy_start'] + 1)[2:]}"
        base = {"member": item["member"], "district": item["district"], "fiscal_year": fy,
                "source_file": item["file"], "source_url": item["url"]}
        if item["kind"] == "detail":
            lines, sections = parse_detail(path)
            for n, ln in enumerate(lines, 1):
                det.append({**base, **ln, "line": n})
            for sec in sections:
                pa = sec["period_activity"]
                if pa is not None and abs(pa - sec["parsed"]) > 0.01:
                    checks.append({**base, "category": sec["category"], "period_activity": pa, "parsed": round(sec["parsed"], 2)})
        else:
            for r in parse_summary(path):
                summ.append({**base, **r})
    for name, rows in (("mha_lines.csv", det), ("mha_summary.csv", summ), ("mha_check.csv", checks)):
        if rows:
            with open(CLEAN / name, "w", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
    with open(CLEAN / "broken_links_mha.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["source", "listed_on", "url", "status"])
        for b in broken:
            w.writerow(["MHA expense report", b["page"], b["url"], "link returns a web page, not a PDF"])
    print(len(broken), "broken report links")
    print(len(det), "detail lines;", len(summ), "summary rows;", len(checks), "sections not reconciling")
    for c in checks[:15]:
        print(" ", {k: c[k] for k in ("member", "fiscal_year", "category", "period_activity", "parsed")})
    print("detail total $", round(sum(r["amount"] or 0 for r in det), 2),
          "summary total $", round(sum(r["spent"] or 0 for r in summ), 2))


if __name__ == "__main__":
    main()

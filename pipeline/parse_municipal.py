"""Municipal payments.

Paradise: monthly payment registers (text PDFs). Each line: payment number, date,
vendor, invoice, invoice description, amount. The listing page repeats some
registers under the wrong month, so registers are identified by content hash and
dated by their own payment dates.

St. John's: weekly payment vouchers, published as one image-only PDF per year.
A sample of pages is read with OCR (tesseract). OCR text can misread characters,
so every OCR line keeps its page number and the site labels these rows as
machine-read.
"""
import csv
import hashlib
import re
import subprocess
from collections import Counter
from pathlib import Path

from common import CACHE, CLEAN, DISABLED, load_manifest, money, norm_space, pdf_pages

PLINE = re.compile(
    r"^\s*(\S+)\s+(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s{2,}(\S+(?: \S+)?)\s{2,}(.+?)\s{2,}(-?[\d,]+\.\d{2})\s*$"
)
PLINE_NODESC = re.compile(r"^\s*(\S+)\s+(\d{1,2}/\d{1,2}/\d{4})\s+(.+?)\s{2,}(\S+)\s{2,}(-?[\d,]+\.\d{2})\s*$")


def iso_mdy(s: str) -> str:
    m, d, y = s.split("/")
    return f"{y}-{int(m):02d}-{int(d):02d}"


def paradise(manifest):
    out, seen, report = [], {}, []
    for f in sorted((CACHE / "paradise").glob("*.pdf")):
        h = hashlib.sha256(f.read_bytes()).hexdigest()
        rel = f"paradise/{f.name}"
        if h in seen:
            report.append({"file": f.name, "status": f"duplicate of {seen[h]}", "lines": 0, "unparsed": 0})
            continue
        seen[h] = f.name
        n = bad = 0
        rows = []
        for pno, text in enumerate(pdf_pages(f), 1):
            for ln in text.splitlines():
                if not re.match(r"^\s*\S+\s+\d{1,2}/\d{1,2}/\d{4}", ln):
                    continue
                m = PLINE.match(ln)
                if m:
                    pay, date, vendor, inv, desc, amt = m.groups()
                else:
                    m = PLINE_NODESC.match(ln)
                    if not m:
                        bad += 1
                        continue
                    pay, date, vendor, inv, amt = m.groups()
                    desc = ""
                n += 1
                rows.append({"payment_no": pay, "date": iso_mdy(date), "vendor": norm_space(vendor), "invoice": inv,
                             "description": norm_space(desc), "amount": money(amt),
                             "source_file": rel, "source_url": manifest.get(rel, {}).get("url", ""), "page": pno})
        months = Counter(r["date"][:7] for r in rows)
        month = months.most_common(1)[0][0] if months else ""
        for r in rows:
            r["register_month"] = month
        out += rows
        report.append({"file": f.name, "status": f"register {month}" if month else "no lines parsed", "lines": n, "unparsed": bad})
    # two different files can still cover the same month (a re-issue); keep the one with more lines
    by_month = {}
    for rep in report:
        if rep["status"].startswith("register"):
            mo = rep["status"].split()[1]
            if mo not in by_month or rep["lines"] > by_month[mo]["lines"]:
                by_month[mo] = rep
    keep = {v["file"] for v in by_month.values()}
    for rep in report:
        if rep["status"].startswith("register") and rep["file"] not in keep:
            rep["status"] += " (superseded by a fuller register for the same month)"
    out = [r for r in out if r["source_file"].split("/", 1)[1] in keep]
    write("paradise_payments.csv", out)
    write("paradise_files.csv", report)
    print(f"paradise: {len(out)} payment lines, {len(keep)} monthly registers, "
          f"{sum(r['unparsed'] for r in report)} unparsed lines, ${sum(r['amount'] or 0 for r in out):,.2f}")
    print("  months:", sorted(by_month))


def ocr_page(pdf: Path, page: int, workdir: Path) -> str:
    png = workdir / f"{pdf.stem}-p{page}"
    subprocess.run(["pdftoppm", "-r", "300", "-gray", "-f", str(page), "-l", str(page), "-png", str(pdf), str(png)],
                   check=True, capture_output=True)
    img = next(workdir.glob(f"{png.name}*.png"))
    txt = subprocess.run(["tesseract", str(img), "-", "--psm", "6"], capture_output=True, text=True).stdout
    img.unlink()
    return txt


SJ_LINE = re.compile(r"^(.*?)\s+\$?\s?(-?[\d,]{1,12}\.\d{2})\s*$")


def stjohns(manifest, pages_per_file: int = 12):
    """OCR the first pages of the latest yearly voucher file."""
    work = CACHE / "stjohns" / "_ocr"
    work.mkdir(exist_ok=True)
    files = sorted((CACHE / "stjohns").glob("weekly-payment-vouchers-january-14-september-2-2026.pdf"))
    out = []
    for f in files:
        rel = f"stjohns/{f.name}"
        weeks = ""
        for page in range(1, pages_per_file + 1):
            cache = work / f"{f.stem}-p{page}.txt"
            if not cache.exists():
                cache.write_text(ocr_page(f, page, work))
            text = cache.read_text()
            if "MEMORANDUM" in text or "Weekly Payment Vouchers" in text:
                m = re.search(r"Weeks? Ending (.+?\d{4})", text)
                weeks = norm_space(m[1]) if m else weeks
                continue  # cover memo: payroll and weekly totals, not payments
            for ln in text.splitlines():
                m = SJ_LINE.match(ln.strip())
                if not m or len(m[1]) < 3:
                    continue
                label = norm_space(m[1])
                if label.upper().startswith(("TOTAL", "SUB-TOTAL", "SUBTOTAL")):
                    continue  # page and week totals, not payments
                # Payments to private individuals are blacked out by the City; OCR reads the
                # black box as noise (lower-case fragments, stray symbols) or nothing at all.
                first = label.split()[0]
                withheld = label.startswith(("REFUND", "COURT OF APPEAL")) or bool(re.search(r"[a-z\[\]|“”;:]", first))
                out.append({"text": label, "payee_withheld": int(withheld), "amount": money(m[2]),
                            "weeks": weeks, "source_file": rel,
                            "source_url": manifest.get(rel, {}).get("url", ""), "page": page})
    write("stjohns_ocr_lines.csv", out)
    print(f"st. john's: {len(out)} OCR lines from {len(files)} file(s)")


def write(name, rows):
    if not rows:
        return
    with open(CLEAN / name, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    manifest = load_manifest()
    if "paradise" not in DISABLED:
        paradise(manifest)
    if "stjohns" not in DISABLED:
        stjohns(manifest)
    if DISABLED >= {"paradise", "stjohns"}:
        print("municipal: skipped, both sources are switched off (common.DISABLED)")


if __name__ == "__main__":
    main()

"""Department and program spending, planned against actual.

Source: Report on the Program Expenditures and Revenues of the Consolidated Revenue
Fund (one PDF per fiscal year). Each department section lists programs
("2.2.01. PHYSICIAN SERVICES") under CURRENT or CAPITAL, and under each program
its objects of expenditure ("01. Salaries", "02. Operating Accounts" with detail
lines such as "Professional Services", "10. Grants and Subsidies") and related
revenue ("01. Revenue - Federal"), each with three amounts: Actual, Amended
estimate, Original estimate.

Also parses the Budget Estimates PDFs, which have the same layout with the columns
Estimates (this year), Revised (last year), Original (last year). Each department
opens with a page that prints its name and a Program Funding Summary.

Check: per department, gross expenditure summed from object lines must equal the
department's gross expenditure in the report's own summary statement (the report),
or the "Total: Program Estimates" line of its Program Funding Summary (the Estimates).
"""
import csv
import re
from collections import defaultdict

from common import CACHE, CLEAN, load_manifest, norm_space, pdf_pages

AMT = r"(\(?-?[\d,]+\)?|-)"
THREE = re.compile(rf"\s{{2,}}{AMT}\s+{AMT}\s+{AMT}\s*$")
PROGRAM = re.compile(r"^\s{1,14}(\d{1,2}\.\d{1,2}\.\d{2})\.?\s+(.+?)\s*$")  # "3.2.02 FIRE SUPPRESSION" is printed without the last period
OBJECT = re.compile(r"^\s+(\d{2})\.\s*(.+?)$")  # "01.Salaries" is printed without the space
# An object printed with no amounts of its own ("11. Debt Expenses:", "10. Grants and Subsidies"):
# its amounts are the lines printed under it.
OBJECT_HEAD = re.compile(r"^\s+(\d{2})\.\s*([A-Z][A-Za-z ,&'’\-]+?):?\s*$")
# Current, Capital and Total; a department with no capital account prints the Current column alone.
FUNDING_TOTAL = re.compile(rf"^\s*TOTAL: PROGRAM ESTIMATES\s+{AMT}(?:\s+{AMT}\s+{AMT})?\s*$", re.M)
TOTAL = re.compile(r"^\s+Total:\s+(.+)$")
SUMMARY_DEPT = re.compile(rf"^\s{{2,4}}([A-Z][A-Za-z ,\-&'’]+?)\s{{2,}}{AMT}\s+{AMT}\s+{AMT}\s+{AMT}\s+{AMT}\s*$")


SMALL = {"and", "of", "the", "for", "to", "in", "on", "a", "an", "or", "by", "with", "at"}
KEEP = {"NL", "MUN", "RNC", "HST", "CPP", "ACOA", "IT", "OCIO", "PPA", "NLHC", "CNA", "II", "III", "IV", "FPT", "LIL", "COVID-19"}


def title_case(s: str) -> str:
    """ "MINISTER'S OFFICE" -> "Minister's Office"; keeps acronyms and small words."""
    out = []
    for i, w in enumerate(s.split()):
        if w.upper() in KEEP:
            out.append(w.upper())
        elif i and w.lower() in SMALL:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return " ".join(out)


def num(s: str) -> float:
    s = s.strip()
    if s in ("-", ""):
        return 0.0
    neg = s.startswith("(") and s.endswith(")")
    v = float(s.strip("()").replace(",", ""))
    return -v if neg else v


def dept_name(lines: list[str]) -> str:
    t = norm_space(" ".join(lines))
    t = re.sub(r"^DEPARTMENT OF (THE )?", "", t)
    return t.title().replace(" And ", " and ").replace(" Of ", " of ").replace(" The ", " the ").replace("'S", "'s")


def known_departments(pages) -> list[str]:
    """Department names as printed in the report's own summary statements."""
    names = set()
    for text in pages:
        if "Statement of Expenditure and Related Revenue by Department" not in text:
            continue
        carry = ""
        for ln in text.splitlines():
            m = SUMMARY_DEPT.match(ln)
            if m and "total" not in m[1].lower():
                names.add(norm_space(carry + " " + m[1]))
                carry = ""
            elif re.match(r"^\s{2,4}[A-Z][A-Za-z ,\-&'’]+$", ln) and not ln.strip().endswith(":"):
                carry = ln.strip()
            else:
                carry = ""
    return sorted(names, key=len, reverse=True)


CONTROL = re.compile(r"[\x01-\x08\x0b\x0c\x0e-\x1f]")
SHIFTED_WORD = re.compile(r"[$%&'()*+,\-./0-9:;<=][D-Z\[\\\]]+|[D-Z\[\\\]]+")  # "6XSSOLHV" is "Supplies", "DQG" is "and"
SHIFTED_CAPS = re.compile(r"[$%&'()*+,\-./0-9:;<=]{4,}")  # "&855(17" is "CURRENT"
PRINTED_FIGURE = re.compile(rf"{AMT}|\d{{4}}-\d{{2}}")


def unshifted(text: str) -> str:
    """Two Estimates pages (2025-26 PDF page 48, 2026-27 PDF page 148) carry a text layer of glyph
    numbers instead of characters for some or all of their text: each character sits 29 places below
    its own code, so digits and punctuation come out as control characters. Shift those runs back.
    A run is the text between gaps of two or more spaces; it is shifted when it holds a control
    character, when every word in it reads as a shifted word and one starts with a shifted capital,
    or when it reads as shifted capitals and is not an amount or a fiscal year. pdftotext drops the
    shifted brackets, so a bracketed amount in a shifted run comes back without them."""
    if len(CONTROL.findall(text)) < 20:
        return text

    def fix(run: str) -> str:
        words = run.split(" ")
        shifted = CONTROL.search(run) or (all(SHIFTED_WORD.fullmatch(w) for w in words if w)
                                          and any(w[:1] < "A" for w in words if w)) \
            or (SHIFTED_CAPS.fullmatch(run) and not PRINTED_FIGURE.fullmatch(run))
        return "".join(chr(ord(c) + 29) if c != " " and ord(c) < 98 else c for c in run) if shifted else run

    return "\n".join("".join(fix(part) if part.strip(" ") else part for part in re.split(r"( {2,})", line))
                     for line in text.split("\n"))


def estimates_department(lines: list[str], detail: list[str]) -> str:
    """The department named at the top of its opening page in the Estimates. The name runs over
    one to three capital-letter lines and is followed by the people who head it, also in capitals;
    the department's first detail page opens with the same name, so the name is as many of the
    opening page's lines as that page repeats."""
    caps = []
    for ln in (x.strip() for x in lines if x.strip()):
        if ln.startswith("HON.") or not re.fullmatch(r"[A-Z][A-Z ,&'’\-.()]+", ln):
            break
        caps.append(ln)
    top = norm_space(" ".join(x.strip() for x in detail if x.strip()))
    while len(caps) > 1 and not top.startswith(norm_space(" ".join(caps))):
        caps.pop()
    return dept_name(caps)


def words(s: str) -> set[str]:
    return set(re.findall(r"[a-z]+", s.lower())) - {"of", "and", "the", "department"}


def match_department(head: list[str], known: list[str]) -> str:
    """Some headers are printed twice over themselves ("DEPARTMENTOF DEPARTMENT OFDIGITAL...").
    Match on words: the longest known name whose words all appear in the header."""
    raw = " ".join(head)
    hw = words(raw) | words(re.sub(r"([a-z])([A-Z])", r"\1 \2", raw.title()))
    joined = re.sub(r"[^a-z]", "", raw.lower())
    for k in known:
        kw = words(k)
        if kw and (kw <= hw or all(w in joined for w in kw)):
            return k
    return dept_name(head)


def parse(path, kind: str, fy: str, rel: str, url: str):
    pages = pdf_pages(path)
    known = known_departments(pages)
    rows = []
    dept = None
    program = None
    account = None
    pending_program = None
    summary: dict[tuple[str, str], float] = {}
    summary_account = None
    open_object = None
    for pno, text in enumerate(pages, 1):
        lines = unshifted(text).splitlines()
        brackets_lost = CONTROL.search(text) is not None
        orphan = None  # amounts printed on a line of their own, just above the object they belong to
        if kind == "estimates" and "PROGRAM FUNDING SUMMARY" in text:
            # A department's opening page: its name, then its gross total for the year, current and capital.
            detail = next((p for p in pages[pno:pno + 4] if THREE.search(p)), "")
            dept, program = estimates_department(lines, detail.splitlines()[:8]), None
            m = FUNDING_TOTAL.search(text)
            if m:
                summary[(dept.lower(), "CURRENT")] = (num(m[1]), pno)
                if m[2]:
                    summary[(dept.lower(), "CAPITAL")] = (num(m[2]), pno)
            continue
        # department header: lines between the rule and "Statement of Expenditure and Related Revenue"
        for i, ln in enumerate(lines[:14]):
            if "Statement of Expenditure and Related Revenue" in ln and i > 0:
                head = []
                for back in range(i - 1, -1, -1):
                    s = lines[back].strip()
                    if not s or s.startswith("¯") or "REPORT ON THE PROGRAM" in s or "ESTIMATES" == s:
                        break
                    head.insert(0, s)
                if head and not any("CONTINUED" in h for h in head):
                    dept = match_department(head, known)
                    program = None
                break
        # department summary statement (Current / Capital Account), $000
        if "Statement of Expenditure and Related Revenue by Department" in text:
            summary_account = "CURRENT" if "Current Account" in text else "CAPITAL" if "Capital Account" in text else None
            carry = ""
            for ln in lines:
                m = SUMMARY_DEPT.match(ln)
                if m and summary_account and "total" not in m[1].lower():
                    name = norm_space(carry + " " + m[1]).lower()
                    summary[(name, summary_account)] = (num(m[2]) * 1000, pno)
                    carry = ""
                elif re.match(r"^\s{2,4}[A-Z][A-Za-z ,\-&'’]+$", ln) and not ln.strip().endswith(":"):
                    carry = ln.strip()  # department name wrapped onto two lines
                else:
                    carry = ""
            continue
        if dept is None:
            continue
        for ln in lines:
            s = ln.strip()
            if not s:
                pending_program = None
                continue
            if s in ("CURRENT", "CAPITAL"):
                account = s
                continue
            m = PROGRAM.match(ln)
            if m:
                program = {"code": m[1], "name": m[2].strip()}
                pending_program = program
                open_object = None
                continue
            if pending_program and (re.match(r"^\s+-\s+\S", ln) or (
                    re.fullmatch(r"\s+[A-Z][A-Z0-9 ,'’&\-/().]+", ln) and not THREE.search(ln)
                    and ln.strip() not in ("CURRENT", "CAPITAL") and not ln.strip().startswith("TOTAL"))):
                pending_program["name"] += " " + ln.strip().lstrip("-").strip()  # wrapped program name
                continue
            pending_program = None
            if not program:
                continue
            t = THREE.search(ln)
            above, orphan = orphan, None
            if not t:
                oh = OBJECT_HEAD.match(ln)
                if oh and above:
                    rows.append({"line_type": "object", "object_code": oh[1], "object": oh[2].strip()})
                    vals = above
                elif oh:
                    open_object = {"line_type": "object", "object_code": oh[1], "object": oh[2].strip()}
                    rows.append(open_object)
                    vals = [0.0, 0.0, 0.0]
                else:
                    continue
            else:
                label = ln[: t.start()].rstrip()
                vals = [num(t.group(k)) for k in (1, 2, 3)]
                if not label.strip():
                    orphan = vals
                tm = TOTAL.match(label)
                om = OBJECT.match(label)
                if tm:
                    open_object = None
                    rows.append({"line_type": "program_total", "object_code": "", "object": "Total (net of revenue)"})
                elif om:
                    open_object = None
                    name = om[2].strip()
                    ltype = "revenue" if name.lower().startswith("revenue") else "object"
                    if ltype == "revenue" and brackets_lost:  # related revenue is printed in brackets
                        vals = [-abs(v) for v in vals]
                    rows.append({"line_type": ltype, "object_code": om[1], "object": name})
                elif label.strip() and not label.strip().upper().startswith(("TOTAL", "AMOUNT TO BE VOTED", "STATUTORY")) \
                        and len(label) - len(label.lstrip()) >= 12:
                    rows.append({"line_type": "detail", "object_code": open_object["object_code"] if open_object else "02",
                                 "object": norm_space(label)})
                    if open_object:
                        for k, v in zip(("col1", "col2", "col3"), vals):
                            open_object[k] += v
                else:
                    open_object = None
                    continue
            rows[-1].update({
                "fiscal_year": fy, "kind": kind, "department": dept, "account": account,
                "program_code": program["code"], "program": title_case(program["name"]),
                "col1": vals[0], "col2": vals[1], "col3": vals[2],
                "source_file": rel, "source_url": url, "page": pno,
            })
    return rows, summary


def main():
    manifest = load_manifest()
    out = []
    checks = []
    jobs = [(p, "actual", p.stem.replace("crf-", "")) for p in sorted((CACHE / "crf").glob("crf-*.pdf"))]
    jobs += [(p, "estimates", p.stem.replace("estimates-", "")) for p in sorted((CACHE / "estimates").glob("*.pdf"))]
    for path, kind, fy in jobs:
        rel = str(path.relative_to(CACHE))
        rows, summary = parse(path, kind, fy, rel, manifest.get(rel, {}).get("url", ""))
        out += rows
        gross = defaultdict(float)
        for r in rows:
            if r["line_type"] == "object":
                gross[(r["department"].lower(), r["account"])] += r["col1"]
        depts = sorted({r["department"] for r in rows})
        tot = sum(v for v in gross.values())
        print(f"{fy} {kind}: {len(rows)} lines, {len(depts)} departments, gross ${tot/1e9:.3f}B")
        for (d, acct), (v, spage) in sorted(summary.items()):
            mine = gross.get((d, acct))
            if mine is None:
                cand = [k for k in gross if k[1] == acct and (d in k[0] or k[0] in d)]
                mine = sum(gross[k] for k in cand) if cand else None
            if mine is None and d == "service nl":  # 2019-20 summary uses the short name
                mine = gross.get(("service newfoundland and labrador", acct))
            if kind == "estimates":  # printed to the dollar; a department with no capital account prints a dash
                if mine is None and v == 0:
                    continue
                ok = mine is not None and abs(mine - v) < 1
            else:
                ok = mine is not None and abs(mine - v) <= 1000 * 1.5  # summary is rounded to $000
            checks.append({"fiscal_year": fy, "kind": kind, "department": d, "account": acct, "summary": v, "parsed": mine, "ok": ok,
                           "page": spage, "source_url": manifest.get(rel, {}).get("url", ""), "source_file": rel})
    with open(CLEAN / "program_lines.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    with open(CLEAN / "program_check.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(checks[0].keys()))
        w.writeheader()
        w.writerows(checks)
    bad = [c for c in checks if not c["ok"]]
    print(f"{len(checks) - len(bad)} of {len(checks)} department totals reconcile")
    for c in bad[:30]:
        print("  ", c)


if __name__ == "__main__":
    main()

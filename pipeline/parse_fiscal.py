"""Budget against actual, the deficit and net debt: the province's own summary figures.

Two bases of accounting are published, and they are kept apart here:

  cash      The Estimates and the Report on the Program Expenditures and Revenues of the
            Consolidated Revenue Fund. Modified cash, government departments only. The Report
            says it is "prepared on a basis consistent with the Estimates", so budgeted and
            spent are like for like.
  accrual   The Public Accounts (Consolidated Summary Financial Statements, audited). Accrual,
            departments plus Crown corporations, boards and authorities. The annual surplus or
            deficit and net debt are read only from here, with the Original Budget column the
            statements print beside the actuals.

Read from each document (amounts are printed in $000 and stored in dollars):

  report          Statement of Budgetary (Requirement) Contribution: Actuals and Original Estimates
  estimates       Summary of Cash Requirements (Statement I), printed in the Estimates to Budget 2023
  statements      the same statement in Statements and Schedules from Budget 2024, with the
                  budget's Consolidated Statement of Operations and net debt
  public_accounts Consolidated Statements of Financial Position, Change in Net Debt and Operations

Also writes one row per department and year (dept_budget.csv): spent, from the Report's summary
statements; budgeted, from the Estimates as tabled; and the Original column the Report reprints.

Checks (fiscal_check.csv): every printed subtotal is recomputed, department figures are added up
to the statements' totals, and each figure printed in two documents is compared across them.
Run after parse_programs.py.
"""
import csv
import re
from collections import defaultdict

from common import CACHE, CLEAN, load_manifest, norm_space, pdf_pages

AMT = r"(\(?-?[\d,]+\)?|-)"
ROUND = 2000  # statements are rounded to $000; a recomputed subtotal may be a thousand or two out


def num(s: str) -> float:
    s = s.strip()
    if s in ("-", ""):
        return 0.0
    neg = s.startswith("(") and s.endswith(")")
    v = float(s.strip("()").replace(",", ""))
    return -v if neg else v


def amounts(line: str, label: str) -> list[float] | None:
    """The amounts printed after a label on one line, in dollars."""
    m = re.search(rf"{label}.*?((?:\s+{AMT}){{1,3}})\s*$", line)
    if not m:
        return None
    return [num(x) * 1000 for x in m[1].split()]


def printed_label(line: str) -> str:
    """The words a statement line is printed under, without its schedule reference ("Sch. 13") or amounts."""
    return norm_space(re.sub(rf"(\s+{AMT})+\s*$", "", re.sub(r"^\s*Sch\. \w+", "", line)))


def find_page(pages: list[str], *needles: str, body: str = "", head: int = 14) -> int | None:
    """The first page whose opening lines hold every needle (a title, not a mention in the notes or
    the table of contents) and whose text holds `body`."""
    for i, text in enumerate(pages):
        top = norm_space(" ".join([ln for ln in text.splitlines() if ln.strip()][:head]))
        if all(n.lower() in top.lower() for n in needles) and body in text:
            return i
    return None


def cash_statement(pages: list[str], title: str, columns: list[str]) -> tuple[dict, int] | None:
    """Revenue, gross expenditure and related revenue (current and capital) and the cash balance."""
    i = find_page(pages, title, body="Gross Expenditure")
    if i is None:
        return None
    out: dict[str, list[float]] = {}
    account = None
    for ln in pages[i].splitlines():
        s = ln.strip()
        up = s.upper()
        if up.startswith("CURRENT ACCOUNT"):
            account = "current"
        elif up.startswith("CAPITAL ACCOUNT"):
            account = "capital"
        elif up.startswith("NON-BUDGETARY"):
            break
        for label, key in (("Provincial and Federal Revenues", "revenue"), ("Gross Expenditure", "gross"),
                           ("Related [Rr]evenue", "related"), ("Net Expenditure", "net"),
                           ("Total: Net Current and Capital Expenditures", "net_expenditure"),
                           (r"TOTAL CASH .*BUDGETARY", "cash_balance")):
            if not re.match(label, s):
                continue
            vals = amounts(ln, label)
            if not vals:
                continue
            if key in ("gross", "related", "net"):
                key = f"{account}_{key}"
            if key != "cash_balance":
                vals = [abs(v) for v in vals]  # printed with or without brackets from year to year
            out.setdefault(key, vals)
    return {k: dict(zip(columns, v)) for k, v in out.items()}, i + 1


def public_accounts(pages: list[str]) -> list[dict]:
    """(measure, col, amount, page) from the three consolidated statements."""
    out = []

    def take(title: str, body: str, lines: dict[str, str], columns: list[str]) -> None:
        i = find_page(pages, "Consolidated Statement of " + title, "31 March", body=body)
        if i is None:
            return
        for ln in pages[i].splitlines():
            for label, measure in lines.items():
                if re.search(label, ln):
                    vals = amounts(ln, label)
                    if vals and len(vals) == len(columns):
                        for col, v in zip(columns, vals):
                            out.append({"measure": measure, "col": col, "amount": v, "page": i + 1, "label": printed_label(ln)})

    # "ANNUAL SURPLUS (DEFICIT)", "ANNUAL OPERATING (DEFICIT) SURPLUS", "ANNUAL OPERATING DEFICIT": the wording follows the result
    take("Operations", "Total Expense", {r"Total Revenue": "revenue", r"Total Expense": "expense",
                                         r"^\s*ANNUAL(?: \(?[A-Z]+\)?)+": "balance"}, ["actual", "budget", "prior"])
    take("Financial Position", "Total Financial Assets", {r"Total Financial Assets": "financial_assets", r"Total Liabilities": "liabilities",
                                                          r"^\s*NET DEBT\b": "net_debt"}, ["actual", "prior"])
    take("Change in Net Debt", "NET DEBT - end of period", {r"NET DEBT - end of period": "net_debt_end"}, ["actual", "budget", "prior"])
    # The province's own per-person figure, from the discussion and analysis in the same volume.
    for i, text in enumerate(pages):
        m = re.search(r"net debt per capita (?:increased|decreased) from \$([\d,]+) in (\d{4}-\d{2}) to \$([\d,]+) in (\d{4}-\d{2})",
                      norm_space(text))
        if m:
            out.append({"measure": "net_debt_per_person", "col": "actual", "amount": num(m[3]), "page": i + 1,
                        "label": "Net debt per capita"})
            break
    return out


def budget_accrual(pages: list[str]) -> list[dict]:
    """The budget's own consolidated statements (Statements and Schedules): first column is the budget."""
    out = []
    for title, body, lines in (("CONSOLIDATED STATEMENT OF OPERATIONS", "TOTAL EXPENSE", {r"TOTAL REVENUE": "revenue", r"TOTAL EXPENSE": "expense",
                                                                                  r"ANNUAL SURPLUS \(DEFICIT\)": "balance"}),
                               ("CONSOLIDATED STATEMENT OF FINANCIAL POSITION", "Total Financial Assets", {r"^\s*NET DEBT\b": "net_debt"})):
        i = find_page(pages, title, body=body)
        if i is None:
            continue
        for ln in pages[i].splitlines():
            for label, measure in lines.items():
                if re.search(label, ln) and not any(o["measure"] == measure for o in out):
                    vals = amounts(ln, label)
                    if vals:
                        out.append({"measure": measure, "col": "budget", "amount": vals[0], "page": i + 1,
                                    "label": printed_label(ln)})
    return out


def fy_of(path, prefix: str) -> str:
    return path.stem.replace(prefix, "")


def main():
    manifest = load_manifest()
    rows, checks = [], []

    def add(fy, basis, doc, rel, measure, column, amount, page, label=""):
        rows.append({"fiscal_year": fy, "basis": basis, "measure": measure, "col": column, "amount": amount, "doc": doc,
                     "label": label, "source_file": rel, "source_url": manifest.get(rel, {}).get("url", ""), "page": page})

    def check(fy, name, what, a, b, tol=ROUND):
        ok = a is not None and b is not None and abs(a - b) <= tol
        checks.append({"fiscal_year": fy, "check": name, "what": what, "a": a, "b": b, "ok": ok})

    cash = defaultdict(dict)  # (fy, doc) -> measure -> {column: amount}

    # --- the Report: actuals and the original estimates it reprints
    for path in sorted((CACHE / "crf").glob("crf-*.pdf")):
        fy, rel = fy_of(path, "crf-"), str(path.relative_to(CACHE))
        got = cash_statement(pdf_pages(path), "Statement of Budgetary", ["actual", "budget", "prior"])
        if not got:
            check(fy, "report-statement", "The Report's Statement of Budgetary Contribution was found", None, None)
            continue
        st, page = got
        cash[(fy, "report")] = st
        for measure, cols in st.items():
            for col, v in cols.items():
                if col != "prior":
                    add(fy, "cash", "report", rel, measure, col, v, page)
        for col in ("actual", "budget"):
            g = lambda k: st.get(k, {}).get(col)  # noqa: E731
            word = "actual" if col == "actual" else "original estimates"
            for acct in ("current", "capital"):
                check(fy, f"report-{acct}-net-{col}", f"Report, {word}: {acct} gross expenditure less related revenue equals the printed net expenditure",
                      g(f"{acct}_gross") - g(f"{acct}_related"), g(f"{acct}_net"))
            check(fy, f"report-net-{col}", f"Report, {word}: current and capital net expenditure add to the printed total",
                  g("current_net") + g("capital_net"), g("net_expenditure"))
            check(fy, f"report-cash-{col}", f"Report, {word}: revenue less net expenditure equals the printed cash contribution or requirement",
                  g("revenue") - g("net_expenditure"), g("cash_balance"))

    # --- the budget's own Summary of Cash Requirements, and its consolidated statements
    for folder, prefix, doc in (("estimates", "estimates-", "estimates"), ("budget", "statements-", "statements")):
        for path in sorted((CACHE / folder).glob(f"{prefix}*.pdf")):
            fy, rel = fy_of(path, prefix), str(path.relative_to(CACHE))
            pages = pdf_pages(path)
            got = cash_statement(pages, "SUMMARY OF CASH REQUIREMENTS", ["budget", "revised_prior"])
            if got:
                st, page = got
                cash[(fy, "budget")] = st
                for measure, cols in st.items():
                    add(fy, "cash", doc, rel, measure, "budget", cols["budget"], page)
            if doc == "statements":
                for r in budget_accrual(pages):
                    add(fy, "accrual", doc, rel, r["measure"], r["col"], r["amount"], r["page"], r["label"])

    # --- the Public Accounts
    pa = defaultdict(dict)  # fy -> (measure, column) -> amount
    for path in sorted((CACHE / "public-accounts").glob("public-accounts-*.pdf")):
        fy, rel = fy_of(path, "public-accounts-"), str(path.relative_to(CACHE))
        for r in public_accounts(pdf_pages(path)):
            pa[fy][(r["measure"], r["col"])] = r["amount"]
            add(fy, "accrual", "public_accounts", rel, r["measure"], r["col"], r["amount"], r["page"], r["label"])
        p = pa[fy]
        for col, word in (("actual", "actual"), ("budget", "original budget")):
            check(fy, f"accounts-balance-{col}", f"Public Accounts, {word}: total revenue less total expense equals the printed annual surplus or deficit",
                  p.get(("revenue", col), 0) - p.get(("expense", col), 0) if ("revenue", col) in p else None, p.get(("balance", col)))
        check(fy, "accounts-net-debt", "Public Accounts: total liabilities less total financial assets equals the printed net debt",
              p.get(("liabilities", "actual"), 0) - p.get(("financial_assets", "actual"), 0) if ("liabilities", "actual") in p else None,
              p.get(("net_debt", "actual")))
        check(fy, "accounts-net-debt-statements", "Public Accounts: net debt is the same in the Statement of Financial Position and the Statement of Change in Net Debt",
              p.get(("net_debt", "actual")), p.get(("net_debt_end", "actual")), 0)

    # --- departments: spent (the Report's summary statements) against budgeted (the Estimates as tabled)
    lines = list(csv.DictReader(open(CLEAN / "program_lines.csv", newline="")))
    summary = list(csv.DictReader(open(CLEAN / "program_check.csv", newline="")))
    est, est_page, est_src = defaultdict(float), {}, {}
    orig, amended, parsed_names = defaultdict(float), defaultdict(float), {}
    for r in lines:
        if r["line_type"] != "object":
            continue
        k = (r["fiscal_year"], r["department"].lower())
        parsed_names[k] = r["department"]
        if r["kind"] == "estimates":
            est[k] += float(r["col1"])
            est_src[k] = (r["source_file"], r["source_url"])
        else:
            amended[k] += float(r["col2"])
            orig[k] += float(r["col3"])
    spent, spent_src = defaultdict(float), {}
    for r in summary:
        k = (r["fiscal_year"], r["department"])
        if r["kind"] == "estimates":
            est_page[k] = int(r["page"])
        else:
            spent[k] += float(r["summary"])
            if k not in spent_src or int(r["page"]) < spent_src[k][2]:  # the current account statement comes first
                spent_src[k] = (r["source_file"], r["source_url"], int(r["page"]))

    def report_name(fy: str, d: str) -> str:
        """The summary statement sometimes prints a shorter name than the department's own pages."""
        if (fy, d) in orig or (fy, d) in est:
            return d
        cand = [k[1] for k in list(orig) + list(est) if k[0] == fy and (d in k[1] or k[1] in d)]
        return cand[0] if cand else {"service nl": "service newfoundland and labrador"}.get(d, d)

    depts = []
    years = sorted({k[0] for k in list(spent) + list(est)})
    for fy in years:
        names = {report_name(fy, d): d for (y, d) in spent if y == fy}
        for d in sorted(set(names) | {k[1] for k in est if k[0] == fy}):
            k, sk = (fy, d), (fy, names.get(d, d))
            has_report = sk in spent
            budget, budget_doc = (est[k], "estimates") if k in est else (orig.get(k), "report")
            depts.append({
                "fiscal_year": fy, "department": parsed_names.get(k) or d.title(),
                "spent": spent[sk] if has_report else "", "budget": budget if budget is not None else "", "budget_doc": budget_doc,
                "report_original": orig.get(k, "") if has_report else "", "report_amended": amended.get(k, "") if has_report else "",
                "spent_file": spent_src[sk][0] if has_report else "", "spent_url": spent_src[sk][1] if has_report else "",
                "spent_page": spent_src[sk][2] if has_report else "",
                "budget_file": est_src.get(k, ("", ""))[0], "budget_url": est_src.get(k, ("", ""))[1], "budget_page": est_page.get(k, ""),
            })

    # --- checks across documents
    for fy in years:
        rep, bud = cash.get((fy, "report")), cash.get((fy, "budget"))
        mine = [d for d in depts if d["fiscal_year"] == fy]
        est_total = sum(d["budget"] for d in mine if d["budget_doc"] == "estimates")
        n = len(mine)
        if bud:
            check(fy, "estimates-departments", "Estimates: the departments' program lines add to the gross expenditure in the budget's Summary of Cash Requirements",
                  est_total, bud["current_gross"]["budget"] + bud["capital_gross"]["budget"], 500 * n)
        if rep:
            check(fy, "report-departments", "Report: the departments in the summary statements add to the gross expenditure in the Statement of Budgetary Contribution",
                  sum(d["spent"] for d in mine if d["spent"] != ""), rep["current_gross"]["actual"] + rep["capital_gross"]["actual"], 500 * n)
        if rep and bud:
            for m, word in (("revenue", "revenue"), ("current_gross", "current gross expenditure"), ("capital_gross", "capital gross expenditure"),
                            ("current_related", "current related revenue"), ("capital_related", "capital related revenue"),
                            ("cash_balance", "cash requirement")):
                check(fy, f"original-{m}", f"The Report's Original Estimates column equals the budget's Summary of Cash Requirements: {word}",
                      rep[m]["budget"], bud[m]["budget"], 0)
        for d in mine:
            if d["spent"] != "" and d["budget_doc"] == "estimates":
                check(fy, "original-department", f"{d['department']}: the Original column the Report reprints equals the Estimates as tabled",
                      d["report_original"] if d["report_original"] != "" else None, d["budget"], 0.5)
        p = pa.get(fy)
        if p:
            nxt = pa.get(f"{int(fy[:4]) + 1}-{(int(fy[5:]) + 1) % 100:02d}")
            if nxt:
                for m, word in (("balance", "annual surplus or deficit"), ("net_debt", "net debt")):
                    a, b = p.get((m, "actual")), nxt.get((m, "prior"))
                    if a is not None and b is not None and a != b:
                        rel = f"public-accounts/public-accounts-{int(fy[:4]) + 1}-{(int(fy[5:]) + 1) % 100:02d}.pdf"
                        page = next(r["page"] for r in rows if r["source_file"] == rel and r["measure"] == m and r["col"] == "prior")
                        add(fy, "accrual", "public_accounts", rel, m, "restated", b, page, f"{word}, as restated in the following year's Public Accounts")
            stm = {r["measure"]: r["amount"] for r in rows if r["fiscal_year"] == fy and r["doc"] == "statements" and r["basis"] == "accrual"}
            for m, pm, word in (("revenue", "revenue", "total revenue"), ("expense", "expense", "total expense"),
                                ("balance", "balance", "annual surplus or deficit"), ("net_debt", "net_debt_end", "net debt")):
                if m in stm:
                    check(fy, f"budget-{m}", f"The Public Accounts' Original Budget column equals the budget's own statements: {word}",
                          p.get((pm, "budget")), stm[m], 0)

    for name, data in (("fiscal.csv", rows), ("fiscal_check.csv", checks), ("dept_budget.csv", depts)):
        with open(CLEAN / name, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(data[0].keys()))
            w.writeheader()
            w.writerows(data)

    bad = [c for c in checks if not c["ok"]]
    print(f"fiscal: {len(rows)} figures from {len({r['source_file'] for r in rows})} documents; {len(depts)} department-years; "
          f"{len(checks) - len(bad)} of {len(checks)} checks hold")
    for c in bad:
        print("  ", c["fiscal_year"], c["what"], f"{c['a']:,.0f}" if c["a"] is not None else "not found", "against",
              f"{c['b']:,.0f}" if c["b"] is not None else "not found")


if __name__ == "__main__":
    main()

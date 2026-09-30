// Budget against actual, the surplus or deficit and net debt, per fiscal year, from the pipeline's
// fiscal and dept_budget tables (pipeline/parse_fiscal.py). One structure for the home page, the
// budget pages and the AI server, so every surface gives the same figure for the same thing.
//
// Two bases, never mixed in one sum:
//   cash      Estimates against the Report on the Program Expenditures and Revenues (modified cash, departments)
//   accounts  the Public Accounts (accrual, every government body): revenue, expense, surplus or deficit, net debt

export const DOCS = {
  report: "Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund",
  estimates: "Estimates of the Program Expenditure and Revenue of the Consolidated Revenue Fund",
  statements: "Budget, Statements and Schedules",
  public_accounts: "Public Accounts, Consolidated Summary Financial Statements",
};

export function buildBudget(D) {
  const rows = D.q("SELECT * FROM fiscal");
  const get = (fy, basis, measure, col, docs) => {
    for (const doc of docs) {
      const r = rows.find((x) => x.fiscal_year === fy && x.basis === basis && x.measure === measure && x.col === col && x.doc === doc);
      if (r) return r;
    }
    return null;
  };
  const src = (r) => (r ? { doc: r.doc, url: r.source_url, page: r.page } : null);
  const BUDGET_DOCS = ["statements", "estimates", "report"]; // the budget's own statement first; the Report reprints it
  const fys = [...new Set(rows.map((r) => r.fiscal_year))].sort();

  const years = fys.map((fy) => {
    // ---- cash: what departments were given and what they spent
    const line = (measure) => {
      const b = get(fy, "cash", measure, "budget", BUDGET_DOCS);
      const a = get(fy, "cash", measure, "actual", ["report"]);
      return { budget: b?.amount ?? null, actual: a?.amount ?? null };
    };
    const current = line("current_gross");
    const capital = line("capital_gross");
    const sum = (k) => (current[k] == null ? null : current[k] + capital[k]);
    const related = { budget: null, actual: null };
    for (const k of ["budget", "actual"]) {
      const a = line("current_related")[k], b = line("capital_related")[k];
      related[k] = a == null ? null : a + b;
    }
    const gross = { budget: sum("budget"), actual: sum("actual") };
    const diff = (x) => (x.actual == null || x.budget == null ? null : x.actual - x.budget);
    const cash = {
      current, capital, gross, related, revenue: line("revenue"), cash_balance: line("cash_balance"),
      difference: diff(gross), share: gross.actual == null ? null : (gross.actual - gross.budget) / gross.budget,
      budget_source: src(get(fy, "cash", "current_gross", "budget", BUDGET_DOCS)),
      actual_source: src(get(fy, "cash", "current_gross", "actual", ["report"])),
    };

    // ---- accounts: how the year ended for the whole government
    const acct = (measure, budgetMeasure = measure) => {
      const a = get(fy, "accrual", measure, "actual", ["public_accounts"]);
      const b = get(fy, "accrual", budgetMeasure, "budget", ["public_accounts", "statements"]);
      const r = get(fy, "accrual", measure, "restated", ["public_accounts"]);
      return { budget: b?.amount ?? null, actual: a?.amount ?? null, restated: r?.amount ?? null,
        source: src(a), budget_source: src(b), restated_source: src(r) };
    };
    const perPerson = get(fy, "accrual", "net_debt_per_person", "actual", ["public_accounts"]);
    const accounts = {
      revenue: acct("revenue"), expense: acct("expense"), balance: acct("balance"),
      net_debt: { ...acct("net_debt", "net_debt_end"), budget: (get(fy, "accrual", "net_debt_end", "budget", ["public_accounts"]) || get(fy, "accrual", "net_debt", "budget", ["statements"]))?.amount ?? null,
        budget_source: src(get(fy, "accrual", "net_debt_end", "budget", ["public_accounts"]) || get(fy, "accrual", "net_debt", "budget", ["statements"])) },
      net_debt_per_person: perPerson ? { value: perPerson.amount, source: src(perPerson) } : null,
      published: !!get(fy, "accrual", "balance", "actual", ["public_accounts"]),
    };

    // ---- departments, largest difference first
    // The Report prints a department's spending to the nearest $1,000, so a difference is good to the nearest $1,000.
    const departments = D.q("SELECT * FROM dept_budget WHERE fiscal_year=?", fy).map((d) => ({
      name: d.department, slug: D.slug(d.department), budget: d.budget, spent: d.spent,
      difference: d.spent == null || d.budget == null ? null : Math.round((d.spent - d.budget) / 1000) * 1000,
      share: d.spent == null || !d.budget ? null : (d.spent - d.budget) / d.budget,
      amended: d.report_amended, budget_doc: d.budget_doc,
      budget_source: d.budget_url ? { doc: d.budget_doc, url: d.budget_url, page: d.budget_page } : null,
      spent_source: d.spent_url ? { doc: "report", url: d.spent_url, page: d.spent_page } : null,
    })).sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0) || (b.budget ?? 0) - (a.budget ?? 0));

    return { year: fy, spent_published: gross.actual != null, cash, accounts, departments };
  });

  const checks = D.q("SELECT * FROM fiscal_checks");
  const tally = (prefix) => {
    const mine = checks.filter((c) => c.name.startsWith(prefix));
    return { ok: mine.filter((c) => c.ok).length, n: mine.length };
  };
  return {
    years,
    latest: years.filter((y) => y.spent_published && y.accounts.published).pop(),
    checks: {
      statement: tally("report-c").ok + tally("report-n").ok, statement_n: tally("report-c").n + tally("report-n").n,
      original: tally("original-c").ok + tally("original-r").ok, original_n: tally("original-c").n + tally("original-r").n,
      departments: tally("original-department"), estimates: tally("estimates-departments"), report: tally("report-departments"),
      accounts: tally("accounts-"), budget: tally("budget-"),
      failed: checks.filter((c) => !c.ok).map((c) => ({ year: c.fiscal_year, what: c.what, a: c.a, b: c.b })),
    },
  };
}

// The same figures as plain JSON for the AI server (/data/budget.json): every figure with its source link.
export function budgetJSON(B) {
  const link = (s) => (s ? `${s.url}#page=${s.page}` : undefined);
  const pair = (x, extra = {}) => ({ budget: x.budget, actual: x.actual, difference: x.actual == null || x.budget == null ? null : x.actual - x.budget, ...extra });
  return {
    latest_year: B.latest.year,
    bases: {
      departments: "Modified cash, government departments only: the Estimates the House of Assembly was given with the budget, against the Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund. Gross expenditure, before the revenue departments collect against their own spending.",
      whole_government: "Accrual, departments plus Crown corporations, boards and authorities: the audited Public Accounts. The surplus or deficit and net debt are only on this basis. Do not add or subtract figures across the two bases.",
    },
    years: Object.fromEntries(B.years.map((y) => [y.year, {
      departments_spending: y.cash.gross.budget == null ? undefined : {
        basis: "modified cash, departments",
        gross: pair(y.cash.gross), current_account: pair(y.cash.current), capital_account: pair(y.cash.capital),
        related_revenue: pair(y.cash.related), provincial_and_federal_revenue: pair(y.cash.revenue), cash_balance: pair(y.cash.cash_balance),
        budget_source: link(y.cash.budget_source), actual_source: link(y.cash.actual_source),
        actual_status: y.spent_published ? "published" : "not yet published",
      },
      whole_government: {
        basis: "accrual, all government bodies",
        revenue: pair(y.accounts.revenue), expense: pair(y.accounts.expense),
        surplus_or_deficit: pair(y.accounts.balance, { note: "negative is a deficit", restated_next_year: y.accounts.balance.restated ?? undefined }),
        net_debt: pair(y.accounts.net_debt, { restated_next_year: y.accounts.net_debt.restated ?? undefined }),
        net_debt_per_person: y.accounts.net_debt_per_person?.value,
        actual_source: link(y.accounts.balance.source), net_debt_source: link(y.accounts.net_debt.source),
        budget_source: link(y.accounts.balance.budget_source),
        actual_status: y.accounts.published ? "published" : "not yet published",
      },
      departments: y.departments.map((d) => ({
        department: d.name, budget: d.budget, spent: d.spent, difference: d.difference, amended_estimate: d.amended ?? undefined,
        budget_source: link(d.budget_source), spent_source: link(d.spent_source),
      })),
    }])),
  };
}

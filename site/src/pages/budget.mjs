// Budget against actual: what the House was given with the budget, what departments spent, and how
// the year ended (surplus or deficit, net debt). Two bases of accounting, shown side by side and never
// added together. Figures come from site/src/budgetdata.mjs.
import { esc, html, icon, Notes, leaders, bar, receipt } from "../../lib/html.mjs";
import { money, moneyWords, num, SITE } from "../../lib/format.mjs";
import { desc, datasetLd, LICENSE } from "../seo.mjs";
import { pagehead } from "../common.mjs";
import { DOCS } from "../budgetdata.mjs";
import { LICENCES, DOCUMENT_LICENCE } from "../licences.mjs";

// "$11.01 billion", "$368 million": two decimals in the billions so a difference of a few hundred million shows.
export const words = (v) => (v == null ? "" : Math.abs(v) >= 1e9 ? `$${(Math.abs(v) / 1e9).toFixed(2)} billion` : moneyWords(Math.abs(v)));
// A figure in a schedule: a negative one in parentheses (red ink, by the `neg` class).
// In a `tight` schedule on a phone the unit is set as one letter ("$11.01B"), so three figures fit beside a label.
const unit = (t) => t.replace(/ (billion|million)$/, (m, u) => `<span class="unit" data-s="${u[0].toUpperCase()}">${m}</span>`);
const cell = (v, extra = "") => (v == null ? `<td class="n muted${extra}">not yet<span class="unit" data-s=""> published</span></td>` : `<td class="n${v < 0 ? " neg" : ""}${extra}">${v < 0 ? `(${unit(words(v))})` : unit(words(v))}</td>`);
const share = (v) => (v == null ? "" : `${v < 0 ? "(" : ""}${(Math.abs(v) * 100).toFixed(1)}%${v < 0 ? ")" : ""}`);
const march = (fy) => `31 March ${Number(fy.slice(0, 4)) + 1}`;
const rcpt = (s) => (s ? receipt(s.url, s.page, DOCS[s.doc]) : "");
const docName = (s, fy) => `${DOCS[s.doc]}${s.doc === "public_accounts" ? ` for the year ended ${march(fy)}` : ` ${fy}`}`;

// Over or under, in words, for a sentence.
const overUnder = (d) => (d < 0 ? "under" : "over");

// ---- the row under the home page's headline figure
export function coverLedger(y, notes) {
  const c = y.cash, a = y.accounts;
  const citeBudget = notes.cite({ url: c.budget_source.url, page: c.budget_source.page, label: `${docName(c.budget_source, y.year)}, Summary of Cash Requirements: gross expenditure, current account ${money(c.current.budget)} and capital account ${money(c.capital.budget)}` });
  const citeSpent = notes.cite({ url: c.actual_source.url, page: c.actual_source.page, label: `${docName(c.actual_source, y.year)}, Statement of Budgetary Contribution: gross expenditure, current account ${money(c.current.actual)} and capital account ${money(c.capital.actual)} (Actuals), against ${money(c.current.budget)} and ${money(c.capital.budget)} (Original Estimates)` });
  const citeBal = notes.cite({ url: a.balance.source.url, page: a.balance.source.page, label: `${docName(a.balance.source, y.year)}, Consolidated Statement of Operations: annual ${a.balance.actual < 0 ? "deficit" : "surplus"} ${money(Math.abs(a.balance.actual))} (Actuals), ${money(Math.abs(a.balance.budget))} (Original Budget)` });
  const citeDebt = notes.cite({ url: a.net_debt.source.url, page: a.net_debt.source.page, label: `${docName(a.net_debt.source, y.year)}, Consolidated Statement of Financial Position: net debt ${money(a.net_debt.actual)}` });
  const pp = a.net_debt_per_person;
  const citePP = pp ? notes.cite({ url: pp.source.url, page: pp.source.page, label: `${docName(pp.source, y.year)}, financial statement discussion and analysis: net debt per capita ${money(pp.value)}` }) : "";
  const deficit = a.balance.actual < 0;
  const item = (label, fig, note) => `<div><dt>${label}</dt><dd><span class="fig">${fig}</span><span class="note">${note}</span></dd></div>`;
  return html`<div class="cover-ledger">
  <dl aria-label="Departments' spending against the budget, ${y.year}">
    ${item("Budgeted", `${moneyWords(c.gross.budget)}${citeBudget}`, "in the spring Estimates")}
    ${item("Spent", `${moneyWords(c.gross.actual)}${citeSpent}`, "by departments")}
    ${item(c.difference < 0 ? "Under budget" : "Over budget", moneyWords(Math.abs(c.difference)), `${(Math.abs(c.share) * 100).toFixed(1)}% ${c.difference < 0 ? "less" : "more"} than budgeted`)}
  </dl>
  <dl aria-label="How the year ended for the whole government, ${y.year}">
    ${item(deficit ? "Deficit" : "Surplus", `${moneyWords(Math.abs(a.balance.actual))}${citeBal}`, `budget forecast: ${moneyWords(Math.abs(a.balance.budget))}${(a.balance.budget < 0) === deficit ? "" : a.balance.budget < 0 ? " deficit" : " surplus"}`)}
    ${item("Net debt", `${moneyWords(a.net_debt.actual)}${citeDebt}`, pp ? `${money(pp.value)} a person${citePP}` : `at ${march(y.year)}`)}
  </dl>
  <p class="cover-ledger-more"><a href="/budget/">Budget against actual, department by department ${icon("arrow")}</a></p>
</div>`;
}

// ---- one year's page
function yearPage(D, B, y, isLatest) {
  const notes = new Notes();
  const fy = y.year;
  const c = y.cash, a = y.accounts;
  const deficit = a.balance.actual < 0;
  const citeBudget = notes.cite({ url: c.budget_source.url, page: c.budget_source.page, label: `${docName(c.budget_source, fy)}, Summary of Cash Requirements (Statement I): gross expenditure, current account ${money(c.current.budget)} and capital account ${money(c.capital.budget)}` });
  const citeSpent = notes.cite({ url: c.actual_source.url, page: c.actual_source.page, label: `${docName(c.actual_source, fy)}, Statement of Budgetary Contribution: gross expenditure, current account ${money(c.current.actual)} and capital account ${money(c.capital.actual)} (Actuals); the Original Estimates column beside them reprints the budget's figures` });
  const citeOps = notes.cite({ url: a.balance.source.url, page: a.balance.source.page, label: `${docName(a.balance.source, fy)}, Consolidated Statement of Operations: total revenue ${money(a.revenue.actual)}, total expense ${money(a.expense.actual)}, annual ${deficit ? "deficit" : "surplus"} ${money(Math.abs(a.balance.actual))} (Actuals); ${money(a.revenue.budget)}, ${money(a.expense.budget)} and ${money(Math.abs(a.balance.budget))} (Original Budget, unaudited)` });
  const citeDebt = notes.cite({ url: a.net_debt.source.url, page: a.net_debt.source.page, label: `${docName(a.net_debt.source, fy)}, Consolidated Statement of Financial Position: net debt ${money(a.net_debt.actual)} at ${march(fy)}` });
  const citeDebtBudget = a.net_debt.budget_source ? notes.cite({ url: a.net_debt.budget_source.url, page: a.net_debt.budget_source.page, label: `${docName(a.net_debt.budget_source, fy)}, Consolidated Statement of Change in Net Debt: net debt at the end of the period ${money(a.net_debt.budget)} (Original Budget)` }) : "";
  const pp = a.net_debt_per_person;
  const citePP = pp ? notes.cite({ url: pp.source.url, page: pp.source.page, label: `${docName(pp.source, fy)}, financial statement discussion and analysis: net debt per capita ${money(pp.value)}` }) : "";

  const lede = `The budget for ${fy} planned ${words(c.gross.budget)} of spending by government departments${citeBudget}. They spent ${words(c.gross.actual)}${citeSpent}, ${words(c.difference)} ${overUnder(c.difference)} the plan. Across the whole government the year ended with a ${deficit ? "deficit" : "surplus"} of ${words(a.balance.actual)}${citeOps} and net debt of ${words(a.net_debt.actual)}${citeDebt}.`;

  const published = B.years.filter((x) => x.spent_published && x.accounts.published);
  const yearNav = html`<nav aria-label="Fiscal year"><ul class="chips">${published.map((x) => `<li><a href="${x === B.latest ? "/budget/" : `/budget/${x.year}/`}"${x === y ? ' aria-current="page"' : ""}>${x.year}</a></li>`)}</ul></nav>`;

  // The province's own cash statement: budgeted, spent, the difference.
  const need = { budget: -c.cash_balance.budget, actual: -c.cash_balance.actual }; // a requirement is printed as a negative contribution
  const cashRow = (label, x, cls = "") => html`<tr${cls ? ` class="${cls}"` : ""}><th scope="row">${label}</th>${cell(x.budget)}${cell(x.actual)}${cell(x.actual - x.budget)}</tr>`;
  const cashTable = html`<div class="sched-wrap"><table class="sched stmt tight">
    <caption>What departments were given, and what they spent</caption>
    <thead><tr><th scope="col"><span class="vh">Line</span></th><th scope="col" class="n">Budgeted</th><th scope="col" class="n">Spent</th><th scope="col" class="n">Over (under)</th></tr></thead>
    <tbody>
      ${cashRow(`Current account<span class="meta">salaries, supplies, operating grants, interest</span>`, c.current)}
      ${cashRow(`Capital account<span class="meta">construction, infrastructure, major equipment, loans</span>`, c.capital)}
      <tr class="total"><th scope="row">Spending by departments</th>${cell(c.gross.budget)}${cell(c.gross.actual)}${cell(c.difference)}</tr>
      ${cashRow(`Revenue tied to that spending<span class="meta">federal cost-sharing, fees; "related revenue"</span>`, c.related)}
      ${cashRow(`Other provincial and federal revenue<span class="meta">taxes, royalties, transfers</span>`, c.revenue)}
      ${cashRow(`Cash ${need.actual < 0 ? "left over" : "requirement"}<span class="meta">spending the revenue did not cover</span>`, need)}
    </tbody>
  </table></div>
  <p class="small muted">Modified cash basis, government departments only: the basis the House of Assembly votes on. Budgeted: ${esc(DOCS[c.budget_source.doc])} ${fy}, ${rcpt(c.budget_source)}. Spent: ${esc(DOCS.report)} ${fy}, ${rcpt(c.actual_source)}.</p>`;

  const acctRow = (label, x, cls = "") => html`<tr${cls ? ` class="${cls}"` : ""}><th scope="row">${label}</th>${cell(x.budget)}${cell(x.actual)}${cell(x.actual - x.budget)}</tr>`;
  const acctTable = html`<div class="sched-wrap"><table class="sched stmt tight">
    <caption>How the year ended for the whole government</caption>
    <thead><tr><th scope="col"><span class="vh">Line</span></th><th scope="col" class="n">Budget</th><th scope="col" class="n">Actual</th><th scope="col" class="n">Difference</th></tr></thead>
    <tbody>
      ${acctRow("Revenue", a.revenue)}
      ${acctRow("Expense", a.expense)}
      <tr class="total"><th scope="row">Surplus or (deficit)</th>${cell(a.balance.budget)}${cell(a.balance.actual)}${cell(a.balance.actual - a.balance.budget)}</tr>
      ${acctRow(`Net debt at ${march(fy)}${citeDebtBudget}<span class="meta">what is owed, less financial assets held</span>`, a.net_debt)}
    </tbody>
  </table></div>
  <p class="small muted">Accrual basis, audited: departments together with Crown corporations, boards and authorities. ${esc(DOCS.public_accounts)}, ${rcpt(a.balance.source)} and ${rcpt(a.net_debt.source)}. The budget column is the Original Budget the statements print, unaudited.${pp ? ` Net debt for each person in the province, as the province works it out: <strong>${money(pp.value)}</strong>${citePP}.` : ""}</p>`;

  // Departments, largest difference first. A department links to its page when it has one under this name.
  const pages = new Set(D.years.flatMap((yr) => D.deptYear[yr].map((d) => D.slug(d.name))));
  const depts = y.departments.filter((d) => d.spent != null);
  const maxDiff = Math.max(...depts.map((d) => Math.abs(d.difference ?? 0)), 1);
  const dv = (d) => {
    if (d.difference == null) return "";
    const w = Math.max(0.6, (Math.abs(d.difference) / maxDiff) * 50);
    return `<span class="dv" aria-hidden="true"><span class="${d.difference < 0 ? "under" : "over"}" style="inline-size:${w.toFixed(2)}%"></span></span>`;
  };
  const fromReport = depts.filter((d) => d.budget_doc === "report");
  const deptTable = html`<ul class="legend"><li><span class="sw"></span>Spent over the budget</li><li><span class="sw ghost"></span>Budget not spent</li></ul>
  <div class="sched-wrap"><table class="sched">
    <thead><tr><th scope="col">Department</th><th scope="col" class="hide-sm" style="inline-size:24%"><span class="dv-ends"><span>Under</span><span>Over</span></span></th><th scope="col" class="n hide-sm">Budgeted</th><th scope="col" class="n hide-sm">Spent</th><th scope="col" class="n">Over (under)</th><th scope="col" class="n">%</th><th scope="col" class="n hide-sm">Source</th></tr></thead>
    <tbody>${depts.map((d) => html`<tr>
      <th scope="row">${pages.has(d.slug) ? `<a href="/department/${d.slug}/">${esc(d.name)}</a>` : esc(d.name)}<span class="meta show-sm">${words(d.budget)} budgeted, ${words(d.spent)} spent</span></th>
      <td class="hide-sm">${dv(d)}</td>
      ${cell(d.budget, " hide-sm")}${cell(d.spent, " hide-sm")}${cell(d.difference)}
      <td class="n${d.share < 0 ? " neg" : ""}">${share(d.share)}</td>
      <td class="n hide-sm">${rcpt(d.budget_source)} · ${rcpt(d.spent_source)}</td></tr>`)}</tbody>
    <tfoot><tr class="total"><th scope="row">All ${depts.length} departments</th><td class="hide-sm"></td>${cell(c.gross.budget, " hide-sm")}${cell(c.gross.actual, " hide-sm")}${cell(c.difference)}<td class="n${c.share < 0 ? " neg" : ""}">${share(c.share)}</td><td class="hide-sm"></td></tr></tfoot>
  </table></div>
  <p class="small muted">Gross spending, before the revenue departments collect against their own spending. Budgeted is the department's total in the Estimates given to the House with the budget (first source link); spent is its total in the Report's summary statements (second link). Amounts in parentheses are spending below the budget. A department can be given more, or less, during the year; those amended estimates are on each department's page.${fromReport.length ? ` ${fromReport.map((d) => esc(d.name)).join(", ")}: not in that year's Estimates under this name, so the budget is the Original column of the Report.` : ""}</p>`;

  // Year by year (on the main page only).
  const maxYear = Math.max(...B.years.map((x) => Math.max(x.cash.gross.budget || 0, x.cash.gross.actual || 0)));
  const yearLink = (x) => (x.spent_published && x.accounts.published ? `<a href="${x === B.latest ? "/budget/" : `/budget/${x.year}/`}">${x.year}</a>` : x.year);
  const restated = B.years.filter((x) => x.accounts.balance.restated != null || x.accounts.net_debt.restated != null);
  const accord = B.years.find((x) => x.year === "2019-20")?.accounts.balance.source;
  const trend = !isLatest ? "" : html`
<section class="section" id="years"><div class="wrap">
  <div class="section-head"><h2>Year by year</h2>
  <p>Each year as its own documents printed it. The two newest budgets have no published results yet.</p></div>
  <ul class="legend"><li><span class="sw"></span>Spent</li><li><span class="sw ghost"></span>Budgeted</li></ul>
  <div class="sched-wrap"><table class="sched tight">
    <caption>Spending by departments</caption>
    <thead><tr><th scope="col">Fiscal year</th><th scope="col" class="hide-sm" style="inline-size:30%">Spent against budget</th><th scope="col" class="n">Budgeted</th><th scope="col" class="n">Spent</th><th scope="col" class="n">Over (under)</th><th scope="col" class="n hide-sm">%</th><th scope="col" class="n hide-sm">Source</th></tr></thead>
    <tbody>${B.years.filter((x) => x.cash.gross.budget != null).map((x) => html`<tr>
      <th scope="row">${yearLink(x)}</th>
      <td class="hide-sm"><span class="pair">${x.cash.gross.actual != null ? bar(x.cash.gross.actual, maxYear) : '<span class="bar"></span>'}${bar(x.cash.gross.budget, maxYear, "ghost")}</span></td>
      ${cell(x.cash.gross.budget)}${cell(x.cash.gross.actual)}${x.cash.difference == null ? '<td class="n"></td>' : cell(x.cash.difference)}
      <td class="n hide-sm${x.cash.share < 0 ? " neg" : ""}">${share(x.cash.share)}</td>
      <td class="n hide-sm">${[rcpt(x.cash.budget_source), rcpt(x.cash.actual_source)].filter(Boolean).join(" · ")}</td></tr>`)}</tbody>
  </table></div>
  <div class="sched-wrap" style="margin-block-start:2.5rem"><table class="sched tight">
    <caption>Surplus or deficit, and net debt, for the whole government</caption>
    <thead><tr><th scope="col">Fiscal year</th><th scope="col" class="n">Budget</th><th scope="col" class="n">Actual</th><th scope="col" class="n hide-sm">Difference</th><th scope="col" class="n">Net debt at year end</th><th scope="col" class="n hide-sm">Per person</th><th scope="col" class="n hide-sm">Source</th></tr></thead>
    <tbody>${B.years.map((x) => { const b = x.accounts.balance, nd = x.accounts.net_debt; return html`<tr>
      <th scope="row">${yearLink(x)}</th>
      ${cell(b.budget)}${cell(b.actual)}${b.actual == null ? '<td class="n hide-sm"></td>' : cell(b.actual - b.budget, " hide-sm")}
      ${nd.actual == null ? `<td class="n muted">${unit(words(nd.budget))}<span class="meta">budgeted</span></td>` : cell(nd.actual)}
      <td class="n hide-sm">${x.accounts.net_debt_per_person ? money(x.accounts.net_debt_per_person.value) : ""}</td>
      <td class="n hide-sm">${[rcpt(b.source || b.budget_source), rcpt(nd.source)].filter(Boolean).join(" · ")}</td></tr>`; })}</tbody>
  </table></div>
  <p class="small muted">A surplus is printed plain and a deficit in parentheses.${accord ? ` The 2019-20 Public Accounts put that year's surplus down "in large part" to the Atlantic Accord (2019) (${rcpt({ ...accord, page: null })}).` : ""}${restated.length ? ` Later accounts restated some of these figures: ${restated.map((x) => `${x.year} ${[x.accounts.balance.restated != null ? `${x.accounts.balance.restated < 0 ? "deficit" : "surplus"} to ${words(x.accounts.balance.restated)} (${rcpt(x.accounts.balance.restated_source)})` : "", x.accounts.net_debt.restated != null ? `net debt to ${words(x.accounts.net_debt.restated)} (${rcpt(x.accounts.net_debt.restated_source)})` : ""].filter(Boolean).join(" and ")}`).join("; ")}. The table shows each year as first published.` : ""}</p>
</div></section>`;

  const K = B.checks;
  const checks = !isLatest ? "" : html`
<section class="section" id="checks"><div class="wrap grid-2">
  <div><div class="section-head"><h2>How these figures were checked</h2>
  <p>Every figure here is read by a script from the province's own documents, then added up and compared with what those documents print. <a href="/method/budget/">How the budget and the accounts line up</a>.</p></div>
  ${K.failed.length ? html`<p class="small">Where a check does not hold, the province's documents disagree with each other:</p><ul class="prose small">${K.failed.map((f) => `<li>${esc(f.what.split(":")[0])}, ${f.year}: the Report's Original column adds to ${f.a == null ? "nothing, because it prints no detail for the department" : money(f.a)}; the Estimates say ${money(f.b)}. The Estimates' figure is used.</li>`)}</ul>` : ""}</div>
  <div>${leaders([
    { label: "Subtotals of the Report's cash statement that recompute", value: `${K.statement} of ${K.statement_n}` },
    { label: "Years the departments add to the Report's total", value: `${K.report.ok} of ${K.report.n}` },
    { label: "Years the departments add to the Estimates' total", value: `${K.estimates.ok} of ${K.estimates.n}` },
    { label: "Budget figures the same in the Report and the budget", value: `${K.original} of ${K.original_n}` },
    { label: "Department budgets the same in the Report and the Estimates", value: `${K.departments.ok} of ${K.departments.n}` },
    { label: "Public Accounts totals that recompute", value: `${K.accounts.ok} of ${K.accounts.n}` },
  ])}</div>
</div></section>`;

  const body = html`
${pagehead({ crumbs: isLatest ? [["/", "Home"], [null, "Budget against actual"]] : [["/", "Home"], ["/budget/", "Budget against actual"], [null, fy]], title: `Budget against actual, ${fy}`, lede, extra: yearNav })}
<section class="section"><div class="wrap">
  <div class="grid-2 stmts">
    <div>${cashTable}</div>
    <div>${acctTable}</div>
  </div>
  <div class="prose" style="margin-block-start:2rem">
    <h3>Two ways of counting, side by side</h3>
    <p>The first statement counts cash paid by government departments, which is what the House of Assembly votes on. The second is the audited result for the whole government: it adds Newfoundland and Labrador Health Services, Memorial University, Newfoundland and Labrador Hydro and the other public bodies the province controls, and records costs when they are incurred, not when they are paid. The province publishes both. A figure from one cannot be added to or subtracted from a figure in the other. <a href="/method/budget/">How they line up</a>.</p>
  </div>
</div></section>
<section class="section" id="departments"><div class="wrap">
  <div class="section-head"><h2>By department, largest differences first</h2>
  <p>What each department was budgeted in the spring of ${fy.slice(0, 4)}, what it spent by ${march(fy)}, and the difference.</p></div>
  ${deptTable}
</div></section>${trend}${checks}`;

  const d = c.difference;
  return {
    title: isLatest ? `NL budget against actual spending, deficit and net debt, ${fy}` : `NL budget against actual spending, ${fy}`,
    description: desc(`Newfoundland and Labrador budgeted ${words(c.gross.budget)} for departments in ${fy} and spent ${words(c.gross.actual)}. The ${deficit ? "deficit" : "surplus"} was ${words(a.balance.actual)}; net debt ${words(a.net_debt.actual)}.`),
    body, notes,
    jsonld: isLatest ? [datasetLd({ name: `Newfoundland and Labrador budget against actual spending, deficit and net debt, ${B.years[0].year} to ${fy}`, description: `Budgeted and actual gross spending by department (${overUnder(d)} budget by ${words(d)} in ${fy}), and the province's annual surplus or deficit and net debt, from the Estimates, the Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund and the Public Accounts.`, path: "/budget/", license: LICENSE.provincial, period: `${B.years[0].year.slice(0, 4)}/20${fy.slice(-2)}`, files: ["/data/budget.json"], publishers: [{ name: "Public Accounts of Newfoundland and Labrador", url: "https://www.gov.nl.ca/exec/tbs/public-accounts/" }, { name: "Budget documents, Government of Newfoundland and Labrador", url: "https://www.gov.nl.ca/budget/" }] })] : [],
  };
}

// ---- method: how the budget and the accounts line up
function methodPage(D, B) {
  const y = B.latest, fy = y.year, c = y.cash, a = y.accounts, K = B.checks;
  const notes = new Notes();
  const report = notes.cite({ url: c.actual_source.url, label: `${DOCS.report} ${fy}, Introduction (printed page 1)` });
  const pp = a.net_debt_per_person;
  const ownPP = a.net_debt.actual / D.stats.population.value;
  const body = html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, "Budget against actual"]], title: "Method: budget against actual, the deficit and net debt", lede: "Which budget is set against which actual, why the deficit comes from a different document, and how each figure is checked." })}
<section class="section"><div class="wrap prose">
  <h2>Two bases of accounting</h2>
  <p>The province publishes its finances on two bases. They answer different questions, cover different bodies and count at different moments. This site shows both and never adds a figure from one to a figure from the other.</p>
  <div class="sched-wrap"><table class="sched">
    <thead><tr><th scope="col">Question</th><th scope="col">Documents</th><th scope="col">Basis</th><th scope="col">Covers</th></tr></thead>
    <tbody>
      <tr><th scope="row">What was budgeted, and what was spent?</th><td>Budgeted: the Estimates given to the House of Assembly with the budget. Spent: the Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund.</td><td>Modified cash: a payment counts in the year it is made.</td><td>Government departments, the Legislature and the money they pass on as grants.</td></tr>
      <tr><th scope="row">Did the year end in surplus or deficit, and what is the debt?</th><td>The Public Accounts: the audited Consolidated Summary Financial Statements.</td><td>Accrual: a cost counts in the year it is incurred, and buildings and roads are spread over their useful lives.</td><td>Departments together with Crown corporations, boards and authorities, such as Newfoundland and Labrador Health Services, Memorial University and Newfoundland and Labrador Hydro.</td></tr>
    </tbody>
  </table></div>

  <h2>Budgeted against spent</h2>
  <ul>
    <li><strong>Like for like.</strong> The Report is drawn up on the same basis as the Estimates. In its own words it uses "the modified cash basis of accounting", which "is the same basis used to prepare the budgeted appropriations and revenues as per Government's Estimates presented to the House of Assembly"${report}. Its statements print the Original Estimates beside the Actuals.</li>
    <li><strong>Budgeted</strong> is the original figure: gross expenditure in the Estimates as tabled with the budget, current and capital accounts together. It is not the amended estimate, which moves during the year as money is transferred between departments.</li>
    <li><strong>Spent</strong> is gross expenditure in the Report, before "related revenue" (federal cost-sharing and fees that a department collects against its own spending). For ${fy}: ${money(c.gross.budget)} budgeted, ${money(c.gross.actual)} spent.</li>
    <li><strong>By department</strong>, the budget is the department's "Total: Program Estimates" in the Estimates, and spending is its line in the Report's summary statements. Where a department in the Report is not in that year's Estimates under the same name, the budget is the Original column the Report prints for it.</li>
    <li>The Report is prepared by the Comptroller General and is not audited.</li>
  </ul>

  <h2>The deficit and net debt</h2>
  <ul>
    <li><strong>The surplus or deficit</strong> is the "annual surplus (deficit)" line of the Consolidated Statement of Operations in the Public Accounts: total revenue less total expense for the whole government. The budget figure beside it is the Original Budget column of the same statement, which the province marks unaudited.</li>
    <li><strong>It is not spending less revenue from the cash statement.</strong> In ${fy} departments' cash spending outran their revenue by ${money(-c.cash_balance.actual)}, while the annual ${a.balance.actual < 0 ? "deficit" : "surplus"} was ${money(Math.abs(a.balance.actual))}. The cash statement covers departments only and counts construction and equipment at full price in the year they are paid for; the accounts spread those costs over the assets' lives and include the results of Crown corporations and other public bodies.</li>
    <li><strong>Spending can come in under the budget in a year when the deficit is larger than forecast</strong>, or the reverse, because the two are measured differently and the deficit also depends on revenue.</li>
    <li><strong>Net debt</strong> is total liabilities less financial assets, from the Consolidated Statement of Financial Position: what the province owes (borrowing, pensions and other retirement benefits, payables) less the cash, investments and receivables it holds. Buildings and roads are not counted as financial assets.</li>
    <li><strong>Per person.</strong> ${pp ? `The Public Accounts print net debt per capita themselves: ${money(pp.value)} for ${fy}. That figure is used as published. Dividing net debt by the population this site uses elsewhere (${num(D.stats.population.value)}, Statistics Canada, 1 July ${fy.slice(0, 4)}) gives ${money(ownPP)}; the province divides by its own population figure.` : `Net debt divided by the population (${num(D.stats.population.value)}, Statistics Canada).`}</li>
    <li><strong>Restatements.</strong> Each year is shown as that year's accounts first printed it. When the following year's accounts print a different figure for the earlier year (after a change in accounting standards, for example), the restated figure is given in a note under the table.</li>
  </ul>

  <h2>Checks</h2>
  <p>The figures are read from the PDF documents by a script. Nothing is typed in by hand. Each run then checks:</p>
  <ul>
    <li>Every subtotal in the Report's cash statement recomputes from the lines above it, for actuals and for original estimates: ${K.statement} of ${K.statement_n}.</li>
    <li>The departments in the Report's summary statements add to the statement's gross expenditure: ${K.report.ok} of ${K.report.n} years.</li>
    <li>Each department's program lines in the Estimates add to its printed total, and the departments add to the gross expenditure in the budget's Summary of Cash Requirements: ${K.estimates.ok} of ${K.estimates.n} years.</li>
    <li>The Original Estimates the Report reprints equal the budget's own summary: ${K.original} of ${K.original_n} figures. Department by department, the Report's Original column equals the Estimates as tabled: ${K.departments.ok} of ${K.departments.n}.</li>
    <li>In the Public Accounts, revenue less expense equals the printed surplus or deficit, liabilities less financial assets equals net debt, and net debt is the same in two statements: ${K.accounts.ok} of ${K.accounts.n}.</li>
    <li>From Budget 2024, when the budget's own statements are published as Statements and Schedules, the Original Budget column in the Public Accounts equals them: ${K.budget.ok} of ${K.budget.n}.</li>
  </ul>
  ${K.failed.length ? html`<p>Where a check does not hold, the province's documents disagree with each other, and the Estimates' figure is used:</p><ul>${K.failed.map((f) => `<li>${esc(f.what.split(":")[0])}, ${f.year}: the Report's Original column adds to ${f.a == null ? "nothing, because the Report prints no program detail for the department" : money(f.a)}; the Estimates as tabled say ${money(f.b)}.</li>`)}</ul>` : ""}
  <p>The same checks run on sample documents for every change to the code, and the results of the last full run are in <a href="https://github.com/steveclarke/nl-ledger/blob/main/docs/reconciliation.md">the reconciliation record</a>.</p>

  <h2>What this does not show</h2>
  <ul>
    <li>Budgets for the public bodies outside the departments (the health authority, Crown corporations) line by line. The Public Accounts give their results in total.</li>
    <li>Why a department spent more or less than budgeted. The documents give the figures; the reasons are in the province's own discussion and analysis and in debate in the House.</li>
    <li>Results for ${B.years.filter((x) => !x.spent_published).map((x) => x.year).join(" and ")}: the Report and the Public Accounts for those years are not yet published.</li>
  </ul>
  <h2>Sources and licence</h2>
  <ul>${Object.entries(DOCS).map(([k, name]) => { const l = LICENCES[DOCUMENT_LICENCE[k]]; return `<li>${esc(name)}. Published by the Government of Newfoundland and Labrador; used under its <a href="${esc(l.url)}">copyright notice</a>.</li>`; })}</ul>
  <p class="small">${esc(LICENCES.nl.note)}</p>
  <p><a href="/budget/">Budget against actual ${icon("arrow")}</a></p>
</div></section>`;
  return ["/method/budget/", { title: "Method: budget against actual, the deficit and net debt", description: desc("Which budget is compared with which actual, why the deficit and net debt come from the Public Accounts on a different basis, and how each figure is checked."), body, notes }];
}

export function budget(D, R, B) {
  const out = [];
  for (const y of B.years.filter((x) => x.spent_published && x.accounts.published)) {
    out.push([y === B.latest ? "/budget/" : `/budget/${y.year}/`, yearPage(D, B, y, y === B.latest)]);
  }
  out.push(methodPage(D, B));
  return out;
}

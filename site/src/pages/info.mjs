// Sources and report card, methods, corrections, about, data access, the fold-out scale, 404.
import { esc, html, icon, Notes, schedule, leaders, methodCode, REPO } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, date as fmtDate, workTime, SITE, payrollContributions, nlIncomeTax } from "../../lib/format.mjs";
import { desc } from "../seo.mjs";
import { DATASETS } from "../../lib/search.mjs";
import { pagehead, caveat, datasetLabel } from "../common.mjs";
import { connectPage } from "./connect.mjs";
import { LICENCES, SOURCE_LICENCE } from "../licences.mjs";
import { ASKED, ASKED_STATE } from "../asked.mjs";



const SOURCES = [
  { ds: "ppa", publisher: "Public Procurement Agency, Government of Newfoundland and Labrador", url: "https://www.gov.nl.ca/ppa/tenders/awarded/", what: "Contract award reports filed every two weeks under sections 31 and 32 of the Public Procurement Regulations: limited calls for bids, exceptions to open calls (sole source, emergency and others) and some open calls, for every public body that must report.", form: "PDF tables, read with a table parser. Where a fortnight was reissued as REVISED, the revised report replaces the original." },
  { ds: "minister", publisher: "Executive Council, Government of Newfoundland and Labrador", url: "https://www.gov.nl.ca/exec/cabinet/expenseclaims/", what: "Each minister's expense claims paid in six-month periods, with a detail page per travel claim.", form: "PDF text. Every report's lines are checked against its printed total." },
  { ds: "mha", publisher: "House of Assembly", url: "https://www.assembly.nl.ca/Members/Expenses/", what: "Member Accountability and Disclosure Reports: every line charged to each MHA's allowances, with limits by category. Annual reports from 2020-21.", form: "PDF text. Every category's lines are checked against its printed Period Activity, and the detail against the summary report." },
  { ds: "sunshine", publisher: "Treasury Board Secretariat, Government of Newfoundland and Labrador", url: "https://www.gov.nl.ca/exec/tbs/home/publications/compensation-disclosure/", what: "Compensation disclosure lists: everyone paid over $100,000 in a calendar year, by employer, 2022 to 2025.", form: "Excel workbooks, read cell by cell." },
  { ds: "fed_contract", publisher: "Government of Canada (Treasury Board Secretariat, open.canada.ca)", url: "https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b", what: "Proactive disclosure of contracts over $10,000, filtered to vendors with a Newfoundland and Labrador postal code (starting with A).", form: "Bulk CSV. Amendments repeat the whole contract, so each contract is counted once, at its latest value." },
  { ds: "fed_grant", publisher: "Government of Canada (open.canada.ca)", url: "https://open.canada.ca/data/en/dataset/432527ab-7aac-45b5-81d6-7597107a7013", what: "Proactive disclosure of grants and contributions to recipients in Newfoundland and Labrador.", form: "Open data API, filtered on recipient province. Each agreement counted once, at its latest amendment." },
  { ds: "canadabuys", publisher: "Public Services and Procurement Canada (CanadaBuys)", url: "https://canadabuys.canada.ca/en/tender-opportunities/award-notices", what: "Federal award notices where the supplier is in Newfoundland and Labrador, August 2022 on.", form: "Bulk CSV. These overlap the contracts disclosure and are never added into totals." },
  { ds: "pa_pss", publisher: "Receiver General for Canada, Public Accounts Volume III", url: "https://www.tpsgc-pwgsc.gc.ca/recgen/cpc-pac/index-eng.html", what: "Federal payments over $100,000 for professional and special services to payees in Newfoundland and Labrador, 2021-22 to 2024-25.", form: "Bulk CSV." },
  { ds: "pa_tp", publisher: "Receiver General for Canada, Public Accounts Volume III", url: "https://www.tpsgc-pwgsc.gc.ca/recgen/cpc-pac/index-eng.html", what: "Federal transfer payments over $100,000 to recipients in Newfoundland and Labrador, 2021-22 to 2024-25.", form: "Bulk CSV." },
  { ds: "paradise", publisher: "Town of Paradise", url: "https://www.paradise.ca/government-engage/cheque-register/", what: "Every payment the town made, month by month, from mid-2020.", form: "PDF text. The town's page links some months to the wrong file; each register is dated by its own payment dates." },
  { ds: "stjohns", publisher: "City of St. John's", url: "https://www.stjohns.ca/your-government/access-to-information-and-protection-of-privacy/proactive-disclosures/", what: "Weekly payment vouchers. A sample: the first pages of the 2026 file.", form: "Scanned images read by OCR (tesseract). Text can be misread; every line links to its page." },
];

const OTHER = [
  ["Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund, 2019-20 to 2024-25", "https://www.gov.nl.ca/exec/tbs/public-accounts/", "Department and program spending, actual against amended and original estimates; what departments spent against the budget.", "nl"],
  ["Estimates of the Program Expenditure and Revenue of the Consolidated Revenue Fund, 2019-20 to 2026-27, and the budgets' Statements and Schedules from 2024-25", "https://www.gov.nl.ca/budget/", "What each year's budget gave each department and program; the budget's forecast deficit and net debt.", "nl"],
  ["Public Accounts, Consolidated Summary Financial Statements, 2019-20 to 2024-25", "https://www.gov.nl.ca/exec/tbs/public-accounts/", "The annual surplus or deficit and net debt, audited, against the original budget.", "nl"],
  ["Statistics Canada tables 14-10-0064, 17-10-0009, 98-10-0002, 36-10-0450", "https://www150.statcan.gc.ca/", "Median wage, population, households, provincial revenue and interest.", "statcan"],
  ["Canada Revenue Agency, Form NL428", "https://www.canada.ca/en/revenue-agency.html", "Provincial income tax brackets, CPP and EI rates for the personal receipt.", "gc"],
];

// The receipt's arithmetic for one income, line by line, so a reader can redo it with a calculator.
function workedExample(S) {
  const t = S.nl_tax;
  const income = Math.round(S.median_annual_wage.value);
  const p = payrollContributions(income, t);
  const net = income - p.deduction;
  const rate1 = t.brackets[0][2];
  const cents = (x) => money(x, { cents: true });
  let brackets = 0;
  const parts = [];
  for (const [lo, hi, rate] of t.brackets) {
    if (net <= lo) break;
    const slice = Math.min(net, hi ?? Infinity) - lo;
    brackets += slice * rate;
    parts.push(`${cents(slice)} at ${(rate * 100).toFixed(1)}%`);
  }
  const credits = t.basic_personal_amount + p.baseCpp + p.ei;
  const lowIncome = Math.max(0, t.low_income.basic - t.low_income.rate * Math.max(0, net - t.low_income.threshold));
  const rows = [
    ["Employment income (the median full-time wage, Statistics Canada)", cents(income)],
    ["Base CPP, 4.95% of earnings above $3,500 (a credit)", cents(p.baseCpp)],
    ["Enhanced CPP, 1% of the same earnings (a deduction)", cents(p.deduction)],
    ["EI premiums, 1.64% of income (a credit)", cents(p.ei)],
    ["Net income: income less the deduction", cents(net)],
    [`Tax on the brackets: ${parts.join(" and ")}`, cents(brackets)],
    [`Credits: basic personal amount ${cents(t.basic_personal_amount)} + CPP + EI = ${cents(credits)}, times ${(rate1 * 100).toFixed(1)}%`, cents(credits * rate1)],
    ["Low-income tax reduction (none at this income)", cents(lowIncome)],
    ["Provincial income tax on the receipt", cents(nlIncomeTax(income, t))],
  ];
  return html`<h2>Worked example at the median wage</h2>
  <p>The same arithmetic the receipt runs, for ${money(income)} of employment income in ${t.year}. Redo it with a calculator, or check it against form NL428 (lines 27 and 29 are the CPP and EI credits).</p>
  ${schedule({ compact: true, cols: [{ label: "Step" }, { label: "Amount", num: true }], rows: rows.map((r) => ({ cells: [esc(r[0]), r[1]] })) })}
  <p class="small">Without the CPP and EI credits and the enhanced CPP deduction, the same income would show ${cents(nlIncomeTax(income, { ...t, cpp: undefined, ei: undefined }))}.</p>`;
}

export function info(D, R) {
  const out = [];
  const counts = Object.fromEntries(D.q("SELECT dataset, count(*) n, sum(amount) a, min(nullif(date,'')) d0, max(date) d1 FROM items GROUP BY dataset").map((r) => [r.dataset, r]));

  // ---- sources + report card
  const issuesBySource = {};
  for (const i of D.issues) (issuesBySource[i.source] ||= []).push(i);
  const late = D.flagSummary["late-publication"]?.items || 0;
  const bad = D.flagSummary["date-check"]?.items || 0;
  const ppaN = counts.ppa.n;
  const estChecks = D.one("SELECT sum(ok) ok, count(*) n, count(DISTINCT fiscal_year) years FROM dept_summary WHERE kind='estimates'");
  const card = [
    { body: "Public Procurement Agency award reports", grade: [`${pct(late / ppaN, 1)} of awards reported more than 90 days after the award date`, `${num(bad)} printed award dates fall after the report or years before it`, "4 fortnights reissued as REVISED", "Open-call awards by departments are on MERX, not in these reports"] },
    { body: "Executive Council, ministers' claims", grade: ["Every report adds up to its printed total", ...(issuesBySource["Ministerial expense claims"] || []).map((i) => `${i.url.split("/").pop()}: ${i.issue}`)] },
    { body: "House of Assembly, MHA reports", grade: ["Every category adds up to its printed period activity", `${(issuesBySource["MHA expense report"] || []).length} report links lead to a web page instead of a PDF`] },
    { body: "Treasury Board Secretariat, compensation lists", grade: [`${(issuesBySource["Compensation disclosure"] || []).length} of the workbooks linked from the disclosure page return "page not found"`, "Names are withheld for police officers (identifiers only), as the Act allows"] },
    { body: "Treasury Board Secretariat, program expenditure reports", grade: [`${R.reportCard.find((x) => /Department totals/.test(x.label)).value} department totals match the printed statement`, "The 2024-25 report prints Labrador Affairs' detail pages empty, with the text #MISSING", ...(issuesBySource["Program expenditure reports"] || []).map((i) => i.issue)] },
    { body: "Department of Finance, budget Estimates", grade: [`${estChecks.ok} of ${estChecks.n} department totals match the printed Program Funding Summary, in ${estChecks.years} years of Estimates`, "One page in each of the 2025-26 and 2026-27 Estimates stores its text as glyph numbers, so a search or copy of that page returns unreadable characters"] },
    { body: "Province, small purchases", grade: ["No line-by-line payment data is published at all"] },
  ];
  out.push(["/sources/", {
    title: "Sources: where every figure comes from",
    description: desc("What each publisher releases, how much is loaded, the licence each source is under, and a report card on how complete and usable the records are."),
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Sources"]], title: "Sources and report card", lede: "Where every figure comes from, what each source covers, and how well each publisher does at publishing it." })}
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1.5rem">Line-item sources</h2>
  ${SOURCES.filter((s) => DATASETS.includes(s.ds)).map((s) => { const c = counts[s.ds] || {}; return html`<article id="${s.ds}" style="padding-block:1.25rem;border-block-end:1px solid var(--hair)">
    <h3>${esc(datasetLabel(s.ds))}</h3>
    <p class="small muted" style="margin:.3rem 0 .6rem">${esc(s.publisher)} · <a href="${esc(s.url)}">${esc(s.url.replace(/^https?:\/\//, "").slice(0, 60))}</a></p>
    <p>${esc(s.what)}</p><p class="small">${esc(s.form)}</p>
    <p class="small">Licence: <a href="${esc(LICENCES[SOURCE_LICENCE[s.ds]].url)}">${esc(LICENCES[SOURCE_LICENCE[s.ds]].name)}</a>.</p>
    <p class="small"><strong>${num(c.n || 0)} records${c.a ? `, ${moneyWords(c.a)}` : ""}</strong>${c.d0 ? `, dated ${fmtDate(c.d0)} to ${fmtDate(c.d1)}` : ""}. <a href="/search/?ds=${s.ds}">Search them</a>.</p>
  </article>`; })}
  <h2 style="margin-block:2.5rem 1rem">Other sources</h2>
  ${schedule({ cols: [{ label: "Source" }, { label: "Used for" }], rows: OTHER.map(([t, u, w]) => ({ cells: [`<a href="${u}">${esc(t)}</a>`, esc(w)] })) })}
</div></section>
<section class="section" id="licences"><div class="wrap">
  <div class="section-head"><h2>Licences</h2><p>Each source stays under the terms of the body that published it. The site's own code is under the <a href="${REPO}/blob/main/LICENSE">MIT licence</a>.</p></div>
  ${schedule({ compact: true, cols: [{ label: "Source" }, { label: "Publisher" }, { label: "Licence" }, { label: "Attribution and conditions" }], rows: [
    ...SOURCES.filter((s) => DATASETS.includes(s.ds)).map((s) => [datasetLabel(s.ds), s.publisher, LICENCES[SOURCE_LICENCE[s.ds]]]),
    ...OTHER.map(([t, , , k]) => [t, "", LICENCES[k]]),
  ].map(([src, pub, l]) => ({ cells: [esc(src), esc(pub), `<a href="${esc(l.url)}">${esc(l.name)}</a>`, esc(l.wording ? `Required wording: "${l.wording}"` : l.note)] })) })}
  <p class="small">Statistics Canada tables: the required wording is completed with the table's number and reference date, as listed under Other sources. Every record links to the original. Reuse of House of Assembly records follows those publishers' terms, not the federal licence.</p>
</div></section>
<section class="section" id="report-card"><div class="wrap">
  <div class="section-head"><h2>Publisher report card</h2><p>How complete, correct and usable each publisher's records are. This grades the publishing, not the spending.</p></div>
  ${card.map((c) => html`<div style="padding-block:1rem;border-block-end:1px solid var(--hair)"><h3>${esc(c.body)}</h3><ul class="prose" style="margin-block:.5rem 0">${c.grade.map((g) => `<li>${esc(g)}</li>`)}</ul></div>`)}
  <h3 style="margin-block:2rem .8rem">Broken links found</h3>
  ${schedule({ compact: true, cols: [{ label: "Source" }, { label: "Link" }, { label: "Problem" }], rows: D.issues.filter((i) => /404|web page/.test(i.issue)).map((i) => ({ cells: [esc(i.source), `<a href="${esc(i.url)}">${esc(i.url.split("/").pop())}</a>`, esc(i.issue)] })) })}
</div></section>`,
  }]);

  // ---- methods index + receipt + federal + scale
  out.push(["/method/", {
    title: "Methods: how each figure is worked out",
    description: desc("How every figure and pattern on NL Ledger is counted, what it leaves out and what it cannot tell you: the tax receipt, federal amendments and each pattern."),
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Methods"]], title: "Methods", lede: "How each figure on this site is worked out." })}
<section class="section"><div class="wrap prose">
  <h2>Human scale</h2>
  <ul>
    <li><strong>Per person:</strong> the amount divided by the province's population, ${num(D.stats.population.value)} on ${fmtDate(D.stats.population.date)} (Statistics Canada table ${D.stats.population.table}).</li>
    <li><strong>Per household:</strong> divided by ${num(D.stats.households.value)} private households (2021 Census, table ${D.stats.households.table}).</li>
    <li><strong>Time to earn:</strong> divided by the median full-time wage, ${money(D.stats.median_weekly_wage.value, { cents: true })} a week in ${D.stats.median_weekly_wage.year} (table ${D.stats.median_weekly_wage.table}, vector ${D.stats.median_weekly_wage.vector}) times 52, which is ${money(D.stats.median_annual_wage.value)} a year. Weeks, days and hours assume 52 working weeks of five 7.5-hour days.</li>
  </ul>
  <h2>The personal receipt</h2><p><a href="/method/receipt/">How the receipt is worked out</a>.</p>
  <h2>Budget against actual, the deficit and net debt</h2><p><a href="/method/budget/">Which budget is set against which actual, and why the deficit comes from the Public Accounts</a>.</p>
  <h2>Federal amendments</h2><p><a href="/method/federal/">How amended federal contracts and grants are counted once</a>.</p>
  <h2>Supplier names</h2><p><a href="/method/suppliers/">How names printed different ways are matched to one supplier</a>.</p>
  <h2>Totals and checks</h2><p>Every total on this site is a sum of line items loaded from the sources. Where a source prints its own totals, the sum is compared with them; the results are on the <a href="/sources/#report-card">report card</a>.</p>
  <h2>Patterns</h2><ul>${D.catalog.flags.map((f) => `<li><a href="/method/${f.id}/">${esc(f.title)}</a></li>`)}</ul>
  ${methodCode([["pipeline/flags.py", "defines and counts every pattern"], ["pipeline/build.py", "builds the database the site is made from"]], { title: "how each figure is worked out", path: "/method/" })}
</div></section>`,
  }]);
  const S = D.stats;
  out.push(["/method/receipt/", {
    title: "Method: the personal tax receipt",
    description: desc("How the tax receipt works out provincial income tax from form NL428 with CPP and EI credits, spreads it across departments, and a worked example at the median wage."),
    body: html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, "The receipt"]], title: "Method: the personal receipt", lede: "What the receipt computes, and what it leaves out." })}
<section class="section"><div class="wrap prose">
  <ol>
    <li>Your provincial income tax is worked out from your income with the ${S.nl_tax.year} Newfoundland and Labrador brackets (${S.nl_tax.brackets.map((b) => `${(b[2] * 100).toFixed(1)}%${b[1] ? ` up to ${money(b[1])}` : " above that"}`).join(", ")}), less the basic personal amount credit (${money(S.nl_tax.basic_personal_amount)} at ${(S.nl_tax.brackets[0][2] * 100).toFixed(1)}%). Source: ${esc(S.nl_tax.source_label)}.</li>
    <li>The receipt treats your income as employment income from one job. The enhanced CPP and CPP2 contributions are deducted from it to get net income, which the brackets and the low-income reduction then use.</li>
    <li>The Newfoundland and Labrador low-income tax reduction is applied for a single person: $997, less 16% of net income over $23,928 (form NL428, 2025).</li>
    <li>Two more credits, at the same lowest rate (${(S.nl_tax.brackets[0][2] * 100).toFixed(1)}%), come from what an employee pays into the Canada Pension Plan and Employment Insurance (form NL428 lines 27 and 29): base CPP is ${(S.nl_tax.cpp.base_rate * 100).toFixed(2)}% of earnings from ${money(S.nl_tax.cpp.exemption)} to ${money(S.nl_tax.cpp.ympe)}; EI is ${(S.nl_tax.ei.rate * 100).toFixed(2)}% of earnings up to ${money(S.nl_tax.ei.max_insurable)}. Enhanced CPP is ${(S.nl_tax.cpp.enhanced_rate * 100).toFixed(0)}% of the same earnings, and CPP2 is ${(S.nl_tax.cpp.cpp2_rate * 100).toFixed(0)}% of earnings from ${money(S.nl_tax.cpp.ympe)} to ${money(S.nl_tax.cpp.yampe)}. Sources: <a href="${esc(S.nl_tax.cpp.source)}" rel="noopener">CRA, CPP rates and maximums</a>, <a href="${esc(S.nl_tax.ei.source)}" rel="noopener">CRA, EI premium rates and maximums</a>.</li>
    <li>Other credits (pension, age, tuition, dependants) are not applied, so the receipt overstates tax somewhat for anyone who has them.</li>
    <li>That tax is split across departments in proportion to each department's share of gross spending in ${R.year}, from the Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund.</li>
    <li>"Your share" of a contract is the contract's value times your tax divided by all provincial spending that year: the fraction of everything the province spent that your tax matches.</li>
  </ol>
  ${workedExample(S)}
  <p>Provincial spending is paid for by many revenues. Personal income tax was ${pct(S.provincial_government.personal_income_tax / S.provincial_government.revenue)} of provincial revenue in ${S.provincial_government.year} (Statistics Canada table ${S.provincial_government.table}). The receipt shows how your part would be spread, not the whole bill. Nothing you enter leaves your browser except as a web address when you press the button without JavaScript.</p>
  ${methodCode([["site/lib/receipt.mjs", "spreads a tax bill across departments and contracts"], ["site/lib/format.mjs", "the NL428 tax calculation with CPP and EI credits"], ["pipeline/stats.py", "loads the Statistics Canada figures it uses"]], { title: "the personal tax receipt", path: "/method/receipt/" })}
</div></section>`,
  }]);
  const F = D.federal;
  out.push(["/method/federal/", {
    title: "Method: counting federal contracts once",
    description: desc("Federal disclosure files repeat a contract every time it is amended. How NL Ledger counts each contract and grant once, and the totals before and after."),
    body: html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, "Federal amendments"]], title: "Method: federal amendments", lede: "The federal disclosure files repeat a contract every time it changes. Added up as published, they count the same money many times." })}
<section class="section"><div class="wrap prose">
  <h2>Contracts over $10,000</h2>
  <ol><li>Keep rows whose vendor postal code starts with A (Newfoundland and Labrador) and whose vendor country is Canada or blank. Two placeholder records ("Company XYZ") are dropped.</li>
  <li>Group rows by procurement identifier and vendor name (spelling and punctuation ignored), across departments: some Coast Guard purchase orders are reported by both Fisheries and Oceans and National Defence. Rows with no procurement identifier stay on their own.</li>
  <li>Keep the latest row in each group (by reporting period, then contract date). Its contract value is the running total after all amendments.</li></ol>
  <p>As published: ${num(F.contracts.raw_rows)} rows, ${money(F.contracts.raw_value)}. Counted once: ${num(F.contracts.procurements)} contracts, ${money(F.contracts.dedup_value)}. "Non-competitive" means the department coded the solicitation procedure TN.</p>
  <h2>Grants and contributions</h2>
  <p>A grant value is the agreement value: the amount a department commits in a grant or contribution agreement. One agreement can run several years, so a value is not one year's spending and not the amount paid out.</p>
  <h3>How amendments are counted</h3>
  <p>Each amendment is a new row. The Treasury Board <a href="https://open.canada.ca/data/en/dataset/432527ab-7aac-45b5-81d6-7597107a7013">data dictionary</a> says the row's agreement value is "the total grant or contribution value, and not the change in agreement value". Most departments follow it, and several say so in their notes: the Atlantic Canada Opportunities Agency ("the previous value was $X", which matches the row before), Health Canada ("The total agreement value previously disclosed has been updated"), the National Research Council ("The total amended value is"), Innovation, Science and Economic Development ("value changed from X to Y"). For these the latest amendment is the agreement's value.</p>
  <p>Four departments report each amendment as the change in value instead. For these every row of the agreement is added up.</p>
  ${schedule({ cols: [{ label: "Department" }, { label: "Evidence in its own rows", w: "44%" }, { label: "Rows added up", num: true }, { label: "Latest row only", num: true }, { label: `Paid ${Object.values(F.grants.change_reporting)[0].paid_years}`, num: true }],
    rows: Object.values(F.grants.change_reporting).map((c) => ({ cells: [esc(c.department), esc(c.evidence), moneyWords(c.summed), moneyWords(c.latest_only), moneyWords(c.paid)] })) })}
  <p>The last column is what the department paid NL recipients in four fiscal years, from the <a href="https://donnees-data.tpsgc-pwgsc.gc.ca/ba1/pt-tp/pt-tp-2025.csv">Public Accounts transfer payments</a> (payments of $100,000 or more). Indigenous Services and Crown-Indigenous Relations paid more in those four years than their latest rows add up to for every year on file, so those rows cannot be agreement totals. If Canadian Heritage and the Public Health Agency were read as reporting totals, the grants total would be ${moneyWords(["pch", "phac-aspc"].reduce((t, o) => t + F.grants.change_reporting[o].summed - F.grants.change_reporting[o].latest_only, 0))} lower.</p>
  <h3>Grouping rows into agreements</h3>
  <ol><li>Rows are grouped by department, agreement number and recipient. Spelling, punctuation and legal suffixes in the recipient's name are ignored, and "English name|French name" is the same recipient as the English name alone.</li>
  <li>A recipient renamed on an amendment (a new legal name, a transfer to a successor) stays in the same agreement. Rows under another name with a different program and start date are a different agreement that shares the number.</li>
  <li>Rows with no agreement number are one agreement each, except where a department reports an amendment under a new reference number (Infrastructure Canada, Veterans Affairs): those join on recipient, start date, program and title.</li></ol>
  <p>As published: ${num(F.grants.raw_rows)} rows, ${money(F.grants.raw_value)}. Counted once: ${num(F.grants.agreements)} agreements, ${money(F.grants.dedup_value)}. The code is <a href="${REPO}/blob/main/pipeline/parse_federal.py">parse_federal.py</a>.</p>
  <h2>CanadaBuys award notices</h2><p>Grouped by reference number and supplier, latest amendment kept. The same contract can appear here and in the contracts disclosure, so notices are shown and searchable but never added to a total.</p>
  ${methodCode([["pipeline/parse_federal.py", "reads the federal files and keeps each contract and grant once"], ["pipeline/reconcile.py", "checks totals against the sources' own"]], { title: "counting federal contracts once", path: "/method/federal/" })}
</div></section>`,
  }]);

  const M = D.matching;
  const GH = "https://github.com/steveclarke/nl-ledger";
  out.push(["/method/suppliers/", {
    title: "Method: matching supplier names",
    description: desc("How NL Ledger decides that names printed different ways across provincial and federal records are one supplier, and which close names it keeps apart."),
    body: html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, "Supplier names"]], title: "Method: supplier names", lede: "Each source prints a supplier's name its own way. A supplier page combines the names the records show are one supplier, and no others." })}
<section class="section"><div class="wrap prose">
  <h2>When names are joined</h2>
  <ul>
    <li><strong>Same name.</strong> Case, accents, apostrophes, punctuation, spacing and legal suffixes (Inc., Ltd., Limited, Corp., Ltée) are set aside, and NL and Nfld are read as the province's name. Anything after "o/a", "c/o" or "formerly" is dropped: the record belongs to the legal name before it.</li>
    <li><strong>Bilingual.</strong> Federal grant records print a recipient as "English name|French name". Both halves are the same recipient.</li>
    <li><strong>Business number.</strong> Federal grant records with the same valid business number are joined when the names are a spelling slip apart, or one name is inside the other and adds only words such as Inc., Association or Council. Department placeholders (000000000, 1000xxxxx) fail the number's check digit and are ignored. Where the full account is printed it must match too: one church or club body can hold a separate charity account for each congregation or branch.</li>
    <li><strong>Postal code.</strong> Federal records with the same postal code are joined when the names are a spelling slip apart with the same initials, and no different business numbers are printed with them.</li>
    <li><strong>Same award.</strong> A federal contract and a CanadaBuys notice with the same award date and the same value to the cent are one award, so their close names are one supplier.</li>
    <li><strong>Department or campus.</strong> A department, faculty or campus printed after its body's name ("Government of Newfoundland and Labrador, Department of Education") is part of that body.</li>
    <li><strong>Reviewed.</strong> A short list of decisions, each with its reason, for matches the rules above cannot make: a renamed body, a misprint in a provincial report, a trading name.</li>
  </ul>
  <h2>When names are kept apart</h2>
  <ul>
    <li>Close names with no evidence. Two different companies shown as one is worse than one company shown twice.</li>
    <li>Operating names. "Cavendish Hotel LP o/a Sheraton" is not joined to other Sheraton records: franchise names are shared by different owners.</li>
    <li>A company and its limited partnership, and a parent and its subsidiary, unless a reviewed decision gives the reason.</li>
    <li>A French name printed with more than one English name, or a placeholder such as N/A.</li>
    <li>Names that share a business number but not a name: a parent body's number can cover separate branches.</li>
  </ul>
  <h2>Totals</h2>
  <p>A supplier's total counts each contract award, grant agreement and payment once, whichever name it was printed under. Public Accounts payment lines and CanadaBuys notices repeat money already counted, so they are listed on the supplier's page but left out of its total.</p>
  <h2>The numbers</h2>
  <p>${num(M.name_keys)} distinct names become ${num(M.suppliers)} suppliers: ${num(M.folded)} names are joined to another on the evidence above. ${num(M.near)} close names are kept apart.</p>
  ${schedule({ compact: true, caption: "Largest suppliers that combine several names", cols: [{ label: "Supplier" }, { label: "Names", num: true }, { label: "Records", num: true }, { label: "Value", num: true }], rows: M.largest.map((g) => ({ cells: [esc(g.name), num(g.names), num(g.records), moneyWords(g.value)] })) })}
  ${schedule({ compact: true, caption: "Largest close names kept apart", cols: [{ label: "Name" }, { label: "Other name" }, { label: "Why not joined" }], rows: M.near_sample.map((r) => ({ cells: [esc(r.a), esc(r.b), esc(r.why)] })) })}
  <h2>Every match, and how to question one</h2>
  <p>Every joined name, with the evidence that joined it, is in <a href="${GH}/blob/main/docs/supplier-merges.csv">supplier-merges.csv</a>; close names kept apart are in <a href="${GH}/blob/main/docs/supplier-near-matches.csv">supplier-near-matches.csv</a>, and the reviewed decisions in <a href="${GH}/blob/main/pipeline/supplier_rules.csv">supplier_rules.csv</a>. Each supplier page lists the names it combines, each linking to its own records. To question a match, or to show that two names are one supplier, <a href="${GH}/issues/new?template=challenge-method.yml">challenge the method</a>.</p>
  ${methodCode([["pipeline/suppliers.py", "groups the names printed in each source into suppliers"], ["pipeline/supplier_rules.csv", "the reviewed decisions, each with its reason"], ["pipeline/check_matching.py", "the cases that must join and the false joins that once happened"]], { title: "matching supplier names", path: "/method/suppliers/" })}
</div></section>`,
  }]);

  // ---- corrections
  out.push(["/corrections/", {
    title: "Corrections to published figures",
    description: desc("Every change to a published figure on NL Ledger, logged with the date and the reason, and how to report a figure that does not match its source."),
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Corrections"]], title: "Corrections", lede: "Every change to a published figure is logged here with the date and the reason." })}
<section class="section"><div class="wrap prose">
  <h2>Log</h2>
  <ul>
    <li><strong>29 September 2026. Federal grants: $8.51 billion corrected to $8.43 billion.</strong> Canadian Heritage and the Public Health Agency of Canada report each amendment as the change in value, and only their latest amendment had been counted; their amendments are now added up. Some agreements were counted twice: a recipient renamed on an amendment, and Infrastructure Canada agreements with no agreement number reported again under a new reference number. The method page now shows each department's evidence and a check against Public Accounts. <a href="/method/federal/">Method</a>.</li>
    <li><strong>29 September 2026. Federal grants: $8.67 billion corrected to $8.51 billion.</strong> Some grant agreements were counted twice. A department that reports each amendment as the agreement's new total sometimes printed the recipient's name in English only and sometimes as "English name|French name", and those rows were treated as two agreements. They are now one agreement, counted at its latest amendment (for example, an Association for New Canadians agreement reported twelve times). <a href="/method/federal/">Method</a>.</li>
    <li><strong>29 September 2026. Supplier pages combine names printed different ways.</strong> A supplier's page now includes records printed under other spellings of its name where the records show they are one supplier, so its total can be higher than before. <a href="/method/suppliers/">Method</a>.</li>
  </ul>
  <p>This prototype was first published on ${fmtDate(D.gathered)}.</p>
  <h2>Known errors in the sources</h2>
  <p>Errors found in the government's own files are not corrected here; the figure is shown as published and the error is listed on the <a href="/sources/#report-card">report card</a>.</p>
  <h2>Report an error</h2>
  <p>Every figure links to its source. If a figure here does not match the source it links to, that is an error on this site and belongs in this log. Email <a href="mailto:${SITE.corrections}?subject=Correction%20request">${SITE.corrections}</a> or <a href="/help/#figure">report it on GitHub</a>.</p>
</div></section>`,
  }]);

  // ---- about
  out.push(["/about/", {
    title: "What is NL Ledger?",
    description: desc("NL Ledger is an independent prototype that gathers Newfoundland and Labrador public spending records in one searchable place, each linked to its source."),
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "What is this?"]], title: "What is this?", lede: `${SITE.name} is a thought experiment: what could an ordinary citizen learn about Newfoundland and Labrador public spending from the records governments already publish?` })}
<section class="section"><div class="wrap prose">
  <p>Governments publish a great deal of spending data, but it is scattered across hundreds of PDFs, spreadsheets and web pages that few people have time to read. This prototype gathers ${num(R.itemCount)} of those records in one place and tries to make the amounts easier to picture. It gathers provincial contract awards, minister and MHA expenses, public sector pay over $100,000, department and program spending, federal contracts, grants and transfers in the province.</p>
  <h2>How far to trust the figures</h2>
  <ul>
    <li>Every record comes from a published government source, and each one links back to the file and page or row it came from.</li>
    <li>The records are read, cleaned and combined by automated scripts. Reading PDFs and scanned images can introduce errors, and combining sources means deciding how to avoid counting the same money twice. Those decisions are written down on the <a href="/method/">Methods</a> page.</li>
    <li>The figures have not been independently vetted. Totals are checked against the totals the sources print, and a sample of records has been traced back to the originals, but that is not an audit.</li>
    <li>Before relying on a figure, open its source.</li>
  </ul>
  <h2>What it is not</h2>
  <ul>
    <li>It is not an audit, a news report or an official publication.</li>
    <li>It makes no accusations. The patterns it shows are questions people ask about public spending, counted from the records. Each has its method written down, and none is evidence that anything wrong happened.</li>
    <li>It is not affiliated with any government, party or campaign.</li>
  </ul>
  <h2 id="privacy">Privacy</h2>
  <p>Visits are counted with Cloudflare Web Analytics, which sets no cookies and does not track individual visitors. The site has no accounts, no sign-in and no advertising.</p>
  <h3>The feedback box</h3>
  <ul>
    <li><strong>What is kept.</strong> A note sent from the box at the foot of a page is stored with the kind chosen, the text, the address of the page it was sent from, the time, which of the two checks the sender passed, and an email address only when one was typed in. The same is emailed to the people who run the site.</li>
    <li><strong>What is not kept.</strong> No network (IP) address, browser details or cookie is stored with a note. To limit one connection to ten notes a day, a one-way code made from the network address is kept in a separate list, and deleted once it is more than a day old, when the next note arrives. The address cannot be read back from the code without the site's secret key, and the list does not say which note came from it. Cloudflare, which runs the site, keeps a log of each request the site's program handles, a note or a search alike: the time, the address requested, the network address and browser details. Those logs are kept for a limited time, and the text of a note is not in them.</li>
    <li><strong>Who sees it.</strong> The people who run the site. Notes are held in the site's database at Cloudflare and in the mailbox they are emailed to. A note is never shown on the site. A change made because of one is listed on <a href="/asked/">What people asked for</a>, in the site's words and without names.</li>
    <li><strong>The check that a person is sending it.</strong> When someone starts a note (the first letter typed, or a kind picked), the page loads Cloudflare Turnstile, which checks the browser for signs of an automated program. It is not loaded before that, and it sets no cookie on this site. What it collects is in Cloudflare's <a href="https://www.cloudflare.com/turnstile-privacy-policy/" rel="noopener">Turnstile Privacy Addendum</a>. With JavaScript off it never loads; the site asks for one more press of a button instead.</li>
    <li><strong>How long.</strong> Notes are kept as a record of what was asked. To have a note or an email address removed, write to <a href="mailto:${SITE.contact}">${SITE.contact}</a>.</li>
  </ul>
  <h2>Status</h2>
  <p>This is a prototype. The name, the scope and the sources will change, and parts of it may be wrong. Mistakes that are found are listed on the <a href="/corrections/">Corrections</a> page. Data was last gathered on ${fmtDate(D.gathered)}.</p>
  <h2 id="corrections">Corrections</h2>
  <p>To ask for a correction, use the <a href="#feedback">box at the foot of any page</a> or email <a href="mailto:${SITE.corrections}?subject=Correction%20request">${SITE.corrections}</a>. If you are a person or a company named in a record, say which page and what is wrong. Send the page address, what it shows and what you believe is correct, with a document if you have one.</p>
  <p>Each record links to the government document it came from. If the record here differs from that document, the error is on this site and will be fixed and logged on the <a href="/corrections/">Corrections</a> page. If the document itself is wrong, only the publisher can change it: contact the department, agency, House of Assembly, town or city named on the record.</p>
  <h2>Help build it</h2>
  <p>Anyone can suggest a source, question a method, report a figure that does not match its source, or ask for records that are not published. Most of that needs no programming. <a href="/help/">Help build this ${icon("arrow")}</a></p>
</div></section>`,
  }]);

  // ---- what people asked for (content: src/asked.mjs)
  out.push(["/asked/", {
    title: "What people asked for",
    description: desc("Suggestions readers have sent about NL Ledger and what was done about each one, without names. Anyone can add one from the box on any page."),
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "What people asked for"]], title: "What people asked for", lede: "Suggestions from readers, and what was done about each. Names are left out." })}
<section class="section"><div class="wrap">
  <ul class="asked">${ASKED.map((a) => html`<li>
    <h3>${esc(a.asked)}</h3>
    <span class="state ${a.state === "done" ? "" : "open"}">${ASKED_STATE[a.state]}</span>
    <p>${esc(a.what)}${a.href ? ` <a href="${esc(a.href)}">See it</a>.` : ""} <span class="small muted">${fmtDate(a.date)}</span></p>
  </li>`)}</ul>
  <p style="margin-block-start:2rem">To add one, write it in the <a href="#feedback">box below</a>. No account is needed.</p>
</div></section>`,
  }]);

  // ---- help build this
  const WAYS = [
    { id: "source", title: "Add a source", form: "add-source.yml", label: "Suggest a source",
      text: "Know of public spending records this site does not have? A town that publishes its cheque register, a report of awards, a list of payments. Send the link and a sentence about what it holds." },
    { id: "method", title: "Challenge a method", form: "challenge-method.yml", label: "Question a method",
      text: "Think something is counted, flagged or worded the wrong way? Say what the site does, what you would do instead, and why. Every method is written down on the Methods page, so there is something concrete to argue with." },
    { id: "figure", title: "Report a figure", form: "figure-mismatch.yml", label: "Report a figure",
      text: "Found a figure that does not match the document it links to? Give the page on this site and the page in the source. Confirmed errors are fixed and logged on the Corrections page." },
    { id: "request", title: "Request data", form: "request-data.yml", label: "Request data",
      text: "Want records that are not published anywhere? Describe them and who holds them. A good request can become an access to information request, and the answer can be added here." },
  ];
  out.push(["/help/", {
    title: "Help build NL Ledger",
    description: desc("Add a source, challenge a method, report a figure that does not match its document, or request records that are not published. No programming needed."),
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Help build this"]], title: "Help build this", lede: `${SITE.name} is built in the open, and anyone can help make it more accurate and more complete. Most help needs no programming: a link and a sentence is enough.` })}
<section class="section"><div class="wrap">
  <div class="section-head"><h2>Four ways in</h2><p>Each one opens a short form on GitHub, where the site's code and records are kept. A free GitHub account is needed to send it.</p></div>
  <div class="ways">${WAYS.map((w) => html`<article class="way" id="${w.id}">
    <div><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>
    <p class="way-act"><a class="btn" href="${REPO}/issues/new?template=${w.form}">${esc(w.label)} ${icon("arrow")}</a></p>
  </article>`)}</div>
</div></section>
<section class="section"><div class="wrap"><div class="prose">
  <h2 style="margin-block-start:0">Sources waiting for someone</h2>
  <p>Some sources are known but not yet loaded: MERX award results, more town payment registers, NL Health Services, Memorial University, the lobbyist registry, political contributions and others. Each has its own page on GitHub with what is known so far. <a href="${REPO}/labels/wishlist">See the list ${icon("arrow")}</a></p>
  <h2>What makes a contribution useful</h2>
  <ul>
    <li>A link to the source for every figure.</li>
    <li>Where the source prints a total, the parsed lines add up to it.</li>
    <li>Plain, neutral wording. The site says what the records say and does not accuse anyone.</li>
  </ul>
  <p>Every suggestion is read and every change is reviewed before it goes on the site. A suggestion that needs more work stays open with a note on what would settle it.</p>
  <h2 id="code">For programmers</h2>
  <p>The code is open source under the MIT licence. It fetches each source, reads it, checks it against the source's own totals and builds this site. To run the whole site on a laptop with a small sample of the records, with no accounts, only <a href="https://nodejs.org">Node</a> 22.13 or newer is needed:</p>
  <pre><code>git clone ${REPO}.git &amp;&amp; cd nl-ledger &amp;&amp; ./dev.sh</code></pre>
  <p>Then open <code>localhost:8787</code>. The <a href="${REPO}#readme">README</a> and the <a href="${REPO}/blob/main/CONTRIBUTING.md">contributing guide</a> say what is where.</p>
  <h2 id="starter">Starter issues</h2>
  <p>Each says what to do, where in the code and how to tell it is done. The first two need no code.</p>
  <ul>
    <li><a href="${REPO}/issues/19">Trace 20 random records back to their source documents</a> (no code)</li>
    <li><a href="${REPO}/issues/24">Read the Methods pages as a newcomer and rewrite what is unclear</a> (no code)</li>
    <li><a href="${REPO}/issues/9">The St. John's sample reads one fixed file name</a> (Python)</li>
    <li><a href="${REPO}/issues/20">Test the personal tax calculation against form NL428</a> (JavaScript)</li>
    <li><a href="${REPO}/issues/21">Add a federal grants fixture so counting each agreement once is checked in CI</a> (Python)</li>
    <li><a href="${REPO}/issues/25">Smoke-test every MCP tool against the sample data in CI</a> (JavaScript)</li>
    <li><a href="${REPO}/issues/22">Download a search or supplier's records as CSV</a> (JavaScript)</li>
    <li><a href="${REPO}/issues/23">Run an accessibility check over the built pages and fix what it finds</a> (HTML, CSS)</li>
  </ul>
  <p><a href="${REPO}/issues?q=is%3Aopen+label%3A%22good+first+issue%22%2C%22help+wanted%22">Every open starter issue on GitHub ${icon("arrow")}</a></p>
</div></div></section>`,
  }]);

  // ---- ask your AI (connect page)
  out.push(connectPage(D, R));

  // ---- the fold-out scale
  out.push(scalePage(D, R));

  // ---- 404
  out.push(["/404.html", { title: "Page not found", robots: "noindex", body: html`${pagehead({ title: "Not in the ledger", lede: "That page does not exist. Try a search." })}<section class="section"><div class="wrap"><form class="field" action="/search/" style="max-inline-size:30rem"><label for="nq">Search every payment</label><div class="field-row"><input id="nq" name="q" type="search"><button class="btn" type="submit">Search</button></div></form></div></section>` }]);
  return out;
}

function scalePage(D, R) {
  const S = D.stats;
  const PER_PX = 10000; // dollars per pixel
  const BILLION = 1e9;
  const H = BILLION / PER_PX;
  const notes = new Notes();
  // real NL amounts pinned at their true height, all within $1 billion
  const pick = (sql, ...a) => D.one(sql, ...a);
  const fy = R.year;
  const pins = [];
  const add = (label, amount, href, detail) => amount && amount < BILLION && pins.push({ label, amount, href, detail });
  add("A median full-time wage for a year", S.median_annual_wage.value, "/method/", `Statistics Canada, table ${S.median_weekly_wage.table}`);
  const nurse = R.timeExamples.find((t) => /nurse/i.test(t.title));
  if (nurse) add(nurse.title, nurse.amount, nurse.href, nurse.what);
  const mha = pick("SELECT sum(amount) a FROM items WHERE dataset='mha' AND fiscal_year=?", "2024-25");
  if (mha) add("Every MHA's allowance spending in 2024-25, together", mha.a, "/members/", "Office, travel and constituency allowances, all members");
  const allMin = pick("SELECT sum(amount) a FROM items WHERE dataset='minister'");
  add("Every minister's expense claim, December 2020 to May 2026, together", allMin.a, "/members/", "Executive Council expense reports");
  const para = pick("SELECT sum(amount) a FROM items WHERE dataset='paradise' AND date LIKE '2024%'");
  if (para.a) add("Everything the Town of Paradise paid out in 2024", para.a, "/small-purchases/", "Paradise payment registers");
  const ppa = pick("SELECT * FROM items WHERE dataset='ppa' AND method='Emergency' ORDER BY amount DESC LIMIT 1");
  if (ppa) add(`Largest emergency award: ${ppa.supplier}`, ppa.amount, `/item/${ppa.id.split("-").pop()}/`, ppa.description);
  const ss = pick("SELECT * FROM items WHERE dataset='ppa' AND method='Sole source' ORDER BY amount DESC LIMIT 1");
  if (ss) add(`Largest sole-source award: ${ss.supplier}`, ss.amount, `/item/${ss.id.split("-").pop()}/`, ss.description);
  const leg = R.departments.find((d) => /^Legislature/.test(d.name));
  if (leg) add(`The House of Assembly for a year, ${fy}`, leg.gross, `/department/${leg.slug}/`, "Legislature, gross spending");
  const fc = pick("SELECT * FROM items WHERE dataset='fed_contract' ORDER BY amount DESC LIMIT 1");
  if (fc && fc.amount < BILLION) add(`Largest federal contract with an NL supplier: ${fc.supplier}`, fc.amount, `/item/${fc.id.split("-").pop()}/`, fc.description);
  const prof = pick(`SELECT sum(col1) v FROM programs WHERE fiscal_year=? AND kind='actual' AND line_type='detail' AND object='Professional Services' AND program='Physician Services'`, fy);
  add(`Professional services in the Physician Services program, ${fy}`, prof.v, "/priorities/", "Medical Care Plan");
  pins.sort((a, b) => a.amount - b.amount);
  // Stack the amounts one after another down the column, smallest first.
  let at = 0;
  let labelAt = -1e9;
  const placed = [];
  for (const p of pins) {
    if (at + p.amount > BILLION) break;
    const top = at / PER_PX;
    const h = p.amount / PER_PX;
    const ltop = Math.max(top, labelAt + 132); // room for a label on a phone, where the description is hidden
    labelAt = ltop;
    placed.push({ ...p, top, h, ltop, running: at + p.amount });
    at += p.amount;
  }
  const cf = [];
  for (let v = 1e8; v < BILLION; v += 1e8) cf.push(v);
  const body = html`${pagehead({ crumbs: [["/", "Home"], [null, "$1 billion, folded out"]], title: "$1 billion, folded out", lede: `One pixel is ${money(PER_PX)}, so $1 billion is a column ${num(H)} pixels long. Real Newfoundland and Labrador amounts are stacked into it in gold, smallest first, each at its true size. The blue is what is left.` })}
<section class="section" style="padding-block-start:2rem"><div class="wrap">
  <nav class="fold-jump" aria-label="Jump down the column">${cf.filter((v, i) => i % 2 === 1).map((v) => `<a href="#cf-${v / 1e8}">${moneyWords(v)}</a>`)}<a href="#fold-end">$1 billion</a></nav>
  <p class="lede" style="max-inline-size:40ch">A year of the median full-time wage is ${Math.max(1, Math.round(S.median_annual_wage.value / PER_PX))} pixels. In ${fy} the province spent ${moneyWords(R.total)}: this whole column ${(R.total / BILLION).toFixed(1)} times over.</p>
  <div class="fold" data-deploy style="block-size:${H}px">
    <div class="fold-col"></div>
    ${placed.map((p) => html`<span class="fold-blk" style="inset-block-start:${p.top.toFixed(1)}px;block-size:${Math.max(1, p.h).toFixed(1)}px" aria-hidden="true"></span>
    <div class="fold-pin" style="inset-block-start:${p.ltop.toFixed(1)}px">
      ${p.ltop > p.top + 2 ? `<span class="fold-lead" style="block-size:${(p.ltop - p.top).toFixed(1)}px" aria-hidden="true"></span>` : ""}
      <span class="txt"><b>${moneyWords(p.amount)}</b> · <a href="${esc(p.href)}">${esc(p.label)}</a><br><span class="muted small">${p.detail ? `<span class="pin-what">${esc(p.detail)} · </span>` : ""}${workTime(p.amount, S)} at the median wage · ${num(Math.max(1, Math.round(p.h)))} px</span></span>
    </div>`)}
    ${cf.map((v) => `<div class="fold-cf" id="cf-${v / 1e8}" style="inset-block-start:${v / PER_PX}px"><span>Carried forward ${moneyWords(v)}</span></div><span class="fold-tick" style="inset-block-start:${v / PER_PX}px">${moneyWords(v)}</span>`)}
    <div class="fold-end" id="fold-end"></div>
  </div>
  <div style="padding-block:2rem 0"><h2>$1,000,000,000</h2><p class="lede">${workTime(BILLION, S)} of work at the median wage. The gold above adds up to ${moneyWords(at)}. The province spent $1 billion about every ${Math.round(BILLION / (R.total / 365))} days in ${fy}.</p></div>
</div></section>`;
  return ["/scale/", { title: "How big is $1 billion? Folded out", description: desc(`One pixel is ${money(PER_PX)}. A scrolling column that shows what $1 billion is next to a median wage, and how often the province spends it.`), body, notes }];
}

// Sources and report card, methods, corrections, about, data access, the fold-out scale, 404.
import { esc, html, icon, Notes, schedule, leaders } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, date as fmtDate, workTime, SITE } from "../../lib/format.mjs";
import { pagehead, caveat, datasetLabel } from "../common.mjs";
import { connectPage } from "./connect.mjs";


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
  ["Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund, 2019-20 to 2024-25", "https://www.gov.nl.ca/exec/tbs/public-accounts/", "Department and program spending, actual against amended and original estimates."],
  ["Estimates of the Program Expenditure and Revenue of the Consolidated Revenue Fund, 2026-27", "https://www.gov.nl.ca/budget/2026/", "This year's budget by program."],
  ["Statistics Canada tables 14-10-0064, 17-10-0009, 98-10-0002, 36-10-0450", "https://www150.statcan.gc.ca/", "Median wage, population, households, provincial revenue and interest."],
  ["Canada Revenue Agency, Form NL428", "https://www.canada.ca/en/revenue-agency.html", "Provincial income tax brackets for the personal receipt."],
];

export function info(D, R) {
  const out = [];
  const counts = Object.fromEntries(D.q("SELECT dataset, count(*) n, sum(amount) a, min(nullif(date,'')) d0, max(date) d1 FROM items GROUP BY dataset").map((r) => [r.dataset, r]));

  // ---- sources + report card
  const issuesBySource = {};
  for (const i of D.issues) (issuesBySource[i.source] ||= []).push(i);
  const late = D.flagSummary["late-publication"]?.items || 0;
  const bad = D.flagSummary["date-check"]?.items || 0;
  const ppaN = counts.ppa.n;
  const card = [
    { body: "Public Procurement Agency award reports", grade: [`${pct(late / ppaN, 1)} of awards reported more than 90 days after the award date`, `${num(bad)} printed award dates fall after the report or years before it`, "4 fortnights reissued as REVISED", "Open-call awards by departments are on MERX, not in these reports"] },
    { body: "Executive Council, ministers' claims", grade: ["Every report adds up to its printed total", ...(issuesBySource["Ministerial expense claims"] || []).map((i) => `${i.url.split("/").pop()}: ${i.issue}`)] },
    { body: "House of Assembly, MHA reports", grade: ["Every category adds up to its printed period activity", `${(issuesBySource["MHA expense report"] || []).length} report links lead to a web page instead of a PDF`] },
    { body: "Treasury Board Secretariat, compensation lists", grade: [`${(issuesBySource["Compensation disclosure"] || []).length} of the workbooks linked from the disclosure page return "page not found"`, "Names are withheld for police officers (identifiers only), as the Act allows"] },
    { body: "Treasury Board Secretariat, program expenditure reports", grade: ["173 of 175 department totals match the printed statement", "The 2024-25 report prints Labrador Affairs' detail pages empty, with the text #MISSING"] },
    { body: "Province, small purchases", grade: ["No line-by-line payment data is published at all"] },
    { body: "Town of Paradise", grade: ["Every payment published monthly with vendor and description", "The register page links several months to the wrong file"] },
    { body: "City of St. John's", grade: ["Every payment published weekly", "Published as scanned images, so it cannot be searched or copied without OCR"] },
  ];
  out.push(["/sources/", {
    title: "Sources and report card",
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Sources"]], title: "Sources and report card", lede: "Where every figure comes from, what each source covers, and how well each publisher does at publishing it." })}
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1.5rem">Line-item sources</h2>
  ${SOURCES.map((s) => { const c = counts[s.ds] || {}; return html`<article id="${s.ds}" style="padding-block:1.25rem;border-block-end:1px solid var(--hair)">
    <h3>${esc(datasetLabel(s.ds))}</h3>
    <p class="small muted" style="margin:.3rem 0 .6rem">${esc(s.publisher)} · <a href="${esc(s.url)}">${esc(s.url.replace(/^https?:\/\//, "").slice(0, 60))}</a></p>
    <p>${esc(s.what)}</p><p class="small">${esc(s.form)}</p>
    <p class="small"><strong>${num(c.n || 0)} records${c.a ? `, ${moneyWords(c.a)}` : ""}</strong>${c.d0 ? `, dated ${fmtDate(c.d0)} to ${fmtDate(c.d1)}` : ""}. <a href="/search/?ds=${s.ds}">Search them</a>.</p>
  </article>`; })}
  <h2 style="margin-block:2.5rem 1rem">Other sources</h2>
  ${schedule({ cols: [{ label: "Source" }, { label: "Used for" }], rows: OTHER.map(([t, u, w]) => ({ cells: [`<a href="${u}">${esc(t)}</a>`, esc(w)] })) })}
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
    title: "Methods",
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Methods"]], title: "Methods", lede: "How each figure on this site is worked out." })}
<section class="section"><div class="wrap prose">
  <h2>Human scale</h2>
  <ul>
    <li><strong>Per person:</strong> the amount divided by the province's population, ${num(D.stats.population.value)} on ${fmtDate(D.stats.population.date)} (Statistics Canada table ${D.stats.population.table}).</li>
    <li><strong>Per household:</strong> divided by ${num(D.stats.households.value)} private households (2021 Census, table ${D.stats.households.table}).</li>
    <li><strong>Time to earn:</strong> divided by the median full-time wage, ${money(D.stats.median_weekly_wage.value, { cents: true })} a week in ${D.stats.median_weekly_wage.year} (table ${D.stats.median_weekly_wage.table}, vector ${D.stats.median_weekly_wage.vector}) times 52, which is ${money(D.stats.median_annual_wage.value)} a year. Weeks, days and hours assume 52 working weeks of five 7.5-hour days.</li>
  </ul>
  <h2>The personal receipt</h2><p><a href="/method/receipt/">How the receipt is worked out</a>.</p>
  <h2>Federal amendments</h2><p><a href="/method/federal/">How amended federal contracts and grants are counted once</a>.</p>
  <h2>Totals and checks</h2><p>Every total on this site is a sum of line items loaded from the sources. Where a source prints its own totals, the sum is compared with them; the results are on the <a href="/sources/#report-card">report card</a>.</p>
  <h2>Patterns</h2><ul>${D.catalog.flags.map((f) => `<li><a href="/method/${f.id}/">${esc(f.title)}</a></li>`)}</ul>
</div></section>`,
  }]);
  const S = D.stats;
  out.push(["/method/receipt/", {
    title: "Method: the personal receipt",
    body: html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, "The receipt"]], title: "Method: the personal receipt", lede: "What the receipt computes, and what it leaves out." })}
<section class="section"><div class="wrap prose">
  <ol>
    <li>Your provincial income tax is worked out from your income with the ${S.nl_tax.year} Newfoundland and Labrador brackets (${S.nl_tax.brackets.map((b) => `${(b[2] * 100).toFixed(1)}%${b[1] ? ` up to ${money(b[1])}` : " above that"}`).join(", ")}), less the basic personal amount credit (${money(S.nl_tax.basic_personal_amount)} at ${(S.nl_tax.brackets[0][2] * 100).toFixed(1)}%). Source: ${esc(S.nl_tax.source_label)}.</li>
    <li>The Newfoundland and Labrador low-income tax reduction is applied for a single person: $997, less 16% of income over $23,928 (form NL428, 2025). Income is treated as net income.</li>
    <li>Other credits (CPP and EI contributions, pension, age, tuition, dependants) are not applied, so the receipt overstates tax somewhat; at the median wage by about 6%.</li>
    <li>That tax is split across departments in proportion to each department's share of gross spending in ${R.year}, from the Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund.</li>
    <li>"Your share" of a contract is the contract's value times your tax divided by all provincial spending that year: the fraction of everything the province spent that your tax matches.</li>
  </ol>
  <p>Provincial spending is paid for by many revenues. Personal income tax was ${pct(S.provincial_government.personal_income_tax / S.provincial_government.revenue)} of provincial revenue in ${S.provincial_government.year} (Statistics Canada table ${S.provincial_government.table}). The receipt shows how your part would be spread, not the whole bill. Nothing you enter leaves your browser except as a web address when you press the button without JavaScript.</p>
</div></section>`,
  }]);
  const F = D.federal;
  out.push(["/method/federal/", {
    title: "Method: federal amendments",
    body: html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, "Federal amendments"]], title: "Method: federal amendments", lede: "The federal disclosure files repeat a contract every time it changes. Added up as published, they count the same money many times." })}
<section class="section"><div class="wrap prose">
  <h2>Contracts over $10,000</h2>
  <ol><li>Keep rows whose vendor postal code starts with A (Newfoundland and Labrador) and whose vendor country is Canada or blank. Two placeholder records ("Company XYZ") are dropped.</li>
  <li>Group rows by procurement identifier and vendor name (spelling and punctuation ignored), across departments: some Coast Guard purchase orders are reported by both Fisheries and Oceans and National Defence. Rows with no procurement identifier stay on their own.</li>
  <li>Keep the latest row in each group (by reporting period, then contract date). Its contract value is the running total after all amendments.</li></ol>
  <p>As published: ${num(F.contracts.raw_rows)} rows, ${money(F.contracts.raw_value)}. Counted once: ${num(F.contracts.procurements)} contracts, ${money(F.contracts.dedup_value)}. "Non-competitive" means the department coded the solicitation procedure TN.</p>
  <h2>Grants and contributions</h2>
  <p>Departments report amendments two ways. Most re-report the agreement's whole value under a new reference number each time; for those the latest amendment is kept. Indigenous Services Canada and Crown-Indigenous Relations report each amendment as the change in value (their files include negative amounts); for those the amendments are added up. Agreements are grouped by department, agreement number and recipient. Values are agreement values and can span several years. As published: ${num(F.grants.raw_rows)} rows, ${money(F.grants.raw_value)}. Counted once: ${num(F.grants.agreements)} agreements, ${money(F.grants.dedup_value)}.</p>
  <h2>CanadaBuys award notices</h2><p>Grouped by reference number and supplier, latest amendment kept. The same contract can appear here and in the contracts disclosure, so notices are shown and searchable but never added to a total.</p>
</div></section>`,
  }]);

  // ---- corrections
  out.push(["/corrections/", {
    title: "Corrections",
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Corrections"]], title: "Corrections", lede: "Every change to a published figure is logged here with the date and the reason." })}
<section class="section"><div class="wrap prose">
  <h2>Log</h2>
  <p>No published figure has been corrected yet. This prototype was first published on ${fmtDate(D.gathered)}.</p>
  <h2>Known errors in the sources</h2>
  <p>Errors found in the government's own files are not corrected here; the figure is shown as published and the error is listed on the <a href="/sources/#report-card">report card</a>.</p>
  <h2>Report an error</h2>
  <p>Every figure links to its source. If a figure here does not match the source it links to, that is an error on this site and belongs in this log. <a href="/help/#figure">Report it</a>.</p>
</div></section>`,
  }]);

  // ---- about
  out.push(["/about/", {
    title: "What is this?",
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "What is this?"]], title: "What is this?", lede: `${SITE.name} is a thought experiment: what could an ordinary citizen learn about Newfoundland and Labrador public spending from the records governments already publish?` })}
<section class="section"><div class="wrap prose">
  <p>Governments publish a great deal of spending data, but it is scattered across hundreds of PDFs, spreadsheets and web pages that few people have time to read. This prototype gathers ${num(R.itemCount)} of those records in one place and tries to make the amounts easier to picture. It gathers provincial contract awards, minister and MHA expenses, public sector pay over $100,000, department and program spending, federal contracts, grants and transfers in the province, and the payment registers two municipalities publish.</p>
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
  <h2>Status</h2>
  <p>This is a prototype. The name, the scope and the sources will change, and parts of it may be wrong. Mistakes that are found are listed on the <a href="/corrections/">Corrections</a> page. Data was last gathered on ${fmtDate(D.gathered)}.</p>
  <h2>Help build it</h2>
  <p>Anyone can suggest a source, question a method, report a figure that does not match its source, or ask for records that are not published. Most of that needs no programming. <a href="/help/">Help build this ${icon("arrow")}</a></p>
</div></section>`,
  }]);

  // ---- help build this
  const REPO = "https://github.com/steveclarke/nl-ledger";
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
    title: "Help build this",
    description: "Anyone can help make NL Ledger more accurate and more complete: add a source, challenge a method, report a figure or request data. No programming needed.",
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
  <h2>For programmers</h2>
  <p>The code is open source under the MIT licence. It fetches each source, reads it, checks it against the source's own totals and builds this site. Setup takes a few commands and no accounts. Start with the <a href="${REPO}#readme">README</a> and the <a href="${REPO}/blob/main/CONTRIBUTING.md">contributing guide</a>, or pick up <a href="${REPO}/issues">an open issue</a>.</p>
</div></div></section>`,
  }]);

  // ---- ask your AI (connect page)
  out.push(connectPage(D, R));

  // ---- the fold-out scale
  out.push(scalePage(D, R));

  // ---- 404
  out.push(["/404.html", { title: "Page not found", body: html`${pagehead({ title: "Not in the ledger", lede: "That page does not exist. Try a search." })}<section class="section"><div class="wrap"><form class="field" action="/search/" style="max-inline-size:30rem"><label for="nq">Search every payment</label><div class="field-row"><input id="nq" name="q" type="search"><button class="btn" type="submit">Search</button></div></form></div></section>` }]);
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
  add("Everything the Town of Paradise paid out in 2024", para.a, "/small-purchases/", "Paradise payment registers");
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
    const ltop = Math.max(top, labelAt + 78);
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
      <span class="txt"><b>${moneyWords(p.amount)}</b> · <a href="${esc(p.href)}">${esc(p.label)}</a><br><span class="muted small">${esc(p.detail || "")} · ${workTime(p.amount, S)} at the median wage · ${num(Math.max(1, Math.round(p.h)))} px</span></span>
    </div>`)}
    ${cf.map((v) => `<div class="fold-cf" id="cf-${v / 1e8}" style="inset-block-start:${v / PER_PX}px"><span>Carried forward ${moneyWords(v)}</span></div><span class="fold-tick" style="inset-block-start:${v / PER_PX}px">${moneyWords(v)}</span>`)}
    <div class="fold-end" id="fold-end"></div>
  </div>
  <div style="padding-block:2rem 0"><h2>$1,000,000,000</h2><p class="lede">${workTime(BILLION, S)} of work at the median wage. The gold above adds up to ${moneyWords(at)}. The province spent $1 billion about every ${Math.round(BILLION / (R.total / 365))} days in ${fy}.</p></div>
</div></section>`;
  return ["/scale/", { title: "$1 billion, folded out", body, notes }];
}

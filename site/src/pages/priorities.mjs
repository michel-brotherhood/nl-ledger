// Priorities (department and program spending, planned against actual) and one page per department.
import { esc, html, icon, Notes, leaders, bar, receipt, schedule } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, perPerson, workTime } from "../../lib/format.mjs";
import { desc, datasetLd, LICENSE } from "../seo.mjs";
import { pagehead, itemRow, ITEM_COLS, caveat, bodyHref } from "../common.mjs";
import { bodyKeysFor } from "../receiptdata.mjs";

function progTotals(D, fy, kind, dept) {
  // per program: actual (col1), amended (col2), original (col3) gross from object lines
  return D.q(
    `SELECT program_code, program, account, sum(col1) c1, sum(col2) c2, sum(col3) c3, min(page) page, source_url
     FROM programs WHERE fiscal_year=? AND kind=? AND line_type='object' AND lower(department)=lower(?)
     GROUP BY program_code, program, account ORDER BY program_code`, fy, kind, dept);
}

export function priorities(D, R) {
  const out = [];
  const S = D.stats;
  const fy = R.year;
  const notes = new Notes();
  const depts = R.departments;
  const max = Math.max(...depts.map((d) => Math.max(d.gross, d.original || 0)));
  const citeTot = notes.cite({ url: R.source.url, page: R.source.pages[0], label: `Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund ${fy}, Statement of Expenditure and Related Revenue by Department`, locator: `PDF pages ${R.source.pages.join(" and ")}` });

  // Interest against health, education, roads
  const interest = D.one(`SELECT sum(col1) v, min(page) page, source_url FROM programs WHERE fiscal_year=? AND kind='actual' AND line_type='object'
      AND department='Consolidated Fund Services' AND program_code LIKE '1.1.%'`, fy);
  const citeInt = notes.cite({ url: interest.source_url, page: interest.page, label: `Consolidated Fund Services, programs 1.1.01 to 1.1.04 (temporary borrowings, treasury bills, debentures, Canada Pension Plan borrowing), ${fy} actual` });
  const citeSC = notes.cite({ url: S.provincial_government.url, label: `Statistics Canada table ${S.provincial_government.table}, Newfoundland and Labrador provincial government, interest on debt, ${S.provincial_government.year} (vector ${S.provincial_government.vectors["Interest on debt"]})` });
  const find = (re) => depts.find((d) => re.test(d.name));
  const health = find(/^Health/);
  const edu = find(/^Education/);
  const roads = find(/^Transportation/);
  const cmp = [
    { label: `Interest on the province's borrowing${citeInt}`, value: moneyWords(interest.v), v: interest.v },
    { label: `<a href="/department/${health.slug}/">${esc(health.name)}</a>`, value: moneyWords(health.gross), v: health.gross },
    { label: `<a href="/department/${edu.slug}/">${esc(edu.name)}</a>`, value: moneyWords(edu.gross), v: edu.gross },
    { label: `<a href="/department/${roads.slug}/">${esc(roads.name)}</a> (roads, ferries, buildings)`, value: moneyWords(roads.gross), v: roads.gross },
  ];

  // Professional services by program
  const prof = D.q(`SELECT department, program, sum(col1) v, min(page) page, source_url FROM programs WHERE fiscal_year=? AND kind='actual'
      AND line_type='detail' AND object='Professional Services' GROUP BY department, program ORDER BY v DESC LIMIT 15`, fy);
  const profTotal = D.one(`SELECT sum(col1) v FROM programs WHERE fiscal_year=? AND kind='actual' AND line_type='detail' AND object='Professional Services'`, fy).v;

  // Year over year
  const names = depts.map((d) => d.name);
  const years = D.years;
  const yoy = names.slice(0, 12).map((n) => ({ name: n, vals: years.map((y) => D.deptYear[y].find((d) => d.name.toLowerCase() === n.toLowerCase())?.gross) }));

  // Federal money in
  const mtp = D.federal.public_accounts.mtp_2024_25;
  const mtpRows = Object.entries(mtp).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const citeMtp = notes.cite({ url: "https://donnees-data.tpsgc-pwgsc.gc.ca/ba1/ppt-mtp/ppt-mtp-2025.csv", label: "Public Accounts of Canada 2025, Volume III, major transfers to other levels of government by province, Newfoundland and Labrador, 2024-25 ($ millions as published)" });

  const body = html`
${pagehead({ crumbs: [["/", "Home"], [null, "Priorities"]], title: "Priorities", lede: `What the province spent in ${fy}, department by department, against what the budget said. ${moneyWords(R.total)} in all${citeTot}.` })}
<section class="section"><div class="wrap">
  <div class="section-head"><h2>Spent against budget, ${fy}</h2>
  <p>The budget's original estimate is what the House of Assembly was told in the spring. Departments can get more during the year; the amended figures are on each department's page.</p></div>
  <ul class="legend"><li><span class="sw"></span>Spent (actual)</li><li><span class="sw ghost"></span>Original estimate</li></ul>
  <div class="sched-wrap"><table class="sched">
    <thead><tr><th scope="col">Department</th><th scope="col" class="hide-sm" style="inline-size:34%">Spent against estimate</th><th scope="col" class="n">Spent</th><th scope="col" class="n">Estimate</th><th scope="col" class="n">Over (under) estimate</th><th scope="col" class="n hide-sm">Share</th></tr></thead>
    <tbody>${depts.map((d) => {
      const diff = d.original != null ? d.gross - d.original : null;
      return html`<tr><th scope="row"><a href="/department/${d.slug}/">${esc(d.name)}</a></th>
      <td class="hide-sm"><span class="pair">${bar(d.gross, max)}${d.original != null ? bar(d.original, max, "ghost") : ""}</span></td>
      <td class="n">${moneyWords(d.gross)}</td><td class="n">${d.original != null ? moneyWords(d.original) : "not printed"}</td>
      <td class="n${diff < 0 ? " neg" : ""}">${diff == null ? "" : diff < 0 ? `(${moneyWords(-diff)})` : moneyWords(diff)}</td>
      <td class="n hide-sm">${pct(d.share, 1)}</td></tr>`;
    })}</tbody>
    <tfoot><tr class="total"><th scope="row">Total</th><td class="hide-sm"></td><td class="n">${moneyWords(R.total)}</td><td class="n">${moneyWords(depts.reduce((s, d) => s + (d.original || 0), 0))}</td><td></td><td class="n hide-sm">100%</td></tr></tfoot>
  </table></div>
  <p class="small muted">Amounts in parentheses, in red, are spending below the original estimate. Gross spending, before revenue departments collect themselves (federal cost-sharing, fees). Estimates are summed from the program lines of the same report. The 2024-25 report prints no program detail for Labrador Affairs; its total comes from the summary statement.</p>
</div></section>

<section class="section"><div class="wrap grid-2">
  <div><div class="section-head"><h2>Interest against health, schools and roads</h2>
  <p>Interest on the province's borrowing is paid out of Consolidated Fund Services.</p></div>
  ${leaders(cmp.map((c) => ({ label: c.label, value: c.value })))}
  <p class="small muted" style="margin-block-start:1rem">The interest figure is the gross spending on programs 1.1.01 to 1.1.04 in the report, before any interest the province itself earns. Statistics Canada, measuring differently, puts provincial interest on debt in ${S.provincial_government.year} at ${moneyWords(S.provincial_government.interest_on_debt)}${citeSC}.</p></div>
  <div><h3 style="margin-block-end:1rem">Every dollar spent in ${fy}</h3>
  <div class="stack" role="img" aria-label="Share of spending: interest ${pct(interest.v / R.total)}, health ${pct(health.gross / R.total)}, education ${pct(edu.gross / R.total)}, transportation ${pct(roads.gross / R.total)}">
    <span style="flex:${interest.v};background:var(--red)"></span><span style="flex:${health.gross};background:var(--bar)"></span><span style="flex:${edu.gross};background:var(--lv-municipal)"></span><span style="flex:${roads.gross};background:var(--graphite)"></span><span style="flex:${R.total - interest.v - health.gross - edu.gross - roads.gross};background:var(--bar-ghost)"></span></div>
  <ul class="legend"><li><span class="sw" style="background:var(--red)"></span>Interest ${pct(interest.v / R.total)}</li><li><span class="sw"></span>Health ${pct(health.gross / R.total)}</li><li><span class="sw lv-municipal"></span>Education ${pct(edu.gross / R.total)}</li><li><span class="sw" style="background:var(--graphite)"></span>Transportation ${pct(roads.gross / R.total)}</li><li><span class="sw ghost"></span>Everything else</li></ul>
  </div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><h2>Professional services by program, ${fy}</h2>
  <p>"Professional services" is the account governments use for outside expertise such as consultants. In health it is mostly doctors paid fee-for-service under the Medical Care Plan, so read the program name before reading the figure. Total across government: ${moneyWords(profTotal)}. <a href="/consulting/">Consultants and professional services, by year and department</a>.</p></div>
  ${schedule({
    cols: [{ label: "Program" }, { label: "Department" }, { label: "Professional services", num: true }, { label: "Source", num: true }],
    rows: prof.map((p) => ({ cells: [esc(p.program), esc(D.pretty(p.department)), moneyWords(p.v), receipt(p.source_url, p.page)] })),
  })}
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><h2>Year over year</h2><p>Gross spending by department as each year's report printed it. Departments were renamed and reorganised over these years; a blank means the department did not exist under that name.</p></div>
  <div class="sched-wrap"><table class="sched compact">
    <thead><tr><th scope="col">Department</th>${years.map((y) => `<th scope="col" class="n">${y}</th>`)}</tr></thead>
    <tbody>${yoy.map((r) => html`<tr><th scope="row">${esc(r.name)}</th>${r.vals.map((v) => `<td class="n">${v ? moneyWords(v) : ""}</td>`)}</tr>`)}</tbody>
    <tfoot><tr class="total"><th scope="row">All departments</th>${years.map((y) => `<td class="n">${moneyWords(D.deptYear[y].reduce((s, d) => s + d.gross, 0))}</td>`)}</tr></tfoot>
  </table></div>
  <p style="margin-block-start:1.5rem"><a href="/department/estimates-2026-27/">The 2026-27 budget estimates by department ${icon("arrow")}</a></p>
</div></section>

<section class="section"><div class="wrap grid-2">
  <div><div class="section-head"><h2>Federal money flowing in</h2>
  <p>Major federal transfers in 2024-25: to the provincial government (health and social transfers, fiscal arrangements) and to people directly (Old Age Security, Employment Insurance)${citeMtp}.</p></div>
  ${leaders([...mtpRows.map(([k, v]) => ({ label: esc(k), value: moneyWords(v) })), { label: "Total", value: moneyWords(mtpRows.reduce((s, [, v]) => s + v, 0)), cls: "total" }])}
  <p style="margin-block-start:1rem"><a href="/federal/">Federal contracts and grants in the province ${icon("arrow")}</a></p></div>
  <div>${caveat("Federal transfers to people (Old Age Security, Employment Insurance) are not provincial spending. They are here because they are public money arriving in the province, and are often larger than a whole provincial department.")}</div>
</div></section>`;
  out.push(["/priorities/", { title: `NL government spending by department, ${fy}`,
    description: desc(`The Newfoundland and Labrador government spent ${moneyWords(R.total)} in ${fy}. Every department and program, actual against budget, with the source page for each figure.`),
    body, notes,
    jsonld: [datasetLd({ name: `Newfoundland and Labrador spending by department and program, ${D.years[0]} to ${fy}`, description: "Gross spending by department and program, actual against amended and original estimates, from the province's Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund.", path: "/priorities/", license: LICENSE.provincial, period: `${D.years[0].slice(0, 4)}/20${fy.slice(-2)}`, files: ["/data/departments.json"], publishers: [{ name: "Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund", url: "https://www.gov.nl.ca/exec/tbs/public-accounts/" }] })] }]);
  return out;
}

export function departments(D, R) {
  const out = [];
  const S = D.stats;
  const fy = R.year;
  // every department that appears in any year's report, plus the estimates
  const all = new Map();
  for (const y of D.years) for (const d of D.deptYear[y]) {
    const k = d.name.toLowerCase();
    if (!all.has(k)) all.set(k, { name: d.name, years: [] });
    all.get(k).years.push(y);
  }
  const est = D.q("SELECT DISTINCT department FROM programs WHERE kind='estimates'").map((r) => r.department);
  const estYear = D.one("SELECT max(fiscal_year) y FROM programs WHERE kind='estimates'").y;
  for (const n of est) {
    const k = n.toLowerCase();
    if (!all.has(k)) all.set(k, { name: n, years: [] });
    all.get(k).est = true;
  }

  for (const dep of all.values()) {
    const notes = new Notes();
    const slug = D.slug(dep.name);
    const latest = dep.years[dep.years.length - 1];
    const sum = latest ? D.deptYear[latest].find((d) => d.name.toLowerCase() === dep.name.toLowerCase()) : null;
    const progs = latest ? progTotals(D, latest, "actual", dep.name) : [];
    const estProgs = dep.est ? progTotals(D, estYear, "estimates", dep.name) : [];
    const cite = sum ? notes.cite({ url: sum.url, page: [...sum.pages][0], label: `Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund ${latest}, Statement of Expenditure and Related Revenue by Department` }) : "";
    const keys = bodyKeysFor(D, dep.name);
    const awards = keys.length
      ? D.q(`SELECT * FROM items WHERE dataset='ppa' AND buyer_key IN (${keys.map(() => "?").join(",")}) ORDER BY date DESC LIMIT 400`, ...keys)
      : [];
    const awardTotal = awards.reduce((s, a) => s + (a.amount || 0), 0);
    const noComp = awards.filter((a) => (D.itemFlags.get(a.id) || []).includes("no-competition"));
    const prof = latest ? D.q(`SELECT program, sum(col1) v, min(page) page, source_url FROM programs WHERE fiscal_year=? AND kind='actual' AND line_type='detail'
        AND object='Professional Services' AND lower(department)=lower(?) GROUP BY program ORDER BY v DESC LIMIT 10`, latest, dep.name) : [];
    const trend = dep.years.map((y) => ({ y, v: D.deptYear[y].find((d) => d.name.toLowerCase() === dep.name.toLowerCase())?.gross }));
    const tmax = Math.max(...trend.map((t) => t.v || 0), 1);

    const figs = sum ? html`<div class="figs">
      <div><span class="big">${moneyWords(sum.gross)}</span><span class="what">spent by the province in ${latest}${cite}</span></div>
      <div><span class="big">${money(perPerson(sum.gross, S))}</span><span class="what">of provincial spending for every person in the province</span></div>
      <div><span class="big">${workTime(sum.gross, S)}</span><span class="what">of work at the median full-time wage to earn what the province spent</span></div>
    </div>` : "";

    const progTable = progs.length ? schedule({
      caption: `Programs, ${latest}`,
      id: "programs",
      cols: [{ label: "Program" }, { label: "Spent", num: true }, { label: "Amended", num: true }, { label: "Original estimate", num: true }, { label: "Source", num: true }],
      rows: progs.map((p) => ({ cells: [`${esc(p.program)}<span class="meta">${p.program_code} · ${p.account === "CAPITAL" ? "capital" : "current"}</span>`, money(p.c1), money(p.c2), money(p.c3), receipt(p.source_url, p.page)] })),
      foot: [{ cells: ["Gross spending", money(progs.reduce((s, p) => s + p.c1, 0)), money(progs.reduce((s, p) => s + p.c2, 0)), money(progs.reduce((s, p) => s + p.c3, 0)), ""] }],
    }) : `<p>The ${latest || ""} report prints no program detail for this department.</p>`;

    const estTable = estProgs.length ? schedule({
      caption: `Budget estimates, ${estYear}`,
      cols: [{ label: "Program" }, { label: `Estimate ${estYear}`, num: true }, { label: "Revised, year before", num: true }, { label: "Budget, year before", num: true }, { label: "Source", num: true }],
      rows: estProgs.map((p) => ({ cells: [`${esc(p.program)}<span class="meta">${p.program_code}</span>`, money(p.c1), money(p.c2), money(p.c3), receipt(p.source_url, p.page)] })),
      foot: [{ cells: ["Gross", money(estProgs.reduce((s, p) => s + p.c1, 0)), money(estProgs.reduce((s, p) => s + p.c2, 0)), money(estProgs.reduce((s, p) => s + p.c3, 0)), ""] }],
    }) : "";

    const body = html`
${pagehead({ crumbs: [["/", "Home"], ["/priorities/", "Priorities"], [null, dep.name]], title: esc(dep.name), lede: dep.years.length ? `Reported under this name in ${dep.years.join(", ")}${dep.est ? ` and in the ${estYear} estimates` : ""}.` : `Appears in the ${estYear} budget estimates.` })}
<section class="section"><div class="wrap">
  ${figs}
  ${trend.length > 1 ? html`<h3 style="margin-block-end:.8rem">Spending by year</h3>${schedule({ compact: true, cols: [{ label: "Fiscal year" }, { label: "", w: "50%" }, { label: "Spent", num: true }], rows: trend.map((t) => ({ cells: [t.y, bar(t.v || 0, tmax), t.v ? moneyWords(t.v) : ""] })) })}` : ""}
</div></section>
<section class="section"><div class="wrap">${progTable}</div></section>
${estTable ? `<section class="section"><div class="wrap">${estTable}</div></section>` : ""}
${prof.length ? html`<section class="section"><div class="wrap"><div class="section-head"><h2>Professional services</h2><p>Outside expertise, including consultants, paid from this department's programs in ${latest}.</p></div>
  ${schedule({ cols: [{ label: "Program" }, { label: "Professional services", num: true }, { label: "Source", num: true }], rows: prof.map((p) => ({ cells: [esc(p.program), money(p.v), receipt(p.source_url, p.page)] })) })}</div></section>` : ""}
${awards.length ? html`<section class="section"><div class="wrap">
  <div class="section-head"><h2>Contracts awarded</h2>
  <p>${num(awards.length)} awards in the Public Procurement Agency reports since 2021, ${moneyWords(awardTotal)} in all; ${num(noComp.length)} of them (${moneyWords(noComp.reduce((s, a) => s + (a.amount || 0), 0))}) without an open competition. Open-call awards by departments are posted on MERX instead and are not in these reports.</p></div>
  ${schedule({ cols: ITEM_COLS, rows: awards.slice(0, 60).map((a) => itemRow(D, a, { showBuyer: false })) })}
  ${awards.length > 60 ? `<p><a href="${bodyHref(D, awards[0].buyer)}">All ${num(awards.length)} awards</a></p>` : ""}
</div></section>` : ""}`;
    const budgeted = progs.reduce((t, p) => t + (p.c3 || 0), 0);
    const spent = sum ? `${dep.name} spent ${moneyWords(sum.gross)} in ${latest}${budgeted > 0 ? `, against a budget of ${moneyWords(budgeted)}` : ""}.` : `${dep.name}: the ${estYear} budget estimates by program.`;
    out.push([`/department/${slug}/`, { title: `${dep.name} spending, ${latest || estYear}`,
      description: desc(`${spent} Spending by program and contracts awarded, with sources.`), body, notes }]);
  }

  // estimates overview
  const estRows = D.q(`SELECT department, sum(col1) c1, sum(col2) c2, sum(col3) c3, min(page) page, source_url FROM programs
      WHERE kind='estimates' AND line_type='object' GROUP BY department ORDER BY c1 DESC`);
  const notes = new Notes();
  const estTotal = estRows.reduce((s, r) => s + r.c1, 0);
  const cite = notes.cite({ url: estRows[0].source_url, label: `Estimates of the Program Expenditure and Revenue of the Consolidated Revenue Fund ${estYear}, gross expenditure summed from each department's program lines` });
  const body = html`${pagehead({ crumbs: [["/", "Home"], ["/priorities/", "Priorities"], [null, `Estimates ${estYear}`]], title: `Budget estimates, ${estYear}`, lede: `What the province plans to spend this year: ${moneyWords(estTotal)} gross${cite}, set against last year's revised figures. The government reorganised departments in late 2025, so many names are new.` })}
<section class="section"><div class="wrap">${schedule({
    cols: [{ label: "Department" }, { label: `Estimate ${estYear}`, num: true }, { label: "Revised, year before", num: true }, { label: "Budget, year before", num: true }, { label: "Source", num: true }],
    rows: estRows.map((r) => ({ cells: [`<a href="/department/${D.slug(r.department)}/">${esc(r.department)}</a>`, moneyWords(r.c1), moneyWords(r.c2), moneyWords(r.c3), receipt(r.source_url, r.page)] })),
    foot: [{ cells: ["Total", moneyWords(estTotal), moneyWords(estRows.reduce((s, r) => s + r.c2, 0)), moneyWords(estRows.reduce((s, r) => s + r.c3, 0)), ""] }],
  })}</div></section>`;
  out.push([`/department/estimates-${estYear}/`, { title: `NL budget ${estYear}: spending planned by department`, description: desc(`What the Newfoundland and Labrador government plans to spend in ${estYear}, department by department and program by program, from the budget estimates.`), body, notes }]);
  return out;
}

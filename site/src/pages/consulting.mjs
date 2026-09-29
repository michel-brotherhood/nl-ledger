// Consulting and professional services: what the province and Ottawa pay for outside expertise.
// Built from the "Professional Services" account in the province's program report and the federal
// Public Accounts payments to suppliers in the province, so the page answers "how much does the
// government spend on consultants" directly instead of leaving it to a search box.
import { esc, html, Notes, schedule, receipt, bar } from "../../lib/html.mjs";
import { money, moneyWords, num } from "../../lib/format.mjs";
import { desc } from "../seo.mjs";
import { pagehead, caveat } from "../common.mjs";

export function consulting(D, R) {
  const notes = new Notes();
  const fy = R.year;
  const Q = `FROM programs WHERE kind='actual' AND line_type='detail' AND object='Professional Services'`;
  const byYear = D.q(`SELECT fiscal_year y, sum(col1) v ${Q} GROUP BY fiscal_year ORDER BY fiscal_year`);
  const latest = byYear.find((r) => r.y === fy) || byYear[byYear.length - 1];
  const byDept = D.q(`SELECT department, sum(col1) v, min(page) page, source_url ${Q} AND fiscal_year=? GROUP BY department ORDER BY v DESC LIMIT 15`, latest.y);
  const byProg = D.q(`SELECT department, program, sum(col1) v, min(page) page, source_url ${Q} AND fiscal_year=? GROUP BY department, program ORDER BY v DESC LIMIT 15`, latest.y);
  const fed = D.q(`SELECT fiscal_year y, count(*) n, sum(amount) v FROM items WHERE dataset='pa_pss' GROUP BY fiscal_year ORDER BY fiscal_year`);
  const src = byDept[0];
  const cite = notes.cite({ url: src.source_url, label: `Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund ${latest.y}, object "Professional Services", all programs` });
  const vmax = Math.max(...byYear.map((r) => r.v), 1);
  const body = html`${pagehead({ crumbs: [["/", "Home"], [null, "Consultants and professional services"]], title: "Government consultants and professional services spending", lede: `The province's own accounts put spending on outside expertise, such as consultants, in one line called Professional Services. In ${latest.y} it came to ${moneyWords(latest.v)}${cite}.` })}
<section class="section"><div class="wrap">
  ${caveat(`"Professional Services" is broader than consulting. In health it is mostly doctors paid fee-for-service under the Medical Care Plan, and it includes legal, engineering and other outside services, so read the program name before reading the figure. This account gives totals by program, not individual contracts; contract awards that mention consulting are in the <a href="/search/?q=consulting">search</a>.`)}
  <div class="grid-2">
    <div><h2 style="margin-block-end:1rem">By year</h2>
    ${schedule({ compact: true, cols: [{ label: "Fiscal year" }, { label: "", w: "50%" }, { label: "Professional services", num: true }], rows: byYear.map((r) => ({ cells: [esc(r.y), bar(r.v, vmax), moneyWords(r.v)] })) })}</div>
    <div><h2 style="margin-block-end:1rem">By department, ${esc(latest.y)}</h2>
    ${schedule({ compact: true, cols: [{ label: "Department" }, { label: "Professional services", num: true }, { label: "Source", num: true }], rows: byDept.map((d) => ({ cells: [`<a href="/department/${D.slug(D.pretty(d.department))}/">${esc(D.pretty(d.department))}</a>`, moneyWords(d.v), receipt(d.source_url, d.page)] })) })}</div>
  </div>
</div></section>
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1rem">Largest programs, ${esc(latest.y)}</h2>
  ${schedule({ cols: [{ label: "Program" }, { label: "Department" }, { label: "Professional services", num: true }, { label: "Source", num: true }], rows: byProg.map((p) => ({ cells: [esc(p.program), esc(D.pretty(p.department)), money(p.v), receipt(p.source_url, p.page)] })) })}
</div></section>
${fed.length ? html`<section class="section"><div class="wrap">
  <div class="section-head"><h2>Federal payments for professional and special services</h2><p>Payments over $100,000 by federal departments to suppliers in the province, from the Public Accounts of Canada.</p></div>
  ${schedule({ compact: true, cols: [{ label: "Fiscal year" }, { label: "Payments", num: true }, { label: "Paid", num: true }], rows: fed.map((r) => ({ cells: [esc(r.y), num(r.n), moneyWords(r.v)] })) })}
  <p><a href="/search/?ds=pa_pss">Search these federal payments</a> · <a href="/search/?q=consulting">Search every record for consulting</a></p>
</div></section>` : ""}`;
  return ["/consulting/", { title: "Government consultants and professional services spending", description: desc(`The Newfoundland and Labrador government spent ${moneyWords(latest.v)} on professional services, its account for consultants and outside experts, in ${latest.y}. By department and program.`), body, notes }];
}

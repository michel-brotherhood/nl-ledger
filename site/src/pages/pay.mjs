// Public sector pay over $100,000 (the compensation disclosure lists), by employer and year.
// No page per person: the lists are shown the way the government publishes them.
import { esc, html, icon, Notes, schedule, receipt, bar, leaders } from "../../lib/html.mjs";
import { money, moneyWords, num, pct } from "../../lib/format.mjs";
import { desc, clip, datasetLd, LICENSE } from "../seo.mjs";
import { pagehead, caveat } from "../common.mjs";

export function pay(D, R) {
  const out = [];
  const emp = D.q(`SELECT buyer, count(*) n, sum(amount) amount, group_concat(DISTINCT substr(fiscal_year,10)) yrs FROM items WHERE dataset='sunshine' GROUP BY buyer ORDER BY amount DESC`);
  const years = D.q("SELECT DISTINCT substr(fiscal_year,10) y FROM items WHERE dataset='sunshine' ORDER BY y").map((r) => r.y);
  const latest = years[years.length - 1];
  const grid = new Map();
  for (const r of D.q("SELECT buyer, substr(fiscal_year,10) y, count(*) n, sum(amount) a FROM items WHERE dataset='sunshine' GROUP BY buyer, y")) {
    (grid.get(r.buyer) || grid.set(r.buyer, {}).get(r.buyer))[r.y] = r;
  }
  const grp = (f) => D.flagRows.filter((r) => r.flag === f && !r.item_id).map((r) => JSON.parse(r.detail));
  const otPeople = grp("overtime-over-base").reduce((s, x) => s + x.people, 0);
  const otAmt = grp("overtime-over-base").reduce((s, x) => s + x.overtime, 0);
  const sevPeople = grp("severance").reduce((s, x) => s + x.people, 0);
  const sevAmt = grp("severance").reduce((s, x) => s + x.severance, 0);
  const broken = D.issues.filter((i) => i.source === "Compensation disclosure");
  const idx = html`${pagehead({ crumbs: [["/", "Home"], [null, "Pay over $100,000"]], title: "Public sector salaries over $100,000: the sunshine list", lede: "Often called the sunshine list: every public employee paid more than $100,000 in a calendar year, salary, overtime and other pay together, as the Public Sector Compensation Transparency Act requires each employer to publish. Amounts are rounded to $100 by the publisher." })}
<section class="section"><div class="wrap">
  <div class="figs">
    <div><span class="big">${num(grid.size ? [...grid.values()].reduce((s, g) => s + (g[latest]?.n || 0), 0) : 0)}</span><span class="what">people on the ${latest} lists</span></div>
    <div><span class="big">${num(otPeople)}</span><span class="what">times someone's overtime was bigger than their salary, 2022 to ${latest}; ${moneyWords(otAmt)} of overtime (<a href="/flags/overtime-over-base/">by job</a>)</span></div>
    <div><span class="big">${moneyWords(sevAmt)}</span><span class="what">paid in severance, ${num(sevPeople)} payments, 2022 to ${latest} (<a href="/flags/severance/">by job</a>)</span></div>
  </div>
  ${caveat(`The lists count everyone over $100,000, including overtime, so a rise in names does not mean a rise in salaries. The 2022 and 2023 core government lists are much shorter than 2024 and 2025 as published. ${broken.length} files linked from the government's disclosure page could not be downloaded (they return "page not found"), including Newfoundland and Labrador Health Services for 2023; those years are missing here.`)}
</div></section>
<section class="section"><div class="wrap">
  ${schedule({ cols: [{ label: "Employer" }, ...years.map((y) => ({ label: y, num: true }))],
    rows: emp.map((e) => ({ cells: [`<a href="/pay/${D.slug(e.buyer)}/">${esc(e.buyer)}</a>`, ...years.map((y) => { const g = grid.get(e.buyer)?.[y]; return g ? `${num(g.n)}<span class="meta">${moneyWords(g.a)}</span>` : "<span class=\"muted\">not available</span>"; })] })) })}
</div></section>`;
  const latestN = [...grid.values()].reduce((t, g) => t + (g[latest]?.n || 0), 0);
  out.push(["/pay/", { title: "NL sunshine list: public sector pay over $100,000",
    description: desc(`Newfoundland and Labrador's sunshine list for ${latest}: ${num(latestN)} public employees paid over $100,000, by employer, with job titles, overtime and severance.`),
    body: idx,
    jsonld: [datasetLd({ name: "Newfoundland and Labrador public sector compensation over $100,000 (sunshine list)", description: "Every public employee paid more than $100,000 in a calendar year, by employer, as disclosed under the Public Sector Compensation Transparency Act.", path: "/pay/", license: LICENSE.provincial, period: `${years[0]}/${latest}`, publishers: [{ name: "Compensation disclosure, Treasury Board Secretariat", url: "https://www.gov.nl.ca/exec/tbs/home/publications/compensation-disclosure/" }] })] }]);

  for (const e of emp) {
    const notes = new Notes();
    const perYear = years.filter((y) => grid.get(e.buyer)?.[y]);
    const top = D.q(`SELECT * FROM items WHERE dataset='sunshine' AND buyer=? AND fiscal_year=? ORDER BY amount DESC LIMIT 100`, e.buyer, `calendar ${perYear[perYear.length - 1]}`);
    const titles = D.q(`SELECT description, count(*) n, sum(amount) a, avg(amount) avg FROM items WHERE dataset='sunshine' AND buyer=? AND fiscal_year=? GROUP BY description ORDER BY n DESC LIMIT 15`, e.buyer, `calendar ${perYear[perYear.length - 1]}`);
    const src = D.q(`SELECT DISTINCT substr(fiscal_year,10) y, source_url FROM items WHERE dataset='sunshine' AND buyer=? ORDER BY y`, e.buyer);
    const bh = D.keyHash(D.one("SELECT buyer_key k FROM items WHERE dataset='sunshine' AND buyer=? LIMIT 1", e.buyer).k);
    const body = html`${pagehead({ crumbs: [["/", "Home"], ["/pay/", "Pay over $100,000"], [null, e.buyer]], title: esc(e.buyer), lede: `Compensation disclosure lists for ${perYear.join(", ")}. ${src.map((s) => `<a href="${esc(s.source_url)}">${s.y} list</a>`).join(" · ")}` })}
<section class="section"><div class="wrap grid-2">
  <div>${schedule({ compact: true, caption: "By year", cols: [{ label: "Year" }, { label: "People", num: true }, { label: "Total pay", num: true }], rows: perYear.map((y) => { const g = grid.get(e.buyer)[y]; return { cells: [y, num(g.n), moneyWords(g.a)] }; }) })}</div>
  <div>${schedule({ compact: true, caption: `Most common job titles, ${perYear[perYear.length - 1]}`, cols: [{ label: "Title as published" }, { label: "People", num: true }, { label: "Average", num: true }], rows: titles.map((t) => ({ cells: [esc(t.description), num(t.n), money(t.avg)] })) })}</div>
</div></section>
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1rem">Highest paid, ${perYear[perYear.length - 1]}</h2>
  ${schedule({ cols: [{ label: "Name as published" }, { label: "Base", num: true }, { label: "Overtime", num: true }, { label: "Other", num: true }, { label: "Total", num: true }, { label: "Row", num: true }],
    rows: top.map((p) => {
      const x = JSON.parse(p.extra || "{}");
      const other = (x.bonus || 0) + (x.shift || 0) + (x.retro || 0) + (x.severance || 0) + (x.other || 0);
      return { cells: [`${esc(p.person)}<span class="meta">${esc(p.description)}${x.unit ? ` · ${esc(x.unit)}` : ""}</span>`, money(x.base), money(x.overtime), money(other), money(p.amount), `<a class="rcpt" href="${esc(p.source_url)}" title="${esc(p.locator)}">${esc(p.locator.replace(/^sheet [^,]+, /, ""))}</a>`] };
    }) })}
  <p><a href="/search/?ds=sunshine&b=${bh}">Search everyone on ${esc(e.buyer)}'s lists ${icon("arrow")}</a></p>
</div></section>`;
    const ly = perYear[perYear.length - 1];
    const g = grid.get(e.buyer)[ly];
    out.push([`/pay/${D.slug(e.buyer)}/`, { title: `${clip(e.buyer, 38)} salaries over $100,000, ${ly}`,
      description: desc(`${num(g.n)} ${e.buyer} employees were paid over $100,000 in ${ly}, ${moneyWords(g.a)} in all. Job titles, average pay, overtime and the highest paid, from the sunshine list.`),
      body, notes,
      jsonld: [datasetLd({ name: `${e.buyer}: employees paid over $100,000, ${perYear[0]} to ${ly}`, description: `Public employees of ${e.buyer} paid more than $100,000 in a calendar year, from the compensation disclosure lists.`, path: `/pay/${D.slug(e.buyer)}/`, license: LICENSE.provincial, period: `${perYear[0]}/${ly}`, publishers: src.map((x) => ({ name: `${e.buyer} compensation disclosure, ${x.y}`, url: x.source_url })) })] }]);
  }
  return out;
}

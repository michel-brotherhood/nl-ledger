// MHAs and ministers: expense records as published, per member.
import { esc, html, icon, Notes, schedule, receipt, bar, leaders, spotError } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, date as fmtDate } from "../../lib/format.mjs";
import { desc, personLd, datasetLd, LICENSE } from "../seo.mjs";
import { pagehead, caveat } from "../common.mjs";

function nameOrder(n) {
  // "Dinn, Paul" -> "Paul Dinn"
  const m = /^([^,]+),\s*(.+)$/.exec(n || "");
  return m ? `${m[2]} ${m[1]}` : n;
}

export function members(D, R) {
  const out = [];
  const mhas = D.q(`SELECT person, count(*) n, sum(amount) amount, min(fiscal_year) y0, max(fiscal_year) y1,
      json_extract(extra,'$.district') district FROM items WHERE dataset='mha' GROUP BY person ORDER BY person`);
  const years = D.q("SELECT DISTINCT fiscal_year y FROM items WHERE dataset='mha' ORDER BY y").map((r) => r.y);
  const mins = D.q(`SELECT person, count(*) n, sum(amount) amount, min(date) d0, max(date) d1 FROM items WHERE dataset='minister' GROUP BY person ORDER BY amount DESC`);

  // MHA annual totals per member for the index
  const perYear = new Map();
  for (const r of D.q("SELECT person, fiscal_year, sum(amount) a FROM items WHERE dataset='mha' GROUP BY person, fiscal_year")) {
    (perYear.get(r.person) || perYear.set(r.person, {}).get(r.person))[r.fiscal_year] = r.a;
  }
  const latestFull = years[years.length - 2] || years[years.length - 1];
  const ranked = mhas.filter((m) => perYear.get(m.person)?.[latestFull]).sort((a, b) => perYear.get(b.person)[latestFull] - perYear.get(a.person)[latestFull]);
  const rmax = ranked[0] ? perYear.get(ranked[0].person)[latestFull] : 1;

  const idxBody = html`${pagehead({ flagged: true, crumbs: [["/", "Home"], [null, "Members"]], title: "MHA expenses and minister expense claims", lede: "What each Member of the House of Assembly (MHA) claimed against their office, travel and constituency allowances, and what each minister claimed in expenses, line by line as the House and Executive Council publish it." })}
<section class="section"><div class="wrap grid-2">
  <div><div class="section-head"><h2>MHA spending, ${latestFull}</h2><p>Office, travel and constituency allowances. The House publishes a limit for most categories; <a href="/flags/over-allowance/">no member went past one</a>. Members who served part of the year, or who are ministers or party leaders with other budgets, spend less from these allowances, so the list is not a ranking of thrift.</p></div>
  ${schedule({ compact: true, cols: [{ label: "Member" }, { label: "", w: "36%" }, { label: "Spent", num: true }], rows: ranked.map((m) => ({ cells: [`<a href="/mha/${D.slug(m.person)}/">${esc(nameOrder(m.person))}</a><span class="meta">${esc(m.district || "")}</span>`, bar(perYear.get(m.person)[latestFull], rmax), money(perYear.get(m.person)[latestFull])] })) })}
  </div>
  <div><div class="section-head"><h2>Ministers' claims</h2><p>Travel, meals, accommodation and car allowance paid to cabinet ministers, December 2020 to May 2026.</p></div>
  ${schedule({ compact: true, cols: [{ label: "Minister" }, { label: "Claims", num: true }, { label: "Paid", num: true }], rows: mins.map((m) => ({ cells: [`<a href="/ministers/${D.slug(m.person)}/">${esc(m.person)}</a>`, num(m.n), money(m.amount)] })) })}
  <h3 style="margin-block:2rem .8rem">Every MHA since 2020-21</h3>
  <ul class="twocol">${mhas.map((m) => `<li><a href="/mha/${D.slug(m.person)}/">${esc(nameOrder(m.person))}</a><span>${moneyWords(m.amount)}</span></li>`)}</ul>
  </div>
</div></section>`;
  out.push(["/members/", { title: "MHA expenses in Newfoundland and Labrador", description: desc(`What every MHA claimed in allowances in ${latestFull}, ranked, plus minister expense claims. Each line links to the published report.`),
    body: idxBody,
    jsonld: [datasetLd({ name: "Newfoundland and Labrador MHA expenses and minister expense claims", description: "Every line charged to each Member of the House of Assembly's allowances, and every minister's expense claim, as published by the House of Assembly and Executive Council.", path: "/members/", license: [LICENSE.assembly, LICENSE.provincial], period: `${years[0].slice(0, 4)}/..`, files: ["/data/members.json"], publishers: [{ name: "Member Accountability and Disclosure Reports, House of Assembly", url: "https://www.assembly.nl.ca/Members/Expenses/" }, { name: "Ministers' expense claims, Executive Council", url: "https://www.gov.nl.ca/exec/cabinet/expenseclaims/" }] })] }]);

  // Per MHA
  for (const m of mhas) {
    const notes = new Notes();
    const lines = D.q("SELECT * FROM items WHERE dataset='mha' AND person=? ORDER BY fiscal_year DESC, method, date", m.person);
    const byYearCat = new Map();
    for (const l of lines) {
      const k = `${l.fiscal_year}|${l.method}`;
      const e = byYearCat.get(k) || { y: l.fiscal_year, cat: l.method, n: 0, a: 0, url: l.source_url, page: l.page };
      e.n++;
      e.a += l.amount || 0;
      e.page = Math.min(e.page, l.page);
      byYearCat.set(k, e);
    }
    const yrs = [...new Set(lines.map((l) => l.fiscal_year))];
    const vendors = D.q("SELECT supplier, supplier_key, count(*) n, sum(amount) a FROM items WHERE dataset='mha' AND person=? AND supplier IS NOT NULL GROUP BY supplier_key ORDER BY a DESC LIMIT 12", m.person);
    const big = lines.slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 25);
    const phash = D.keyHash(m.person.toLowerCase());
    const body = html`${pagehead({ flagged: true, crumbs: [["/", "Home"], ["/members/", "Members"], [null, nameOrder(m.person)]], title: esc(nameOrder(m.person)), lede: `Member of the House of Assembly for ${esc(m.district || "a district")}. ${num(m.n)} expense lines from ${m.y0} to ${m.y1}, ${money(m.amount)} in all.` })}
<section class="section"><div class="wrap">
  ${yrs.map((y) => {
    const cats = [...byYearCat.values()].filter((e) => e.y === y).sort((a, b) => b.a - a.a);
    return schedule({ caption: `${y}`, compact: true, cols: [{ label: "Allowance category" }, { label: "Lines", num: true }, { label: "Spent", num: true }, { label: "Source", num: true }],
      rows: cats.map((c) => ({ cells: [esc(c.cat), num(c.n), money(c.a, { cents: true }), receipt(c.url, c.page)] })),
      foot: [{ cells: ["Total", num(cats.reduce((s, c) => s + c.n, 0)), money(cats.reduce((s, c) => s + c.a, 0), { cents: true }), ""] }] });
  }).join('<div style="block-size:2rem"></div>')}
</div></section>
<section class="section"><div class="wrap grid-2">
  <div><h2 style="margin-block-end:1rem">Paid to</h2>
  ${schedule({ compact: true, cols: [{ label: "Vendor as printed" }, { label: "Lines", num: true }, { label: "Paid", num: true }], rows: vendors.map((v) => ({ cells: [`<a href="/supplier/${D.keyHash(v.supplier_key)}/">${esc(v.supplier)}</a>`, num(v.n), money(v.a)] })) })}</div>
  <div><h2 style="margin-block-end:1rem">Largest lines</h2>
  ${schedule({ compact: true, cols: [{ label: "Line" }, { label: "Amount", num: true }, { label: "Source", num: true }], rows: big.map((l) => ({ cells: [`${esc(l.supplier || "")}<span class="meta">${esc(l.description || "")} · ${esc(l.method)} · ${fmtDate(l.date)}</span>`, money(l.amount, { cents: true }), receipt(l.source_url, l.page, l.locator)] })) })}
  <p><a href="/search/?ds=mha&p=${phash}">Search all ${num(m.n)} lines ${icon("arrow")}</a></p></div>
</div></section>
<div class="wrap">${spotError()}</div>`;
    const nm = nameOrder(m.person);
    const latestYr = yrs.includes(latestFull) ? latestFull : yrs[0];
    const latestTotal = lines.filter((l) => l.fiscal_year === latestYr).reduce((s, l) => s + (l.amount || 0), 0);
    out.push([`/mha/${D.slug(m.person)}/`, { title: `${nm} MHA expenses, ${latestYr}`,
      description: desc(`${nm}, MHA${m.district ? ` for ${m.district}` : ""}: ${money(latestTotal)} in allowances in ${latestYr}, ${num(m.n)} expense lines since ${m.y0}, each linked to its source.`),
      body, notes,
      jsonld: [personLd({ name: nm, path: `/mha/${D.slug(m.person)}/`, jobTitle: "Member of the House of Assembly", description: m.district ? `MHA for ${m.district}` : undefined })] }]);
  }

  // Per minister
  for (const m of mins) {
    const claims = D.q("SELECT * FROM items WHERE dataset='minister' AND person=? ORDER BY date DESC", m.person);
    const depts = [...new Set(claims.map((c) => c.buyer))];
    const travel = claims.filter((c) => c.method !== "Payroll allowance");
    const payroll = claims.filter((c) => c.method === "Payroll allowance");
    const cats = { accommodations: 0, meals: 0, travel: 0, other: 0, hospitality: 0 };
    for (const c of travel) {
      const x = JSON.parse(c.extra || "{}");
      for (const k of Object.keys(cats)) cats[k] += x[k] || 0;
    }
    const body = html`${pagehead({ flagged: true, crumbs: [["/", "Home"], ["/members/", "Members"], [null, m.person]], title: esc(m.person), lede: `Minister's expense claims paid from ${fmtDate(m.d0)} to ${fmtDate(m.d1)}: ${num(m.n)} lines, ${money(m.amount, { cents: true })}. Departments: ${depts.map(esc).join("; ")}.` })}
<section class="section"><div class="wrap grid-2">
  <div><h2 style="margin-block-end:1rem">What the travel claims were for</h2>
  ${leaders([
    { label: "Airfare, taxis, mileage and other travel", value: money(cats.travel, { cents: true }) },
    { label: "Accommodations", value: money(cats.accommodations, { cents: true }) },
    { label: "Meals and incidentals", value: money(cats.meals, { cents: true }) },
    { label: "Hospitality", value: money(cats.hospitality, { cents: true }) },
    { label: "Other (registrations, fees)", value: money(cats.other, { cents: true }) },
    { label: "Car allowance through payroll", value: money(payroll.reduce((s, c) => s + (c.amount || 0), 0), { cents: true }) },
    { label: "Total", value: money(m.amount, { cents: true }), cls: "total" },
  ])}
  <p class="small muted" style="margin-block-start:1rem">Category totals come from each claim's detail page in the PDF. Claims paid directly by the department (some airfare and hotels) appear as their own lines.</p></div>
  <div>${caveat("Ministers are reimbursed under the Ministerial Expense Reimbursement Policy. These records show what was paid; they do not say whether a claim followed the policy.")}</div>
</div></section>
<section class="section"><div class="wrap">
  ${schedule({ cols: [{ label: "Purpose" }, { label: "Date", w: "7.5rem" }, { label: "Amount", num: true }, { label: "Source", num: true }],
    rows: claims.map((c) => {
      const x = JSON.parse(c.extra || "{}");
      return { cells: [`${esc(c.description)}${x.routes ? `<span class="meta">${esc(x.routes)}</span>` : ""}<span class="meta">${esc(c.method)} · ${esc(c.buyer)}</span>`, fmtDate(c.date), money(c.amount, { cents: true }), receipt(c.source_url, c.page, c.locator)] };
    }) })}
</div></section>
<div class="wrap">${spotError()}</div>`;
    out.push([`/ministers/${D.slug(m.person)}/`, { title: `${m.person} expense claims`,
      description: desc(`${m.person}: minister expense claims paid ${fmtDate(m.d0)} to ${fmtDate(m.d1)}, ${money(m.amount)} in ${num(m.n)} lines, each linked to its source.`),
      body, jsonld: [personLd({ name: m.person, path: `/ministers/${D.slug(m.person)}/`, jobTitle: "Minister, Government of Newfoundland and Labrador" })] }]);
  }
  return out;
}

// A page per buyer: provincial public bodies from the award reports, federal departments,
// and the two towns. Plus the federal overview and the small-purchases page.
import { esc, html, icon, Notes, leaders, bar, receipt, schedule } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, date as fmtDate } from "../../lib/format.mjs";
import { pagehead, itemRow, ITEM_COLS, caveat, datasetLabel } from "../common.mjs";

const BUYER_SETS = ["ppa", "fed_contract", "fed_grant", "canadabuys", "paradise", "stjohns"];

export function bodies(D, R) {
  const out = [];
  const list = D.q(`SELECT buyer, buyer_key, level, count(*) n, sum(amount) amount, group_concat(DISTINCT dataset) ds
      FROM items WHERE dataset IN (${BUYER_SETS.map((s) => `'${s}'`).join(",")}) AND buyer IS NOT NULL GROUP BY buyer_key ORDER BY amount DESC`);

  for (const b of list) {
    const notes = new Notes();
    const slug = D.slug(b.buyer);
    const sets = b.ds.split(",");
    const byDs = D.q(`SELECT dataset, count(*) n, sum(amount) amount, min(date) d0, max(date) d1 FROM items WHERE buyer_key=? AND dataset IN (${BUYER_SETS.map((s) => `'${s}'`).join(",")}) GROUP BY dataset`, b.buyer_key);
    const top = D.q(`SELECT * FROM items WHERE buyer_key=? AND dataset IN (${BUYER_SETS.map((s) => `'${s}'`).join(",")}) ORDER BY amount DESC LIMIT 40`, b.buyer_key);
    const recent = D.q(`SELECT * FROM items WHERE buyer_key=? AND dataset IN (${BUYER_SETS.map((s) => `'${s}'`).join(",")}) ORDER BY date DESC LIMIT 25`, b.buyer_key);
    const methods = D.q(`SELECT coalesce(method,'Not stated') m, count(*) n, sum(amount) amount FROM items WHERE buyer_key=? AND dataset IN ('ppa','fed_contract','canadabuys') GROUP BY m ORDER BY amount DESC`, b.buyer_key);
    const mmax = Math.max(...methods.map((m) => m.amount || 0), 1);
    const suppliers = D.q(`SELECT supplier, supplier_key, count(*) n, sum(amount) amount FROM items WHERE buyer_key=? AND supplier_key IS NOT NULL AND dataset IN (${BUYER_SETS.map((s) => `'${s}'`).join(",")}) GROUP BY supplier_key ORDER BY amount DESC LIMIT 15`, b.buyer_key);
    const smax = suppliers[0]?.amount || 1;
    const subjectFlags = D.flagRows.filter((f) => f.subject_type === "buyer" && f.subject_key === b.buyer_key);
    const byYear = D.q(`SELECT substr(date,1,4) y, count(*) n, sum(amount) amount FROM items WHERE buyer_key=? AND dataset IN (${BUYER_SETS.map((s) => `'${s}'`).join(",")}) AND date != '' GROUP BY y ORDER BY y`, b.buyer_key);
    const ymax = Math.max(...byYear.map((y) => y.amount || 0), 1);
    const dept = D.years.flatMap((y) => D.deptYear[y]).find((d) => D.slug(d.name) === D.slug(b.buyer.replace(/^Department of /, "")));

    const flagNotes = subjectFlags.map((f) => {
      const x = JSON.parse(f.detail || "{}");
      const cat = D.flagById[f.flag];
      if (f.flag === "no-competition") return `${pct(f.value)} of the dollars in ${x.source === "ppa" ? "its reported provincial awards" : "its federal contracts in the province"} went out without an open competition (${num(x.exception_awards)} of ${num(x.awards)} awards).`;
      if (f.flag === "year-end") return `${pct(x.last_month_amount / x.amount)} of its dated ${x.source === "paradise" ? "payments" : "awards"} by value fell in the last month of the fiscal year, ${(f.value).toFixed(1)} times an even share.`;
      if (f.flag === "dominant-supplier") return `${esc(x.supplier)} received ${pct(f.value)} of its reported award dollars.`;
      return esc(cat?.title || f.flag);
    });

    const body = html`
${pagehead({ crumbs: [["/", "Home"], ["/bodies/", "Public bodies"], [null, b.buyer]], title: esc(b.buyer), lede: `${num(b.n)} records, ${moneyWords(b.amount)} in all, from ${sets.map(datasetLabel).map((s) => s.toLowerCase()).join(", ")}.${dept ? ` <a href="/department/${D.slug(dept.name)}/">Program spending for ${esc(dept.name)}</a>.` : ""}` })}
<section class="section"><div class="wrap grid-2">
  <div>
    <h2 style="margin-block-end:1rem">What is on record</h2>
    ${leaders(byDs.map((d) => ({ label: `${esc(datasetLabel(d.dataset))} <span class="muted small">${num(d.n)}, ${fmtDate(d.d0)} to ${fmtDate(d.d1)}</span>`, value: moneyWords(d.amount) })))}
    ${flagNotes.length ? html`<h3 style="margin-block:2rem .6rem">Patterns</h3><ul class="prose">${flagNotes.map((t, i) => `<li>${t} <a href="/flags/${subjectFlags[i].flag}/">How this is worked out</a></li>`)}</ul>${caveat("A flag is a question, not a finding. It is not evidence that anything wrong happened.")}` : ""}
  </div>
  <div>
    ${methods.length > 1 ? html`<h3 style="margin-block-end:.8rem">How it was bought</h3>${schedule({ compact: true, cols: [{ label: "Method" }, { label: "", w: "40%" }, { label: "Awards", num: true }, { label: "Value", num: true }], rows: methods.map((m) => ({ cells: [esc(m.m), bar(m.amount || 0, mmax), num(m.n), moneyWords(m.amount || 0)] })) })}` : ""}
    ${byYear.length > 1 ? html`<h3 style="margin-block:1.5rem .8rem">By year</h3>${schedule({ compact: true, cols: [{ label: "Year" }, { label: "", w: "50%" }, { label: "Value", num: true }], rows: byYear.map((y) => ({ cells: [y.y, bar(y.amount || 0, ymax), moneyWords(y.amount || 0)] })) })}` : ""}
  </div>
</div></section>
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1rem">Biggest suppliers</h2>
  ${schedule({ cols: [{ label: "Supplier" }, { label: "", w: "34%" }, { label: "Records", num: true }, { label: "Value", num: true }], rows: suppliers.map((s) => ({ cells: [`<a href="/supplier/${D.keyHash(s.supplier_key)}/">${esc(s.supplier)}</a>`, bar(s.amount || 0, smax), num(s.n), moneyWords(s.amount || 0)] })) })}
</div></section>
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1rem">Largest records</h2>
  ${schedule({ cols: ITEM_COLS, rows: top.map((a) => itemRow(D, a, { showBuyer: false })) })}
  <h2 style="margin-block:2.5rem 1rem">Most recent</h2>
  ${schedule({ cols: ITEM_COLS, rows: recent.map((a) => itemRow(D, a, { showBuyer: false })) })}
  <p style="margin-block-start:1.5rem"><a href="/search/?b=${D.keyHash(b.buyer_key)}">Search all ${num(b.n)} records for ${esc(b.buyer)} ${icon("arrow")}</a></p>
</div></section>`;
    out.push([`/body/${slug}/`, { title: b.buyer, description: `Contracts, grants and payments by ${b.buyer}, each linked to its source.`, body, notes }]);
  }

  // index
  const groups = [
    ["Provincial public bodies", list.filter((b) => b.ds.includes("ppa"))],
    ["Federal departments and agencies", list.filter((b) => !b.ds.includes("ppa") && b.level === "federal")],
    ["Towns and cities", list.filter((b) => b.level === "municipal")],
  ];
  const body = html`${pagehead({ crumbs: [["/", "Home"], [null, "Public bodies"]], title: "Public bodies", lede: "Every department, agency, health authority, town and federal department that appears in the records, with what it bought and from whom." })}
${groups.map(([title, rows]) => html`<section class="section"><div class="wrap"><h2 style="margin-block-end:1rem">${title}</h2>
${schedule({ compact: true, cols: [{ label: "Body" }, { label: "Records", num: true }, { label: "Value", num: true }], rows: rows.map((b) => ({ cells: [`<a href="/body/${D.slug(b.buyer)}/">${esc(b.buyer)}</a>`, num(b.n), moneyWords(b.amount || 0)] })) })}</div></section>`)}`;
  out.push(["/bodies/", { title: "Public bodies", body }]);

  out.push(federal(D, R));
  out.push(smallPurchases(D, R));
  return out;
}

function federal(D, R) {
  const notes = new Notes();
  const F = D.federal;
  const c = F.contracts;
  const g = F.grants;
  const citeC = notes.cite({ url: "https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b", label: "Proactive disclosure of contracts over $10,000 (open.canada.ca), vendors with a postal code beginning with A, one row per contract after amendments" });
  const citeG = notes.cite({ url: "https://open.canada.ca/data/en/dataset/432527ab-7aac-45b5-81d6-7597107a7013", label: "Proactive disclosure of grants and contributions (open.canada.ca), recipient province NL, one row per agreement after amendments" });
  const deps = D.q(`SELECT buyer, count(*) n, sum(amount) amount, sum(CASE WHEN method='Non-competitive' THEN amount ELSE 0 END) nc FROM items WHERE dataset='fed_contract' GROUP BY buyer_key ORDER BY amount DESC LIMIT 15`);
  const gdeps = D.q(`SELECT buyer, count(*) n, sum(amount) amount FROM items WHERE dataset='fed_grant' GROUP BY buyer_key ORDER BY amount DESC LIMIT 15`);
  const mtp = Object.entries(F.public_accounts.mtp_2024_25).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const body = html`${pagehead({ crumbs: [["/", "Home"], [null, "Federal money"]], title: "Federal money in the province", lede: "Transfers, contracts and grants from the Government of Canada that land in Newfoundland and Labrador." })}
<section class="section"><div class="wrap">
  <div class="figs">
    <div><span class="big">${moneyWords(c.dedup_value)}</span><span class="what">in ${num(c.procurements)} federal contracts with suppliers that have an NL postal code${citeC}</span></div>
    <div><span class="big">${moneyWords(c.non_competitive_value)}</span><span class="what">of that awarded without competition</span></div>
    <div><span class="big">${moneyWords(g.dedup_value)}</span><span class="what">in ${num(g.agreements)} grant and contribution agreements with NL recipients, whose values can span several years${citeG}</span></div>
  </div>
  ${caveat("A supplier's postal code is where it is registered, not always where the work is done: a national telecom contract held by a company with an NL address counts here.")}
  ${caveat(`The federal files repeat a whole contract every time it is amended: as published, NL contracts add up to ${moneyWords(c.raw_value)}. Counted once each, they come to ${moneyWords(c.dedup_value)}. Grants likewise: ${moneyWords(g.raw_value)} as published, ${moneyWords(g.dedup_value)} counted once. <a href="/method/federal/">How amendments are handled</a>.`)}
</div></section>
<section class="section"><div class="wrap grid-2">
  <div><h2 style="margin-block-end:1rem">Contracts by department</h2>
  ${schedule({ compact: true, cols: [{ label: "Department" }, { label: "Contracts", num: true }, { label: "Value", num: true }, { label: "Non-competitive", num: true }], rows: deps.map((d) => ({ cells: [`<a href="/body/${D.slug(d.buyer)}/">${esc(d.buyer)}</a>`, num(d.n), moneyWords(d.amount), pct(d.nc / d.amount)] })) })}</div>
  <div><h2 style="margin-block-end:1rem">Grants by department</h2>
  ${schedule({ compact: true, cols: [{ label: "Department" }, { label: "Agreements", num: true }, { label: "Value", num: true }], rows: gdeps.map((d) => ({ cells: [`<a href="/body/${D.slug(d.buyer)}/">${esc(d.buyer)}</a>`, num(d.n), moneyWords(d.amount)] })) })}</div>
</div></section>
<section class="section"><div class="wrap"><h2 style="margin-block-end:1rem">Major transfers, 2024-25</h2>
${leaders(mtp.map(([k, v]) => ({ label: esc(k), value: moneyWords(v) })))}
<p class="small muted" style="margin-block-start:1rem">Public Accounts of Canada, Volume III. Figures are published in millions of dollars.</p></div></section>`;
  return ["/federal/", { title: "Federal money", body, notes }];
}

function smallPurchases(D, R) {
  const notes = new Notes();
  const p = D.one("SELECT count(*) n, sum(amount) amount, min(date) d0, max(date) d1 FROM items WHERE dataset='paradise'");
  const under1k = D.one("SELECT count(*) n, sum(amount) amount FROM items WHERE dataset='paradise' AND amount < 1000").n;
  const amounts = D.q("SELECT amount FROM items WHERE dataset='paradise' AND amount > 0 ORDER BY amount").map((r) => r.amount);
  const median = amounts[Math.floor(amounts.length / 2)];
  const vendors = D.q("SELECT supplier, supplier_key, count(*) n, sum(amount) amount FROM items WHERE dataset='paradise' GROUP BY supplier_key ORDER BY amount DESC LIMIT 15");
  const vmax = vendors[0].amount;
  const months = D.q("SELECT substr(date,1,7) m, sum(amount) amount, count(*) n FROM items WHERE dataset='paradise' AND date >= '2023-01' GROUP BY m ORDER BY m");
  const mmax = Math.max(...months.map((m) => m.amount));
  const words = D.q(`SELECT lower(description) d, count(*) n, sum(amount) amount FROM items WHERE dataset='paradise' AND description != '' GROUP BY d ORDER BY n DESC LIMIT 12`);
  const sj = D.one("SELECT count(*) n, sum(amount) amount, sum(json_extract(extra,'$.payee_withheld')) w FROM items WHERE dataset='stjohns'");
  const sjTop = D.q("SELECT * FROM items WHERE dataset='stjohns' ORDER BY amount DESC LIMIT 15");
  const citeP = notes.cite({ url: "https://www.paradise.ca/government-engage/cheque-register/", label: "Town of Paradise, cheque and payment registers, monthly PDFs" });
  const body = html`${pagehead({ crumbs: [["/", "Home"], [null, "Small purchases"]], title: "The small purchases", lede: "Most public money goes out in amounts too small to make a contract report. Two municipalities publish every payment; the province does not." })}
<section class="section"><div class="wrap">
  <div class="figs">
    <div><span class="big">${num(p.n)}</span><span class="what">payments by the Town of Paradise, ${fmtDate(p.d0)} to ${fmtDate(p.d1)}${citeP}</span></div>
    <div><span class="big">${money(median)}</span><span class="what">the middle payment</span></div>
    <div><span class="big">${pct(under1k / p.n)}</span><span class="what">of payments were under $1,000</span></div>
  </div>
  ${caveat("The provincial government publishes no line-by-line payments: the Public Accounts list departments and programs, not who was paid. Federal departments publish totals only for purchases under $10,000. An access-to-information request is the only route to the province's small purchases.")}
</div></section>
<section class="section"><div class="wrap grid-2">
  <div><h2 style="margin-block-end:1rem">Paradise, month by month</h2>
  ${schedule({ compact: true, cols: [{ label: "Month" }, { label: "", w: "55%" }, { label: "Paid", num: true }], rows: months.map((m) => ({ cells: [fmtDate(m.m), bar(m.amount, mmax), moneyWords(m.amount)] })) })}</div>
  <div><h2 style="margin-block-end:1rem">Paradise's biggest vendors</h2>
  ${schedule({ compact: true, cols: [{ label: "Vendor" }, { label: "Payments", num: true }, { label: "Paid", num: true }], rows: vendors.map((v) => ({ cells: [`<a href="/supplier/${D.keyHash(v.supplier_key)}/">${esc(v.supplier)}</a>`, num(v.n), moneyWords(v.amount)] })) })}
  <h3 style="margin-block:2rem .8rem">What gets bought most often</h3>
  ${schedule({ compact: true, cols: [{ label: "Description as printed" }, { label: "Times", num: true }, { label: "Paid", num: true }], rows: words.map((w) => ({ cells: [`<a href="/search/?ds=paradise&q=${encodeURIComponent(w.d.slice(0, 60))}">${esc(w.d)}</a>`, num(w.n), moneyWords(w.amount)] })) })}</div>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><h2>St. John's, a sample</h2>
  <p>The City of St. John's publishes every weekly payment voucher, but as scanned images. ${num(sj.n)} lines from the first 12 pages of the 2026 file were read by machine as a sample. ${num(sj.w)} of them are payments to private individuals whose names the City blacks out; those show the description only.</p></div>
  ${schedule({ cols: ITEM_COLS, rows: sjTop.map((a) => itemRow(D, a, { showBuyer: false })) })}
  <p><a href="/search/?ds=stjohns">All sampled St. John's lines</a></p>
</div></section>`;
  return ["/small-purchases/", { title: "Small purchases", body, notes }];
}

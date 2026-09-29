// Views rendered on request by the Worker routes: search results, one record, one supplier.
import { esc, html, icon, receipt, query, schedule, leaders, bar, pager, spotError } from "./html.mjs";
import { money, moneyWords, num, pct, date as fmtDate, workTime, perPerson, DATASET_LABEL, LEVEL_LABEL, fit } from "./format.mjs";
import { DATASETS } from "./search.mjs";

export const slug = (s) =>
  String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function amountText(it) {
  if (it.a != null) return money(it.a, { cents: Math.round(it.a * 100) % 100 !== 0 });
  if (it.o) return `US${money(it.o)}`;
  return "as printed";
}

function who(it) {
  if (it.s && it.k && it.ds !== "sunshine") return `<a href="/supplier/${it.k}/">${esc(it.s)}</a>`;
  return esc(it.s || it.p || (it.x?.payee_withheld ? "Payee not published" : ""));
}

export function resultItem(it, flags) {
  const meta = [
    `<span class="tag">${esc(DATASET_LABEL[it.ds] || it.ds)}</span>`,
    it.b ? `<span>${esc(it.b)}</span>` : "",
    it.p && it.s ? `<span>${esc(it.p)}</span>` : "",
    it.t || it.fy ? `<span>${esc(fmtDate(it.t) || it.fy)}</span>` : "",
    it.m ? `<span>${esc(it.m)}</span>` : "",
    `<a href="/item/${it.i}/">Record</a>`,
    receipt(it.u, it.g, it.l),
  ].filter(Boolean);
  return html`<li class="result">
    <span class="who">${who(it) || esc(it.d)}</span>
    <span class="amt">${amountText(it)}${query(it.f, flags)}</span>
    ${it.d && (it.s || it.p) ? `<p class="what">${esc(it.d)}</p>` : ""}
    <div class="meta">${meta.join("")}</div>
  </li>`;
}

const DS_OPTIONS = DATASETS.map((d) => [d, DATASET_LABEL[d]]);

export function searchPage({ params, result, flags, page }) {
  const p = result?.params || params;
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
  const years = [];
  for (let y = 2026; y >= 2009; y--) years.push([String(y), String(y)]);
  const flagOpts = Object.values(flags).map((f) => [f.id, f.title]);
  const base = "/search/?" + new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString();
  const active = ["s", "n", "b", "p", "i"].filter((k) => p[k]);
  const items = result?.items || [];
  const near = result?.near || [];
  const suggest = result?.suggest || [];
  const corrected = result?.corrected;
  const sorted = [...items].sort((a, b) => (b.a || 0) - (a.a || 0));
  const total = sorted.reduce((s, it) => s + (it.a || 0), 0);
  const empty = !p.q && !Object.keys(p).some((k) => k !== "q" && p[k]);
  const examples = ["ferry", "snow clearing", "consulting", "legal services", "helicopter", "catering", "software licence", "Marine Atlantic"];
  const body = html`
<header class="pagehead"><div class="wrap">
  <h1>Search</h1>
  <form action="/search/" method="get" role="search">
    <div class="field" style="max-inline-size:40rem"><label for="sq">Every award, grant, claim, pay record and payment</label>
    <div class="field-row"><span class="pre">${icon("search")}</span><input id="sq" name="q" type="search" value="${esc(p.q || "")}" placeholder="A company, a town, a word" autocomplete="off" autofocus><button class="btn" type="submit">Search</button></div></div>
    <div class="filters">
      <div class="field"><label for="fds">Source</label><div class="field-row"><select id="fds" name="ds"><option value="">All sources</option>${opt(DS_OPTIONS, p.ds)}</select></div></div>
      <div class="field"><label for="fy">Year</label><div class="field-row"><select id="fy" name="y"><option value="">Any year</option>${opt(years, p.y)}</select></div></div>
      <div class="field"><label for="ff">Pattern</label><div class="field-row"><select id="ff" name="f"><option value="">Any</option>${opt(flagOpts, p.f)}</select></div></div>
      ${active.map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`).join("")}
      <button class="btn solo" type="submit">Apply</button>
    </div>
    ${active.length ? `<p class="small">Filtered to one ${active.includes("n") ? "printed name of a supplier" : active.includes("s") ? "supplier" : active.includes("b") ? "public body" : "person"}. <a href="/search/?${new URLSearchParams(Object.entries(p).filter(([k, v]) => v && !active.includes(k))).toString()}">Remove</a></p>` : ""}
  </form>
</div></header>
<section class="section" style="padding-block-start:2rem"><div class="wrap">
  ${empty ? html`<p class="lede">Try one of these:</p><ul class="chips">${examples.map((e) => `<li><a href="/search/?q=${encodeURIComponent(e)}">${esc(e)}</a></li>`)}</ul>
    <p class="muted">Search looks in supplier and recipient names, people's names as published, descriptions, programs and places. Words match the start of words: <em>snow</em> finds snowplow. Records containing every word come first; records close in meaning follow them, and a misspelled name is corrected when nothing matches.</p>`
    : html`${corrected ? html`<p class="small" role="status">No record contains <strong>${esc(p.q)}</strong>. Showing records for <strong>${esc(corrected.q)}</strong>.</p>` : ""}
      ${items.length ? html`<p class="small muted" aria-live="polite">${num(items.length)} records on this page${result.more ? " (more on the next page)" : ""}, ${moneyWords(total)} together, largest first. Each links to its source.</p>
      <ol class="results">${sorted.map((it) => resultItem(it, flags))}</ol>
      ${pager(base, page, result.more)}`
      : html`<p class="empty">${p.q ? html`No record contains every word of <strong>${esc(p.q)}</strong>.` : "Nothing matched."}${near.length ? "" : " Try fewer or shorter words, or remove a filter."}</p>`}
      ${suggest.length ? html`<p class="small" style="margin-block-end:0.4rem">Searches that find records:</p><ul class="chips">${suggest.map((s) => `<li><a href="/search/?${esc(new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)), q: s }).toString())}">${esc(s)}</a></li>`)}</ul>` : ""}
      ${near.length ? html`<section aria-labelledby="near-h" class="near">
        <h2 id="near-h">${items.length ? "Close in meaning" : "Closest in meaning"}</h2>
        <p class="small muted">Records about the same thing that do not contain every word, closest first. Check each one against its source.</p>
        <ol class="results">${near.map((it) => resultItem(it, flags))}</ol>
      </section>` : ""}`}
</div></section>`;
  return body;
}

// Title and description for a record page, built from its own fields so no two records read alike.
export function itemMeta(it) {
  const who = it.s || it.p || it.d || "Record";
  const name = who.length > 34 ? who.slice(0, 34).replace(/\s+\S*$/, "") + "…" : who;
  const year = String(it.t || "").slice(0, 4) || String(it.fy || "").slice(-4);
  const same = it.b && who.toLowerCase().slice(0, 10) === it.b.toLowerCase().slice(0, 10);
  const buyer = it.b && !same ? (it.b.length > 30 ? it.b.slice(0, 30).replace(/\s+\S*$/, "") + "…" : it.b) : "";
  const amt = it.a != null ? money(it.a, { cents: Math.round(it.a * 100) % 100 !== 0 }) : "";
  const title = [name, amt, buyer, /^\d{4}$/.test(year) ? year : ""].filter(Boolean).join(", ");
  const label = DATASET_LABEL[it.ds] || "Record";
  const d = String(it.d || "").trim();
  const text = `${label}: ${it.s || it.p || "payee not published"}${amt ? `, ${amt}` : ""}${it.b && !same ? `, ${it.ds === "sunshine" ? "at" : "from"} ${it.b}` : ""}${it.t ? ` on ${fmtDate(it.t)}` : year ? ` in ${year}` : ""}. ${d ? d.replace(/\.$/, "") + ". " : ""}${it.m ? `${it.m}. ` : ""}`.trim();
  return { title, description: fit(text) };
}

// A link to the page about a public body, only where the build wrote one (links.json lists the slugs of every
// /body/, /pay/ and /department/ page). Anything else is plain text, never a link that ends in a 404.
export function bodyLink(name, links, { sunshine = false } = {}) {
  const sl = slug(name);
  const href = links?.body?.includes(sl) ? `/body/${sl}/` : sunshine && links?.pay?.includes(sl) ? `/pay/${sl}/` : links?.department?.includes(sl) ? `/department/${sl}/` : null;
  return href ? `<a href="${href}">${esc(name)}</a>` : esc(name);
}

export function itemPage(it, { flags, stats, links }) {
  const fl = (it.f || []).map((f) => flags[f]).filter(Boolean);
  const x = it.x || {};
  const facts = [
    it.s ? { label: it.ds === "mha" ? "Paid to" : it.ds === "fed_grant" || it.ds === "pa_tp" ? "Recipient" : "Supplier", value: who(it) } : null,
    x.supplier_as_printed ? { label: "Name as printed", value: esc(x.supplier_as_printed) } : null,
    it.p ? { label: it.ds === "sunshine" ? "Name as published" : it.ds === "mha" ? "Member" : "Minister", value: esc(it.p) } : null,
    it.b ? { label: it.ds === "sunshine" ? "Employer" : "Public body", value: bodyLink(it.b, links, { sunshine: it.ds === "sunshine" }) } : null,
    { label: it.ds === "fed_grant" ? "Agreement start" : it.ds === "canadabuys" ? "Award date" : it.ds === "sunshine" ? "Year" : "Date", value: esc(it.ds === "sunshine" ? String(it.t || "").slice(0, 4) : fmtDate(it.t) || it.fy || "not printed") },
    it.m ? { label: it.ds === "mha" ? "Allowance" : it.ds === "fed_grant" ? "Program" : "Method", value: esc(it.m) } : null,
    x.clause ? { label: "Clause cited", value: esc(x.clause) } : null,
    x.reason ? { label: "Reason given", value: esc(x.reason) } : null,
    x.limited_reason ? { label: "Limited tendering reason", value: esc(x.limited_reason) } : null,
    x.original_value ? { label: "Original value", value: money(x.original_value) } : null,
    x.contract_no ? { label: "Contract number", value: esc(x.contract_no) } : null,
    x.term ? { label: "Term", value: esc(x.term) } : null,
    x.district ? { label: "District", value: esc(x.district) } : null,
    x.routes ? { label: "Flights", value: esc(x.routes) } : null,
    x.unit ? { label: "Unit", value: esc(x.unit) } : null,
    x.base != null ? { label: "Base salary", value: money(x.base) } : null,
    x.overtime ? { label: "Overtime", value: money(x.overtime) } : null,
    x.bonus ? { label: "Bonuses", value: money(x.bonus) } : null,
    x.shift ? { label: "Shift premium", value: money(x.shift) } : null,
    x.retro ? { label: "Retroactive salary", value: money(x.retro) } : null,
    x.severance ? { label: "Severance", value: money(x.severance) } : null,
    x.other && it.ds === "sunshine" ? { label: "Other compensation", value: money(x.other) } : null,
    x.invoice ? { label: "Invoice", value: esc(x.invoice) } : null,
    x.report_period ? { label: "Reported in", value: `the report for ${esc(x.report_period.replace(" to ", " to "))}` } : null,
    x.weeks ? { label: "Voucher weeks", value: esc(x.weeks) } : null,
    x.amount_text ? { label: "Price as printed", value: esc(x.amount_text) } : null,
    { label: "Record type", value: esc(DATASET_LABEL[it.ds] || it.ds) },
  ].filter(Boolean);
  const pdf = /\.pdf($|\?)/i.test(it.u || "");
  const href = pdf && it.g ? `${it.u}#page=${it.g}` : it.u;
  const title = it.s || it.p || it.d || "Record";
  const body = html`
<header class="pagehead"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <a href="/search/">Search</a> / Record</p>
  <h1>${esc(title)}</h1>
  ${it.d && (it.s || it.p) ? `<p class="lede">${esc(it.d)}</p>` : ""}
</div></header>
<section class="section"><div class="wrap grid-2">
  <div>
    <p class="cover-fig" style="color:var(--ink);font-size:clamp(3rem,10vw,5rem);margin:0 0 1rem">${amountText(it)}</p>
    ${it.a ? `<p class="lede">${money(perPerson(it.a, stats), { cents: true })} per person in the province. ${workTime(it.a, stats)} of work at the median full-time wage.</p>` : ""}
    ${leaders(facts).replace('class="leaders"', 'class="leaders facts"')}
  </div>
  <div>
    <div class="receipt">
      <h3>Receipt</h3>
      <p>${esc(it.l || "")}</p>
      <p><a class="btn solo" href="${esc(href)}" rel="noopener">Open the source ${pdf && it.g ? `at page ${it.g}` : ""} ${icon("out")}</a></p>
      ${x.machine_read ? `<p class="small">Machine-read from a scanned image; compare with the page before quoting.</p>` : ""}
      ${x.note ? `<p class="small">${esc(x.note)}</p>` : ""}
    </div>
    ${fl.length ? html`<h3 style="margin-block:2rem .6rem">Patterns</h3><ul class="flaglist">${fl.map((f) => html`<li><a class="q" href="/flags/${f.id}/" aria-hidden="true" tabindex="-1">${icon("query")}</a><h3><a href="/flags/${f.id}/">${esc(f.title)}</a></h3><span></span><p>${esc(f.short)} <a href="/method/${f.id}/">Method</a></p></li>`)}</ul>
      <p class="small muted">A flag is a question, not a finding. It is not evidence that anything wrong happened.</p>` : ""}
  </div>
</div></section>
<div class="wrap">${spotError()}</div>`;
  return { title, body };
}

// The printed names a supplier page combines, each linking to its own records.
function combinedNames(s, hash) {
  return html`<div class="combined small"><p>This page combines ${num(s.combined.length)} printed names, joined on the evidence described in the method:</p>
  <ul>${s.combined.map((c) => html`<li><a href="/search/?s=${hash}&amp;n=${c.h}">${esc(c.t)}</a> <span>${num(c.n)} ${c.n === 1 ? "record" : "records"}</span></li>`)}</ul>
  <p><a href="/method/suppliers/">How names are matched</a> · <a href="https://github.com/steveclarke/nl-ledger/issues/new?template=challenge-method.yml">Question this match</a></p></div>`;
}

export function supplierPage(s, { flags, stats, hash, links }) {
  const dsRows = Object.entries(s.byDs).sort((a, b) => b[1][1] - a[1][1]);
  const years = Object.entries(s.byYear).sort();
  const ymax = Math.max(...years.map(([, v]) => v), 1);
  const flagRows = Object.entries(s.flags || {}).map(([f, n]) => ({ f: flags[f], n })).filter((x) => x.f);
  const body = html`
<header class="pagehead"><div class="wrap">
  <p class="crumbs"><a href="/">Home</a> / <a href="/search/">Search</a> / Supplier</p>
  <h1>${esc(s.name)}</h1>
  <p class="lede">${num(s.n)} records across provincial and federal sources: ${moneyWords(s.total)} in contract awards, grant agreements and payments${s.overlap ? `, plus ${moneyWords(s.overlap)} in federal payment and notice records that repeat money already counted` : ""}${s.city ? `. Listed in ${esc(s.city)}` : ""}.${s.names ? ` Also printed as: ${s.names.filter((n) => n !== s.name).map(esc).join("; ")}.` : ""}</p>
  ${s.combined ? combinedNames(s, hash) : ""}
</div></header>
<section class="section"><div class="wrap">
  <div class="figs">
    <div><span class="big">${moneyWords(s.total)}</span><span class="what">on record, all years (grant values can span several years)</span></div>
    <div><span class="big">${money(perPerson(s.total, stats), { cents: true })}</span><span class="what">per person in the province</span></div>
    <div><span class="big">${workTime(s.total, stats)}</span><span class="what">of work at the median full-time wage</span></div>
  </div>
  <div class="grid-2">
    <div>${schedule({ compact: true, caption: "By source", cols: [{ label: "Source" }, { label: "Records", num: true }, { label: "Value", num: true }], rows: dsRows.map(([d, [n, a]]) => ({ cells: [esc(DATASET_LABEL[d] || d) + (["pa_pss", "pa_tp", "canadabuys"].includes(d) ? '<span class="meta">repeats money counted above; not in the total</span>' : ""), num(n), moneyWords(a)] })) })}
      ${s.buyers?.length ? schedule({ compact: true, caption: "Paid by", cols: [{ label: "Public body" }, { label: "Level" }, { label: "Records", num: true }, { label: "Value", num: true }], rows: s.buyers.map((b) => ({ cells: [bodyLink(b.name, links), esc(LEVEL_LABEL[b.level] || ""), num(b.n), moneyWords(b.amount)] })) }) : ""}
    </div>
    <div>${years.length > 1 ? schedule({ compact: true, caption: "By year", cols: [{ label: "Year" }, { label: "", w: "55%" }, { label: "Value", num: true }], rows: years.map(([y, v]) => ({ cells: [y, bar(v, ymax), moneyWords(v)] })) }) : ""}
      ${flagRows.length ? html`<h3 style="margin-block:1.5rem .6rem">Patterns</h3><ul class="flaglist">${flagRows.map((x) => html`<li><a class="q" href="/flags/${x.f.id}/" aria-hidden="true" tabindex="-1">${icon("query")}</a><h3><a href="/flags/${x.f.id}/">${esc(x.f.title)}</a></h3><span class="count">${num(x.n)}</span><p>${esc(x.f.short)}</p></li>`)}</ul><p class="small muted">A flag is a question, not a finding.</p>` : ""}
    </div>
  </div>
</div></section>
<section class="section"><div class="wrap">
  <h2 style="margin-block-end:1rem">Largest records</h2>
  <ol class="results">${s.top.map((it) => resultItem({ ...it, s: undefined, k: undefined, fy: undefined }, flags)).join("")}</ol>
  ${s.n > s.top.length ? `<p style="margin-block-start:1.5rem"><a href="/search/?s=${hash}">All ${num(s.n)} records ${icon("arrow")}</a></p>` : ""}
</div></section>
<div class="wrap">${spotError()}</div>`;
  return { title: s.name, body };
}

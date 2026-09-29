// Patterns: an index, a results page per flag, and a method page per flag.
import { esc, html, icon, Notes, schedule, receipt, bar } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, date as fmtDate } from "../../lib/format.mjs";
import { pagehead, itemRow, ITEM_COLS, caveat, datasetLabel } from "../common.mjs";

function countLine(D, f) {
  const s = D.flagSummary[f.id] || {};
  if (s.items) return `${num(s.items)} items${s.amount ? `, ${moneyWords(s.amount)}` : ""}`;
  if (s.subjects) return `${num(s.subjects)} found`;
  return "none found";
}

export function flagPages(D, R) {
  const out = [];
  const cat = D.catalog;

  out.push(["/flags/", {
    title: "Patterns people ask about",
    body: html`${pagehead({ crumbs: [["/", "Home"], [null, "Patterns"]], title: "Patterns people ask about", lede: "Patterns in the records that people often ask about: deals made without competition, contracts that grew, amounts just under a limit, spending bunched at year end, and more. Each is counted from the records with its method written down. None is a finding of wrongdoing." })}
<section class="section"><div class="wrap">
  ${caveat(esc(cat.caveat))}
  <ul class="flaglist" style="margin-block-start:1.5rem">${cat.flags.map((f) => html`<li><a class="q" href="/flags/${f.id}/" aria-hidden="true" tabindex="-1">${icon("query")}</a><h3><a href="/flags/${f.id}/">${esc(f.title)}</a></h3><span class="count">${countLine(D, f)}</span><p>${esc(f.short)} <a href="/method/${f.id}/">Method</a></p></li>`)}</ul>
  <p class="small muted" style="margin-block-start:1.5rem">Some patterns cannot be checked with Newfoundland and Labrador data: single bids, disqualified rivals and identical bids need bid-level records, which the province does not publish.</p>
</div></section>`,
  }]);

  for (const f of cat.flags) {
    const notes = new Notes();
    const subjects = D.flagRows.filter((r) => r.flag === f.id && !r.item_id);
    const itemIds = D.flagRows.filter((r) => r.flag === f.id && r.item_id).map((r) => r.item_id);
    let results = "";

    if (f.id === "no-competition") {
      const prov = subjects.filter((s) => JSON.parse(s.detail).source === "ppa").map((s) => ({ ...s, x: JSON.parse(s.detail) })).filter((s) => s.x.amount > 250000).sort((a, b) => b.x.exception_amount - a.x.exception_amount);
      const fed = subjects.filter((s) => JSON.parse(s.detail).source === "fed_contract").map((s) => ({ ...s, x: JSON.parse(s.detail) })).sort((a, b) => b.x.exception_amount - a.x.exception_amount).slice(0, 15);
      results = html`<h2 style="margin-block-end:1rem">Provincial public bodies</h2>
      ${schedule({ cols: [{ label: "Public body" }, { label: "", w: "28%" }, { label: "Without competition", num: true }, { label: "Of all reported", num: true }, { label: "Share", num: true }],
        rows: prov.slice(0, 40).map((s) => ({ cells: [`<a href="/body/${D.slug(s.subject)}/">${esc(s.subject)}</a><span class="meta">${num(s.x.exception_awards)} of ${num(s.x.awards)} awards</span>`, bar(s.value, 1), moneyWords(s.x.exception_amount), moneyWords(s.x.amount), pct(s.value)] })) })}
      <h2 style="margin-block:2.5rem 1rem">Federal departments, contracts with NL suppliers</h2>
      ${schedule({ cols: [{ label: "Department" }, { label: "Non-competitive", num: true }, { label: "Of all", num: true }, { label: "Share", num: true }],
        rows: fed.map((s) => ({ cells: [`<a href="/body/${D.slug(s.subject)}/">${esc(s.subject)}</a>`, moneyWords(s.x.exception_amount), moneyWords(s.x.amount), pct(s.value)] })) })}`;
    } else if (f.id === "repeat-sole-source") {
      const pairs = subjects.map((s) => ({ ...s, x: JSON.parse(s.detail) })).sort((a, b) => b.value - a.value);
      results = schedule({ cols: [{ label: "Public body and supplier" }, { label: "Awards", num: true }, { label: "Value", num: true }, { label: "Period" }],
        rows: pairs.slice(0, 80).map((s) => ({ cells: [`<a href="/body/${D.slug(s.x.buyer)}/">${esc(s.x.buyer)}</a> → <a href="/supplier/${D.keyHash(s.x.supplier_key)}/">${esc(s.x.supplier)}</a>`, num(s.x.awards), moneyWords(s.value), `${fmtDate(s.x.first)} to ${fmtDate(s.x.last)}`] })) });
    } else if (["year-end", "dominant-supplier"].includes(f.id)) {
      const rows = subjects.map((s) => ({ ...s, x: JSON.parse(s.detail) })).sort((a, b) => b.value - a.value);
      results = f.id === "year-end"
        ? schedule({ cols: [{ label: "Public body" }, { label: "Source" }, { label: "Last month's share", num: true }, { label: "Times an even share", num: true }],
          rows: rows.map((s) => ({ cells: [`<a href="/body/${D.slug(s.subject)}/">${esc(s.subject)}</a>`, esc(datasetLabel(s.x.source)), `${moneyWords(s.x.last_month_amount)} of ${moneyWords(s.x.amount)}`, `${s.value.toFixed(1)}×`] })) })
        : schedule({ cols: [{ label: "Public body" }, { label: "Supplier" }, { label: "Share", num: true }, { label: "Value", num: true }],
          rows: rows.map((s) => ({ cells: [`<a href="/body/${D.slug(s.subject)}/">${esc(s.subject)}</a>`, `<a href="/supplier/${D.keyHash(s.x.supplier_key)}/">${esc(s.x.supplier)}</a>`, pct(s.value), `${moneyWords(s.x.supplier_amount)} of ${moneyWords(s.x.body_total)}`] })) });
    } else if (f.id === "overtime-over-base" || f.id === "severance") {
      const rows = subjects.map((s) => ({ ...s, x: JSON.parse(s.detail) })).sort((a, b) => b.value - a.value);
      results = html`<p>Counted by employer, job title and year. The government's lists name each person; this page does not repeat the names.</p>
      ${schedule({ cols: [{ label: "Employer and job title" }, { label: "Year" }, { label: "People", num: true }, { label: f.id === "severance" ? "Severance" : "Overtime", num: true }],
        rows: rows.slice(0, 120).map((s) => ({ cells: [`<a href="/pay/${D.slug(s.x.employer)}/">${esc(s.x.employer)}</a><span class="meta">${esc(s.x.title)}</span>`, esc(s.x.year), num(s.x.people), money(s.value)] })) })}`;
    } else if (f.id === "split-invoices" || f.id === "possible-duplicate") {
      const groups = subjects.map((s) => ({ ...s, x: JSON.parse(s.detail) })).sort((a, b) => b.value - a.value);
      results = schedule({ cols: [{ label: f.id === "possible-duplicate" ? "Vendor and invoice" : "Supplier, buyer and date" }, { label: f.id === "possible-duplicate" ? "Times paid" : "Invoices", num: true }, { label: f.id === "possible-duplicate" ? "Each" : "Together", num: true }, { label: "Lines", num: true }],
        rows: groups.slice(0, 100).map((s) => ({ cells: [`<a href="/supplier/${D.keyHash(s.x.supplier_key || "")}/">${esc(s.subject)}</a>${s.x.dates ? `<span class="meta">${s.x.dates.map(fmtDate).join(", ")}</span>` : ""}`, num(s.x.invoices || s.x.times), money(s.value), s.x.items.map((i, n) => `<a class="rcpt" href="/item/${i.split("-").pop()}/">${n + 1}</a>`).join(" ")] })) });
      if (groups.length > 100) results += `<p class="muted">Showing the 100 largest of ${num(groups.length)}.</p>`;
    } else if (f.id === "over-allowance") {
      const rows = subjects.map((s) => ({ ...s, x: JSON.parse(s.detail) }));
      results = rows.length
        ? schedule({ cols: [{ label: "Member" }, { label: "Year and category" }, { label: "Over by", num: true }], rows: rows.map((s) => ({ cells: [esc(s.subject), `${esc(s.x.fiscal_year)}: ${esc(s.x.category)}`, money(s.value, { cents: true })] })) })
        : `<p class="lede">No member spent more than a published limit in any category, in any year from 2020-21 to 2025-26. The check covered every category that has a limit in the ${num(D.one("SELECT count(DISTINCT source_file) n FROM items WHERE dataset='mha'").n)} annual detail reports that load; ${num(D.issues.filter((i) => i.source === "MHA expense report").length)} reports linked from the House of Assembly site are broken and could not be checked.</p>`;
    } else {
      // item-level list: largest first
      const rows = itemIds.length ? D.q(`SELECT * FROM items WHERE id IN (${itemIds.slice(0, 5000).map(() => "?").join(",")}) ORDER BY amount DESC LIMIT 120`, ...itemIds.slice(0, 5000)) : [];
      if (f.id === "just-under-limit") {
        const dist = JSON.parse(D.flagSummary[f.id].detail || "{}");
        const drows = [];
        for (const [src, lims] of Object.entries(dist)) for (const [lim, v] of Object.entries(lims)) drows.push({ cells: [esc(datasetLabel(src)), `${money(+lim)} (${esc(v.label)})`, num(v.below), num(v.above)] });
        results += html`<h2 style="margin-block-end:1rem">Just below against just above</h2>${schedule({ cols: [{ label: "Source" }, { label: "Limit" }, { label: "Within 5% below", num: true }, { label: "Within 5% above", num: true }], rows: drows })}<h2 style="margin-block:2.5rem 1rem">The largest</h2>`;
      }
      results += schedule({ cols: ITEM_COLS, rows: rows.map((r) => itemRow(D, r)) });
      if (itemIds.length > 120) results += `<p><a href="/search/?f=${f.id}">All ${num(itemIds.length)} in search</a></p>`;
    }

    out.push([`/flags/${f.id}/`, {
      title: f.title,
      description: f.short,
      body: html`${pagehead({ crumbs: [["/", "Home"], ["/flags/", "Patterns"], [null, f.title]], title: esc(f.title), lede: esc(f.short) })}
<section class="section"><div class="wrap">
  <div class="grid-2" style="margin-block-end:2.5rem"><div><p>${esc(f.why)}</p><p><a href="/method/${f.id}/">How this is worked out, and what it cannot tell you ${icon("arrow")}</a></p></div><div>${caveat(esc(cat.caveat))}</div></div>
  ${results}
</div></section>`,
      notes,
    }]);

    out.push([`/method/${f.id}/`, {
      title: `Method: ${f.title}`,
      body: html`${pagehead({ crumbs: [["/", "Home"], ["/method/", "Methods"], [null, f.title]], title: `Method: ${esc(f.title)}`, lede: esc(f.short) })}
<section class="section"><div class="wrap prose">
  <h2>Why people look at this</h2><p>${esc(f.why)}</p>
  <h2>How it is worked out</h2><ol>${f.how.map((h) => `<li>${esc(h)}</li>`)}</ol>
  <h2>Data used</h2><ul>${f.data.map((d) => `<li><a href="/sources/#${d}">${esc(datasetLabel(d))}</a></li>`)}</ul>
  <h2>What it cannot tell you</h2><p>${esc(f.limits)}</p>
  ${caveat(esc(cat.caveat))}
  <p style="margin-block-start:1.5rem">This page and the calculation are generated from one definition, so they cannot drift apart. <a href="/flags/${f.id}/">See the results</a>.</p>
</div></section>`,
    }]);
  }
  return out;
}

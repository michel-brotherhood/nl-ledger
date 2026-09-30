// Page shell and the accounting-schedule components. Used by the static build and by
// the Worker routes, so every page, static or rendered on request, is one design.
import { SITE, money, moneyShort, date as fmtDate } from "./format.mjs";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const html = (strings, ...vals) =>
  strings.reduce((out, s, i) => out + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join("") : vals[i] ?? "") : ""), "");

// ---- icons: one stroke family, 1.6px, drawn on a 20px grid
const I = {
  search: '<circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/>',
  out: '<path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12"/><path d="M11 3h6v6M17 3l-8 8"/>',
  query: '<circle cx="10" cy="10" r="7.25"/><path d="M7.9 7.7a2.2 2.2 0 1 1 3 2.05c-.6.25-.9.7-.9 1.35v.4"/><circle cx="10" cy="13.9" r=".35" fill="currentColor"/>',
  page: '<path d="M5 2.75h6.5L15 6.25v10.5a.5.5 0 0 1-.5.5h-9.5a.5.5 0 0 1-.5-.5V3.25a.5.5 0 0 1 .5-.5Z"/><path d="M11.25 2.75v3.75H15M7 10h6M7 13h4"/>',
  sun: '<circle cx="10" cy="10" r="3.5"/><path d="M10 1.75v2M10 16.25v2M1.75 10h2M16.25 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/>',
  moon: '<path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z"/>',
  arrow: '<path d="M4 10h11M11 6l4 4-4 4"/>',
  copy: '<rect x="6.75" y="6.75" width="10.5" height="10.5" rx="1.5"/><path d="M13.25 6.75V4.25a1.5 1.5 0 0 0-1.5-1.5h-7a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h2.5"/>',
  check: '<path d="m4 10.5 4 4 8-9"/>',
  chat: '<path d="M3.25 5.25a2 2 0 0 1 2-2h9.5a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9l-3.75 3v-3h0a2 2 0 0 1-2-2Z"/>',
  plug: '<path d="M7 2.75v4M13 2.75v4M5 6.75h10v2.5a5 5 0 0 1-10 0Z"/><path d="M10 14.25v3"/>',
};
export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;
}

// The brand: the name alone, cut from Archivo (see brand/). Outlined so it needs no font and takes the masthead's ink.
export const WORDMARK = `<svg class="wordmark" viewBox="0 -14 3948 714" role="img" aria-label="${SITE.name}" focusable="false"><path fill="currentColor" d="M0 686V-2H176.6L245.7 207.1Q249 218.1 253.1 229.5Q257.2 240.9 261.3 253.8Q265.5 266.6 268.7 280.5L273.7 280.4Q273.7 261.9 273.7 243.4Q273.7 224.9 273.7 207.1V-2H451V686H273.5L203.9 474.5Q197.4 454.5 192 433.7Q186.6 412.9 181.3 393.2L176.3 393.3Q176.4 413.3 176.4 434.2Q176.4 455.1 176.4 474.5V686ZM525 686V-2H710V527.1H917.1V686ZM1067.1 686V-2H1252.1V527.1H1459.2V686ZM1503.2 686V-2H1908.7V156.4H1688.2V258H1871.8V416H1688.2V527.6H1913.8V686ZM1971.8 686V-2H2201.6Q2287.4 -2 2335.2 34.5Q2383 71.1 2402.7 146.1Q2422.4 221.2 2422.4 339.2Q2422.4 456.2 2401.7 533.1Q2381.1 610.1 2332.3 648.1Q2283.6 686 2197.8 686ZM2156.8 527.6H2187.2Q2203.3 527.6 2213.2 520.9Q2223.1 514.3 2227.3 499.5Q2231.6 484.8 2232.9 462Q2234.3 439.2 2234.3 408V290.2Q2234.3 258.1 2232.9 233.4Q2231.6 208.7 2227.3 191.6Q2223.1 174.5 2213.2 165.4Q2203.3 156.4 2187.2 156.4H2156.8ZM2694.6 698Q2584.1 698 2523.3 610.4Q2462.4 522.7 2462.4 342Q2462.4 219.3 2491.7 140.7Q2521 62.2 2578 24.1Q2635 -14 2719 -14Q2776.8 -14 2820.4 2Q2864 18.1 2893.5 50.6Q2923.1 83.1 2938.2 132.1Q2953.4 181.1 2953.4 247H2775.6Q2775.6 225.9 2773.6 207.5Q2771.6 189 2765 174.6Q2758.3 160.2 2746.7 151.8Q2735 143.4 2714.7 143.4Q2693.7 143.4 2680.8 151.6Q2667.8 159.7 2661.1 175.5Q2654.4 191.3 2652.5 215.5Q2650.5 239.8 2650.5 272.1V411.9Q2650.5 456.2 2655.2 484.6Q2659.9 513 2674.1 526.8Q2688.3 540.6 2716.6 540.6Q2741.2 540.6 2754.6 527.2Q2768 513.9 2773.7 492.5Q2779.3 471.1 2779.3 446.9V442H2707.7V302H2953.4V686H2858.3L2847.7 621.8Q2834.7 643.1 2814.8 660.1Q2794.8 677.2 2765.5 687.6Q2736.2 698 2694.6 698ZM3001.4 686V-2H3406.9V156.4H3186.4V258H3370V416H3186.4V527.6H3412V686ZM3470 686V-2H3728.6Q3805.6 -2 3849 26.2Q3892.5 54.3 3910.4 102.4Q3928.4 150.5 3928.4 209.5Q3928.4 264.1 3916.3 311.8Q3904.3 359.5 3869.3 394.3L3948.4 686H3756.3L3706.2 455H3655V686ZM3655 309.6H3703Q3727.1 309.6 3735.1 284.3Q3743.2 259.1 3743.2 227Q3743.2 205.1 3739.4 187.6Q3735.7 170.2 3727.4 159.3Q3719.1 148.4 3703 148.4H3655Z"/></svg>`;

// ---- receipts: footnotes that point at the source file and page
export class Notes {
  constructor() {
    this.list = [];
  }
  // Returns a superscript marker. Same source+page+label reuses its number.
  cite({ url, page, label, locator }) {
    const href = url && page && /\.pdf($|\?)/i.test(url) ? `${url}#page=${page}` : url;
    const key = `${href}|${label}`;
    let n = this.list.findIndex((x) => x.key === key) + 1;
    if (!n) {
      this.list.push({ key, href, label, locator });
      n = this.list.length;
    }
    return `<sup class="fn"><a href="#note-${n}" id="ref-${n}-${this.list.length}" aria-label="Source note ${n}">${n}</a></sup>`;
  }
  render() {
    if (!this.list.length) return "";
    return html`<section class="notes" aria-labelledby="notes-h">
      <h2 id="notes-h">Notes</h2>
      <ol>${this.list.map(
        (x, i) => html`<li id="note-${i + 1}">${esc(x.label)}${x.locator ? `, ${esc(x.locator)}` : ""}.
          ${x.href ? html`<a class="src" href="${esc(x.href)}" rel="noopener">Open the source ${icon("out")}</a>` : ""}</li>`
      )}</ol>
    </section>`;
  }
}

// Link to one row's source: "p. 12" opens the PDF at that page.
export function receipt(url, page, locator) {
  if (!url) return "";
  const pdf = /\.pdf($|\?)/i.test(url);
  const href = pdf && page ? `${url}#page=${page}` : url;
  const text = pdf && page ? `p.&nbsp;${page}` : "source";
  return `<a class="rcpt" href="${esc(href)}" rel="noopener" title="${esc(locator || "Open the source record")}">${text}</a>`;
}

// Graphite margin mark for a flag: a question, never an alarm.
export function query(flags, catalog) {
  if (!flags?.length) return "";
  const names = flags.map((f) => catalog?.[f]?.title || f);
  return `<a class="q" href="/flags/${esc(flags[0])}/" title="${esc(names.join("; "))}">${icon("query")}<span class="vh">Flagged: ${esc(names.join("; "))}</span></a>`;
}

export function bar(value, max, cls = "") {
  const w = max > 0 ? Math.max(0.4, (value / max) * 100) : 0;
  return `<span class="bar ${cls}" aria-hidden="true"><span style="inline-size:${w.toFixed(2)}%"></span></span>`;
}

// The site's standing statement, shown in the page head wherever a reader meets flags or named people.
export const STANDING = "A flag is a question, not a finding. It is not evidence that anything wrong happened.";
export const standing = () => `<p class="standing">${icon("query")}<span>${STANDING}</span></p>`;

// One row of a list of patterns: the title is the way in, the method link is the aside.
export function flagItem(f, { count = "", method = false } = {}) {
  return `<li class="flagitem"><span class="q" aria-hidden="true">${icon("query")}</span><h3><a href="/flags/${f.id}/">${esc(f.title)}${icon("arrow")}</a></h3><span class="count">${count}</span><p>${esc(f.short)}${method ? ` <a class="method" href="/method/${f.id}/">Method<span class="vh"> for ${esc(f.title)}</span></a>` : ""}</p></li>`;
}

// ---- layout
const NAV = [
  ["/priorities/", "Priorities"],
  ["/search/", "Search"],
  ["/flags/", "Patterns"],
  ["/members/", "Members"],
  ["/sources/", "Receipts"],
  ["/data/", "Ask AI"],
];

// The "Spot an error?" line at the foot of supplier, people and record pages.
export const spotError = () => `<p class="spot-error small muted"><span>Spot an error?</span> Email <a href="mailto:${SITE.corrections}?subject=Correction%20request">${SITE.corrections}</a>. <a href="/about/#corrections">What to send</a>.</p>`;

// ---- structured data (JSON-LD). Escaped so a record's text can never close the script tag.
export const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>`;
const plain = (h) => String(h).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

// A BreadcrumbList from the page's own breadcrumb line (<p class="crumbs">), so every page that shows crumbs also declares them.
export function breadcrumbList(body, path) {
  const m = String(body).match(/<p class="crumbs">(.*?)<\/p>/s);
  if (!m) return null;
  const parts = m[1].split(" / ").map((x) => {
    const a = x.match(/^<a href="([^"]*)">(.*)<\/a>$/s);
    return a ? { href: a[1], name: plain(a[2]) } : { href: null, name: plain(x) };
  });
  if (parts.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: parts.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE.url}${c.href || path}` })),
  };
}

export function layout({ title, description, path = "/", body, notes, bodyClass = "", head = "", scripts = "", updated, jsonld = [], robots = "" }) {
  const full = title ? `${title} · ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`;
  const desc = description || "Every provincial award, federal contract and grant, expense claim and public pay record in Newfoundland and Labrador, each linked to its source.";
  const crumbs = breadcrumbList(body, path);
  const ld = [...(crumbs ? [crumbs] : []), ...jsonld].map(ldScript).join("\n");
  const nav = NAV.map(
    ([href, label]) => `<a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ""}>${label}</a>`
  ).join("");
  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE.url}${esc(path)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE.url}${esc(path)}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:locale" content="en_CA">
<meta property="og:image" content="${SITE.url}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${SITE.name}: ${esc(SITE.tagline)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(full)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.url}/og.png">${robots ? `\n<meta name="robots" content="${esc(robots)}">` : ""}
<meta name="theme-color" content="#1f3c96" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1d377f" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/archivo-roman.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css?v=${ASSET_VERSION}">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
${head}
${ld}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${globalThis.process?.env?.NL_SAMPLE ? `<aside class="proto" aria-label="Sample data"><p><strong>Sample data.</strong> This local copy holds a small random sample of the records, so totals, rankings and search results are partial. Run the pipeline for the full data.</p></aside>` : ""}
<aside class="proto" aria-label="About this prototype" data-nosnippet><p><strong>Prototype</strong> A thought experiment in what public records can show. Figures are gathered and combined by automated scripts and have not been independently vetted. <a href="/about/">What is this?</a></p></aside>
<header class="mast">
  <div class="mast-in">
    <a class="brand" href="/">${WORDMARK}</a>
    <nav class="nav" aria-label="Main">${nav}</nav>
    <form class="mast-search" action="/search/" role="search">
      <label class="vh" for="mq">Search every payment</label>
      <input id="mq" name="q" type="search" placeholder="Search payments" autocomplete="off" enterkeyhint="search">
      <button type="submit" aria-label="Search">${icon("search")}</button>
    </form>
    <button class="theme" type="button" aria-label="Switch light or dark" data-theme-toggle hidden>${icon("moon", "i-moon")}${icon("sun", "i-sun")}</button>
    <a class="gh" href="https://github.com/steveclarke/nl-ledger" aria-label="Source code on GitHub" title="Source code on GitHub"><svg class="ic" viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg></a>
  </div>
</header>
<main id="main">
${body}
${notes ? notes.render() : ""}
</main>
<footer class="foot">
  <div class="foot-in">
    <div class="foot-statement">
    <p class="foot-lede"><strong>${SITE.name} is an independent prototype.</strong> It republishes public records from the Government of Newfoundland and Labrador, the Government of Canada, and the House of Assembly. Every figure links to the record it came from.</p>
    <p class="foot-flag">${icon("query")}<span>${STANDING}</span></p>
    </div>
    <nav class="foot-nav" aria-label="About this site">
      <a href="/about/">What is this?</a><a href="/sources/">Sources and report card</a><a href="/method/">Methods</a><a href="/corrections/">Corrections</a><a href="/data/">Ask your AI</a><a href="/help/">Help build this</a>
    </nav>
    <p class="foot-meta">Contains information licensed under the Open Government Licence – Canada. Provincial and House of Assembly records are used under each publisher's own terms, and Statistics Canada figures are adapted from its tables; this does not constitute an endorsement by Statistics Canada of this product. <a href="/sources/#licences">Licences and sources</a>.</p>
    ${updated ? `<p class="foot-meta">Data gathered ${esc(fmtDate(updated))}.</p>` : ""}
  </div>
</footer>
<script src="/app.js?v=${ASSET_VERSION}" defer></script>
${scripts}
</body>
</html>`;
}

export let ASSET_VERSION = "1";
export function setAssetVersion(v) {
  ASSET_VERSION = v;
}

// A schedule: the Estimates-book table. rows: [{label, cells:[...], cls, href}], cols: [{label, num}]
export function schedule({ caption, cols, rows, foot, id, compact = false }) {
  return html`<div class="sched-wrap"${id ? ` id="${id}"` : ""}><table class="sched${compact ? " compact" : ""}">
    ${caption ? `<caption>${caption}</caption>` : ""}
    <thead><tr>${cols.map((c) => `<th scope="col"${c.num ? ' class="n"' : ""}${c.w ? ` style="inline-size:${c.w}"` : ""}>${c.label}</th>`)}</tr></thead>
    <tbody>${rows.map(
      (r) => html`<tr${r.cls ? ` class="${r.cls}"` : ""}>${r.cells.map((c, i) =>
        i === 0 ? `<th scope="row">${c}</th>` : `<td${cols[i]?.num ? ' class="n"' : ""}>${c}</td>`
      )}</tr>`
    )}</tbody>
    ${foot ? html`<tfoot>${foot.map((r) => html`<tr class="${r.cls || "total"}">${r.cells.map((c, i) =>
      i === 0 ? `<th scope="row">${c}</th>` : `<td${cols[i]?.num ? ' class="n"' : ""}>${c}</td>`)}</tr>`)}</tfoot>` : ""}
  </table></div>`;
}

// Leader list: label ........ figure
export function leaders(items) {
  return html`<dl class="leaders">${items.map(
    (x) => html`<div${x.cls ? ` class="${x.cls}"` : ""}><dt><span>${x.label}</span></dt><dd>${x.value}</dd></div>`
  )}</dl>`;
}

// The 1:1 call-out: one real purchase pulled out at true proportion.
export function oneToOne({ title, amount, body, href, share, against }) {
  return html`<aside class="one">
    <p class="one-tag" aria-hidden="true">1:1</p>
    <p class="one-amt">${money(amount)}</p>
    <p class="one-title">${href ? `<a href="${esc(href)}">${esc(title)}</a>` : esc(title)}</p>
    ${body ? `<p class="one-body">${body}</p>` : ""}
    ${against ? (() => {
      const r = amount / against.amount;
      const txt = r >= 1 ? `${r >= 10 ? Math.round(r) : r.toFixed(1)} times ${against.label}` : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}% of ${against.label}`;
      return `<p class="one-meter"><span class="track"><span style="inline-size:${Math.min(100, Math.max(0.3, r * 100)).toFixed(2)}%"></span></span><span>${txt}</span></p>`;
    })() : ""}
  </aside>`;
}

export function pager(base, page, more) {
  const prev = page > 1 ? `<a rel="prev" href="${base}&page=${page - 1}">Previous</a>` : "";
  const next = more ? `<a rel="next" href="${base}&page=${page + 1}">Next ${icon("arrow")}</a>` : "";
  return prev || next ? `<nav class="pager" aria-label="Pages">${prev}${next}</nav>` : "";
}

export { money, moneyShort };

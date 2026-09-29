// Helpers shared by the page builders.
import { esc, receipt, query, icon } from "../lib/html.mjs";
import { money, date as fmtDate, DATASET_LABEL } from "../lib/format.mjs";

export function supplierHref(D, supplierKey) {
  return supplierKey ? `/supplier/${D.keyHash(supplierKey)}/` : null;
}

// A public body's page is named after its most common printing (the buyers table), so any
// printing of its name links to the one page.
let bodyNames = null;
export function bodyHref(D, name) {
  bodyNames ||= new Map(D.q(`SELECT DISTINCT i.buyer, b.buyer canon FROM items i JOIN buyers b USING (buyer_key)`).map((r) => [r.buyer, r.canon]));
  return `/body/${D.slug(bodyNames.get(name) || name)}/`;
}

// The same query bodies.mjs uses, so a link is written exactly when that page is.
// A link to a public body's page when the build writes one, plain text otherwise (a pattern can name a body
// under a spelling that has no page of its own).
let bodySlugs = null;
export function bodyAnchor(D, name) {
  bodySlugs ||= new Set(D.q(`SELECT (SELECT buyer FROM buyers WHERE buyers.buyer_key = items.buyer_key) buyer
      FROM items WHERE dataset IN ('ppa','fed_contract','fed_grant','canadabuys','paradise','stjohns') AND buyer IS NOT NULL GROUP BY buyer_key`).map((r) => `/body/${D.slug(r.buyer)}/`));
  return bodySlugs.has(bodyHref(D, name)) ? `<a href="${bodyHref(D, name)}">${esc(name)}</a>` : esc(name);
}

// One line item as a schedule row: [who/what, date, amount, source]
export function itemRow(D, it, { showBuyer = true, showSupplier = true, flags = true } = {}) {
  const fl = flags ? D.itemFlags.get(it.id) : null;
  const who = it.supplier || it.person || "";
  const whoHtml = it.supplier_key && it.dataset !== "sunshine"
    ? `<a href="${supplierHref(D, it.supplier_key)}">${esc(who)}</a>`
    : esc(who);
  const lines = [];
  if (showSupplier && who) lines.push(`<strong>${whoHtml}</strong>`);
  if (it.description) lines.push(esc(it.description));
  const meta = [];
  if (showBuyer && it.buyer) meta.push(esc(it.buyer));
  if (it.method) meta.push(esc(it.method));
  const amt = it.amount != null ? money(it.amount) : it.amount_original ? `US${money(it.amount_original)}` : "as printed";
  return {
    cells: [
      `${lines.join("<br>")}${meta.length ? `<span class="meta">${meta.join(" · ")}</span>` : ""}`,
      `<span class="num">${esc(fmtDate(it.date) || it.fiscal_year || "")}</span>`,
      `${amt}${query(fl, D.flagById)}`,
      `<a class="rcpt" href="/item/${it.id.split("-").pop()}/">detail</a> ${receipt(it.source_url, it.page, it.locator)}`,
    ],
  };
}

export const ITEM_COLS = [
  { label: "Supplier and description" },
  { label: "Date", w: "7.5rem" },
  { label: "Amount", num: true, w: "8rem" },
  { label: "Source", num: true, w: "6.5rem" },
];

export function datasetLabel(ds) {
  return DATASET_LABEL[ds] || ds;
}

export function caveat(text) {
  return `<div class="caveat">${icon("query")}<p>${text}</p></div>`;
}

export function pagehead({ crumbs = [], title, lede, extra = "" }) {
  const c = crumbs.length
    ? `<p class="crumbs">${crumbs.map(([href, label]) => (href ? `<a href="${href}">${esc(label)}</a>` : esc(label))).join(" / ")}</p>`
    : "";
  return `<header class="pagehead"><div class="wrap">${c}<h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}${extra}</div></header>`;
}

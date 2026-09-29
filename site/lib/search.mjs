// Search over the D1 `docs` table. Shared by the site's /search route and the MCP server.
//
// Documents hold one or more line items (see pipeline/export.py). D1's full-text index
// finds the documents; the items inside each document are then filtered here, so a
// multi-word query only returns items that contain every word.

const TAG = {
  ds: (v) => "zds" + v.replace(/_/g, ""),
  lv: (v) => "zlv" + v.slice(0, 4),
  y: (v) => "zy" + v,
  f: (v) => "zf" + v.replace(/-/g, ""),
  b: (v) => "zb" + v,
  s: (v) => "zs" + v,
  n: (v) => "zn" + v,
  p: (v) => "zp" + v,
  i: (v) => "zi" + v,
};

export const DATASETS = ["ppa", "fed_contract", "fed_grant", "canadabuys", "pa_pss", "pa_tp", "sunshine", "minister", "mha", "paradise", "stjohns"];

export function words(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function queryWords(q) {
  // Two characters minimum; drop filler words that would match nearly everything.
  const stop = new Set(["the", "and", "of", "for", "to", "in", "a", "an", "on", "at", "by", "with"]);
  return [...new Set(words(q).filter((w) => w.length >= 2 && !stop.has(w)))].slice(0, 8);
}

export function clean(params) {
  const out = {};
  for (const k of ["q", "ds", "lv", "y", "f", "b", "s", "n", "p", "i"]) {
    const v = (params[k] ?? "").toString().trim();
    if (!v) continue;
    if (k === "q") out.q = v.slice(0, 120);
    else if (/^[a-z0-9_-]{1,40}$/i.test(v)) out[k] = v.toLowerCase();
  }
  return out;
}

export function buildMatch(p) {
  const parts = queryWords(p.q).map((w) => `body:"${w}"*`);
  for (const k of ["ds", "lv", "y", "f", "b", "s", "n", "p", "i"]) if (p[k]) parts.push(`tags:${TAG[k](p[k])}`);
  return parts.join(" AND ");
}

function itemText(it, doc) {
  return words([it.s, it.p, it.b || doc.buyer, it.d, it.m, it.city, it.x?.program].filter(Boolean).join(" "));
}

export async function sha10(s) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

// Returns { items: [...], docs: n, more: bool }. Each item carries doc-level fields it needs.
export async function search(db, params, { limit = 40, page = 1, order = "rank" } = {}) {
  const p = clean(params);
  const match = buildMatch(p);
  if (!match) return { items: [], docs: 0, more: false, match: "" };
  const offset = (Math.max(1, page) - 1) * limit;
  const res = await db
    .prepare(`SELECT doc_id, dataset, title, buyer, total, n, items FROM docs WHERE docs MATCH ?1 ORDER BY ${order === "amount" ? "total DESC" : "rank"} LIMIT ?2 OFFSET ?3`)
    .bind(match, limit + 1, offset)
    .all();
  const rows = res.results || [];
  const more = rows.length > limit;
  const qw = queryWords(p.q);
  const personHashes = new Map();
  const items = [];
  for (const doc of rows.slice(0, limit)) {
    const body = JSON.parse(doc.items);
    for (const it of body.it) {
      if (p.s && it.k !== p.s) continue;
      if (p.n && it.n !== p.n) continue;
      if (p.f && !(it.f || []).includes(p.f)) continue;
      if (p.i && it.i !== p.i) continue;
      if (p.y && !String(it.t || it.fy || "").includes(p.y)) continue;
      if (p.p) {
        const key = (it.p || "").toLowerCase();
        if (!personHashes.has(key)) personHashes.set(key, await sha10(key));
        if (personHashes.get(key) !== p.p) continue;
      }
      if (qw.length) {
        const t = itemText(it, doc);
        if (!qw.every((w) => t.some((x) => x.startsWith(w)))) continue;
      }
      items.push({ ...it, ds: body.ds, lv: body.lv, u: it.u || body.u, b: it.b || doc.buyer, doc: doc.doc_id, dtitle: doc.title });
    }
  }
  return { items, docs: Math.min(rows.length, limit), more, match, params: p };
}

export async function getItem(db, id) {
  if (!/^[0-9a-f]{12}$/.test(id)) return null;
  const r = await db.prepare("SELECT doc_id, dataset, title, buyer, items FROM docs WHERE docs MATCH ?1 LIMIT 1").bind(`tags:zi${id}`).first();
  if (!r) return null;
  const body = JSON.parse(r.items);
  const it = body.it.find((x) => x.i === id);
  if (!it) return null;
  return { ...it, ds: body.ds, lv: body.lv, u: it.u || body.u, b: it.b || r.buyer, doc: r.doc_id, dtitle: r.title, siblings: body.it.length };
}

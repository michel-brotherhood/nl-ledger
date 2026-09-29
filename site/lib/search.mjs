// Search over the D1 `docs` table. Shared by the site's /search route and the MCP server.
//
// Documents hold one or more line items (see pipeline/export.py). D1's full-text index
// finds the documents; the items inside each document are then filtered here, so a
// multi-word query only returns items that contain every word.
//
// find() adds three things around that exact search (NOTES.md, "Search"): a misspelled word is
// corrected when nothing matches, records close in meaning are listed after the exact ones
// (meaning.mjs), and a search with few results suggests shorter searches that do match.
import { correct } from "./spell.mjs";
import { MEANING, nearestDocs, rowidOf } from "./meaning.mjs";

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

// Sources switched off (the pipeline side is DISABLED in pipeline/common.py; NOTES.md, "Switching a source on or off").
export const SOURCES_OFF = ["paradise", "stjohns"];
export const DATASETS = ["ppa", "fed_contract", "fed_grant", "canadabuys", "pa_pss", "pa_tp", "sunshine", "minister", "mha", "paradise", "stjohns"]
  .filter((d) => !SOURCES_OFF.includes(d));

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

// The items of one document that pass the filters (not the query words).
async function filterItems(doc, p, personHashes) {
  const body = JSON.parse(doc.items);
  const out = [];
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
    out.push({ ...it, ds: body.ds, lv: body.lv, u: it.u || body.u, b: it.b || doc.buyer, doc: doc.doc_id, dtitle: doc.title });
  }
  return out;
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
    for (const it of await filterItems(doc, p, personHashes)) {
      if (qw.length) {
        const t = itemText(it, doc);
        if (!qw.every((w) => t.some((x) => x.startsWith(w)))) continue;
      }
      items.push(it);
    }
  }
  return { items, docs: Math.min(rows.length, limit), more, match, params: p };
}

// Filters that narrow to one supplier, body, person or record: meaning search adds nothing there.
const NARROW = ["s", "n", "b", "p", "i"];

// Records close in meaning to the query that the exact search did not return, closest first.
// near is nearestDocs()'s answer; null (meaning search unavailable) passes through.
async function meaningItems(io, p, exclude, near) {
  if (!near) return null;
  const fresh = near.filter(([id]) => !exclude.has(id)).slice(0, MEANING.maxDocs);
  if (!fresh.length) return [];
  const score = new Map(fresh);
  const ids = await Promise.all(fresh.map(([id]) => rowidOf(id)));
  // Row ids are decimal strings of 60-bit integers: written into the SQL as literals (digits only), never bound as JS numbers.
  if (!ids.every((x) => /^\d+$/.test(x))) return null;
  const tags = ["ds", "lv", "y", "f"].filter((k) => p[k]).length ? buildMatch({ ...p, q: "" }) : "";
  const st = io.db.prepare(`SELECT doc_id, dataset, title, buyer, total, n, items FROM docs WHERE rowid IN (${ids.join(",")})${tags ? " AND docs MATCH ?1" : ""}`);
  const rows = ((await (tags ? st.bind(tags) : st).all()).results || []).sort((a, b) => score.get(b.doc_id) - score.get(a.doc_id));
  const qw = queryWords(p.q).map((w) => w.slice(0, 5));
  const personHashes = new Map();
  const items = [];
  for (const doc of rows) {
    const its = await filterItems(doc, p, personHashes);
    // In a grouped document (an MHA's claims for a year), show the items sharing a word with the query, then the largest.
    const shares = (it) => (qw.some((w) => itemText(it, doc).some((x) => x.startsWith(w))) ? 1 : 0);
    its.sort((a, b) => shares(b) - shares(a) || (b.a || 0) - (a.a || 0));
    for (const it of its.slice(0, MEANING.perDoc)) items.push({ ...it, near: score.get(doc.doc_id) });
  }
  return items;
}

// Shorter searches that do match, when a search with several words finds little: the longest
// ones first ("who fixes the roads in Gander" → "roads gander"), at most 10 checks.
function subsets(ws, k) {
  if (k === 0) return [[]];
  if (ws.length < k) return [];
  const [h, ...t] = ws;
  return [...subsets(t, k - 1).map((x) => [h, ...x]), ...subsets(t, k)];
}
const QUESTION = new Set(["who", "what", "where", "when", "why", "how", "which", "is", "are", "was", "were", "do", "does", "did", "much", "many"]);
async function dropWordSuggestions(db, p, all) {
  const qw = all.filter((w) => !QUESTION.has(w));
  if (!qw.length || all.length < 2 || qw.length > 6) return [];
  let checks = 10;
  for (let k = qw.length === all.length ? qw.length - 1 : qw.length; k >= 1 && checks > 0; k--) {
    const tries = subsets(qw, k).slice(0, checks);
    checks -= tries.length;
    const found = await Promise.all(tries.map(async (ws) => {
      const r = await db.prepare("SELECT 1 FROM docs WHERE docs MATCH ?1 LIMIT 1").bind(buildMatch({ ...p, q: ws.join(" ") })).first().catch(() => null);
      return r ? ws.join(" ") : null;
    }));
    if (found.some(Boolean)) return found.filter(Boolean).slice(0, 4);
  }
  return [];
}

// The site's and the AI server's search. io: { db, ai, vec, limiter, cache, waitUntil, vocab() }; only db is required.
// Returns search()'s result plus corrected ({ q, fixed }), near (items close in meaning, or null) and suggest ([queries]).
export async function find(io, params, { meaning = true, ...opts } = {}) {
  const p = clean(params);
  const page = Math.max(1, opts.page || 1);
  const qw = queryWords(p.q);
  const wantMeaning = meaning && page === 1 && qw.length && !NARROW.some((k) => p[k]);
  // Meaning lookup runs alongside the exact search; it only needs the exact results at the end.
  // The whole query, small words included: "roads in Gander" means more than "roads gander".
  const nearP = wantMeaning ? nearestDocs(io, words(p.q).join(" "), { ds: p.ds, y: p.y }).catch((e) => (io.onError?.(e), null)) : Promise.resolve(null);
  let r = await search(io.db, p, opts);
  let corrected = null;
  if (qw.length && !r.items.length && io.vocab) {
    const vocab = await io.vocab().catch(() => null);
    const c = vocab && correct(vocab, qw);
    if (c) {
      const r2 = await search(io.db, { ...p, q: c.q }, opts);
      if (r2.items.length) {
        r = { ...r2, params: p };
        corrected = c;
      }
    }
  }
  let near = null;
  if (wantMeaning) near = await meaningItems(io, p, new Set(r.items.map((it) => it.doc)), await nearP).catch(() => null);
  const suggest = page === 1 && qw.length && r.items.length < 5 ? await dropWordSuggestions(io.db, p, corrected ? corrected.q.split(" ") : qw) : [];
  return { ...r, corrected, near, suggest };
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

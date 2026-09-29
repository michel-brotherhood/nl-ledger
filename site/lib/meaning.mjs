// Search by meaning: records about the same thing as the query, even when they share no word
// with it ("snow clearing" finds snow removal contracts). Workers AI turns the query into a
// vector; Vectorize returns the search documents closest to it (pipeline/vectorize_sync.py
// keeps one vector per D1 document); D1 then reads those documents by row id.
//
// Every step can fail or be switched off (no binding in local dev, the per-location limit
// reached, a slow or failed call): the caller then gets null and search stays keyword only.

export const MEANING = {
  model: "@cf/baai/bge-m3",
  topK: 50,
  // Cosine similarity below which a document is not shown. Set from the query set in NOTES.md
  // ("Search"): unrelated queries top out below it, useful matches sit above it.
  min: 0.42,
  maxDocs: 20,
  perDoc: 3,
  timeoutMs: 2500,
  cacheSeconds: 86400,
};

// D1 row id of a document, as export.py and d1_sync.py compute it: the first 15 hex digits of
// sha1(doc_id). It passes 2^53, so it is kept as a decimal string, never a JS number.
export async function rowidOf(docId) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(docId)));
  return BigInt("0x" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 15)).toString();
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise((_, reject) => { t = setTimeout(() => reject(new Error("timeout")), ms); })]).finally(() => clearTimeout(t));
}

// [[doc_id, score], ...] closest first, above MEANING.min; [] for nothing close; null when
// meaning search is unavailable. `q` is already normalized (lowercase words joined by spaces).
export async function nearestDocs(io, q, { ds, y } = {}) {
  if (!io.ai || !io.vec || q.length < 3) return null;
  const key = new Request(`https://meaning.nlledger.internal/v1?${new URLSearchParams({ m: MEANING.model, q, ds: ds || "", y: y || "" })}`);
  const cache = io.cache;
  const hit = cache ? await cache.match(key).catch(() => null) : null;
  if (hit) return hit.json();
  // Only queries that miss the cache count against the limit, so a popular search costs nothing extra.
  if (io.limiter) {
    const { success } = await io.limiter.limit({ key: "meaning" }).catch(() => ({ success: false }));
    if (!success) return null;
  }
  const filter = {};
  if (ds) filter.ds = ds;
  if (y) Object.assign(filter, { y0: { $lte: Number(y) }, y1: { $gte: Number(y) } });
  const found = await withTimeout((async () => {
    const e = await io.ai.run(MEANING.model, { text: [q] });
    const r = await io.vec.query(e.data[0], { topK: MEANING.topK, returnMetadata: "none", ...(Object.keys(filter).length ? { filter } : {}) });
    return r.matches.filter((m) => m.score >= MEANING.min).map((m) => [m.id, Math.round(m.score * 1000) / 1000]);
  })(), MEANING.timeoutMs);
  if (cache) {
    const put = cache.put(key, new Response(JSON.stringify(found), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${MEANING.cacheSeconds}` } }));
    io.waitUntil ? io.waitUntil(put) : await put;
  }
  return found;
}

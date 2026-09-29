// Supplier summaries for /supplier/<hash>/ pages, split into 512 JSON shards so a
// Worker route reads one small file per request.
//
// A supplier is a group of printed names (pipeline/suppliers.py). Where a group combines
// several names, each name's own key also gets an entry { to: <group hash> }, so a link or
// an AI-server lookup by that name finds the supplier.
export const SHARDS = 512;

export function shardOf(hash) {
  return parseInt(hash.slice(0, 4), 16) % SHARDS;
}

export function buildSupplierShards(D) {
  const files = {};
  const rows = D.q(`SELECT id, dataset, level, buyer, buyer_key, supplier, supplier_key, supplier_name_key, description, amount, currency, amount_original,
      date, fiscal_year, method, city, source_url, page, locator FROM items
      WHERE supplier_key IS NOT NULL AND supplier_key != '' AND dataset != 'sunshine' ORDER BY supplier_key`);
  let count = 0;
  let i = 0;
  while (i < rows.length) {
    const key = rows[i].supplier_key;
    let j = i;
    while (j < rows.length && rows[j].supplier_key === key) j++;
    const its = rows.slice(i, j);
    i = j;
    count++;
    const h = D.keyHash(key);
    const names = {};
    const variants = {};
    const byDs = {};
    const byYear = {};
    const buyers = {};
    const flags = {};
    let total = 0;
    // Payments (Public Accounts) and CanadaBuys notices repeat money already counted as a
    // contract or grant, so they are shown but kept out of the headline total.
    const OVERLAP = new Set(["pa_pss", "pa_tp", "canadabuys"]);
    let overlap = 0;
    for (const it of its) {
      names[it.supplier] = (names[it.supplier] || 0) + 1;
      const a = it.amount || 0;
      const v = (variants[it.supplier_name_key] ||= { printed: {}, n: 0, a: 0 });
      v.printed[it.supplier] = (v.printed[it.supplier] || 0) + 1;
      v.n++;
      if (!OVERLAP.has(it.dataset)) v.a += a;
      if (OVERLAP.has(it.dataset)) overlap += a;
      else total += a;
      (byDs[it.dataset] ||= [0, 0])[0]++;
      byDs[it.dataset][1] += a;
      const y = (it.date || "").slice(0, 4) || (it.fiscal_year || "").match(/\d{4}/)?.[0];
      if (y && !OVERLAP.has(it.dataset)) byYear[y] = (byYear[y] || 0) + a;
      const b = (buyers[it.buyer] ||= { name: it.buyer, level: it.level, n: 0, amount: 0 });
      b.n++;
      b.amount += a;
      for (const f of D.itemFlags.get(it.id) || []) flags[f] = (flags[f] || 0) + 1;
    }
    const name = Object.entries(names).sort((a, b) => b[1] - a[1])[0][0];
    const top = [...its].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 40).map((it) => ({
      i: it.id.split("-").pop(), ds: it.dataset, b: it.buyer, d: (it.description || "").slice(0, 200), a: it.amount,
      c: it.currency !== "CAD" ? it.currency : undefined, o: it.amount_original || undefined, t: it.date || it.fiscal_year,
      m: it.method || undefined, u: it.source_url, g: it.page || undefined, l: it.locator, f: D.itemFlags.get(it.id) || undefined,
    }));
    // Several printed names joined on evidence: each with its record count, value and the
    // hash that filters search to its own records.
    const combined = Object.keys(variants).length > 1
      ? Object.entries(variants).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => ({
        t: Object.entries(v.printed).sort((a, b) => b[1] - a[1])[0][0], h: D.keyHash(k), n: v.n, a: v.a,
      }))
      : undefined;
    for (const c of combined || []) if (c.h !== h) (files[shardOf(c.h)] ||= {})[c.h] = { to: h };
    const n = shardOf(h);
    (files[n] ||= {})[h] = {
      name, key, combined, names: !combined && Object.keys(names).length > 1 ? Object.keys(names).slice(0, 8) : undefined,
      total, overlap, n: its.length, byDs, byYear,
      buyers: Object.values(buyers).sort((a, b) => b.amount - a.amount).slice(0, 12),
      flags, top, city: its.find((x) => x.city)?.city,
    };
  }
  checkTotals(D, files, count);
  return { files, count };
}

// Supplier pages must add up to the records: every record on exactly one page, and each
// page's total and overlap together equal to the money on its records. A difference stops
// the build (and so the deploy).
function checkTotals(D, files, count) {
  const want = D.q(`SELECT count(*) n, count(DISTINCT supplier_key) g,
      sum(CASE WHEN dataset IN ('pa_pss', 'pa_tp', 'canadabuys') THEN 0 ELSE coalesce(amount, 0) END) total,
      sum(CASE WHEN dataset IN ('pa_pss', 'pa_tp', 'canadabuys') THEN coalesce(amount, 0) ELSE 0 END) overlap
      FROM items WHERE supplier_key IS NOT NULL AND supplier_key != '' AND dataset != 'sunshine'`)[0];
  const got = { n: 0, g: 0, total: 0, overlap: 0 };
  const pages = new Set();
  const aliases = [];
  for (const file of Object.values(files)) {
    for (const [h, s] of Object.entries(file)) {
      if (s.to) { aliases.push([h, s.to]); continue; }
      pages.add(h);
      got.n += s.n; got.g++; got.total += s.total; got.overlap += s.overlap;
    }
  }
  const off = (a, b) => Math.abs(a - b) > 1;
  const bad = [];
  if (got.n !== want.n || got.g !== want.g || got.g !== count) bad.push(`records ${got.n} of ${want.n}, suppliers ${got.g} of ${want.g}`);
  if (off(got.total, want.total)) bad.push(`totals ${got.total.toFixed(2)} against ${want.total.toFixed(2)}`);
  if (off(got.overlap, want.overlap)) bad.push(`overlap ${got.overlap.toFixed(2)} against ${want.overlap.toFixed(2)}`);
  for (const [h, to] of aliases) if (!pages.has(to)) bad.push(`name ${h} points to missing supplier ${to}`);
  if (bad.length) throw new Error(`supplier pages do not add up to the records: ${bad.join("; ")}`);
  console.log(`supplier totals: ${got.g} suppliers, ${got.n} records, $${got.total.toFixed(2)} plus $${got.overlap.toFixed(2)} overlap, as the records; ${aliases.length} other names point to them`);
}

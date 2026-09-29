// Supplier summaries for /supplier/<hash>/ pages, split into 512 JSON shards so a
// Worker route reads one small file per request.
export const SHARDS = 512;

export function shardOf(hash) {
  return parseInt(hash.slice(0, 4), 16) % SHARDS;
}

export function buildSupplierShards(D) {
  const files = {};
  const rows = D.q(`SELECT id, dataset, level, buyer, buyer_key, supplier, supplier_key, description, amount, currency, amount_original,
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
    const n = shardOf(h);
    (files[n] ||= {})[h] = {
      name, key, names: Object.keys(names).length > 1 ? Object.keys(names).slice(0, 8) : undefined,
      total, overlap, n: its.length, byDs, byYear,
      buyers: Object.values(buyers).sort((a, b) => b.amount - a.amount).slice(0, 12),
      flags, top, city: its.find((x) => x.city)?.city,
    };
  }
  return { files, count };
}

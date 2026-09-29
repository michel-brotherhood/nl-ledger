import { supplierPage } from "../../lib/views.mjs";
import { supplierIndexable } from "../../lib/indexing.mjs";
import { moneyWords, num, fit } from "../../lib/format.mjs";
import { assets, page, cached } from "../_shared.js";

const SHARDS = 512;

export async function onRequestGet(ctx) {
  return cached(ctx, async () => {
    const a = await assets(ctx);
    const h = String(ctx.params.h || "").toLowerCase();
    let s = null;
    if (/^[0-9a-f]{10}$/.test(h)) {
      const n = parseInt(h.slice(0, 4), 16) % SHARDS;
      const res = await ctx.env.ASSETS.fetch(new URL(`/data/s/${n}.json`, ctx.request.url));
      if (res.ok) s = (await res.json())[h] || null;
    }
    // A name this supplier is also printed under: its page is the supplier's.
    if (s?.to) return Response.redirect(new URL(`/supplier/${s.to}/`, ctx.request.url), 301);
    if (!s) {
      const body = `<header class="pagehead"><div class="wrap"><h1>No such supplier</h1><p class="lede">Nothing on record under that link. <a href="/search/">Search</a> for the name instead.</p></div></header>`;
      return page(ctx, a, { title: "Not found", body, status: 404, maxAge: 300 });
    }
    const v = supplierPage(s, { ...a, hash: h });
    const name = s.name.length > 42 ? s.name.slice(0, 42).replace(/\s+\S*$/, "") + "…" : s.name;
    const text = `${s.name} appears in ${num(s.n)} government records worth ${moneyWords(s.total)}: contracts, grants and payments, each with its source.`;
    return page(ctx, a, { title: `${name}: government contracts and payments`, description: fit(text), body: v.body, robots: supplierIndexable(s) ? "" : "noindex,follow" });
  });
}

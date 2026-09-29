import { supplierPage } from "../../lib/views.mjs";
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
    if (!s) {
      const body = `<header class="pagehead"><div class="wrap"><h1>No such supplier</h1><p class="lede">Nothing on record under that link. <a href="/search/">Search</a> for the name instead.</p></div></header>`;
      return page(ctx, a, { title: "Not found", body, status: 404, maxAge: 300 });
    }
    const v = supplierPage(s, { ...a, hash: h });
    return page(ctx, a, { title: v.title, description: `Everything ${v.title} received from provincial, federal and municipal governments in Newfoundland and Labrador, with sources.`, body: v.body });
  });
}

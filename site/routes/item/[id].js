import { getItem } from "../../lib/search.mjs";
import { itemPage } from "../../lib/views.mjs";
import { assets, page, cached } from "../_shared.js";

export async function onRequestGet(ctx) {
  return cached(ctx, async () => {
    const a = await assets(ctx);
    const id = String(ctx.params.id || "").toLowerCase();
    const it = await getItem(ctx.env.DB, id);
    if (!it) {
      const body = `<header class="pagehead"><div class="wrap"><h1>No such record</h1><p class="lede">That record is not in the ledger. <a href="/search/">Search</a> instead.</p></div></header>`;
      return page(ctx, a, { title: "Not found", body, status: 404, maxAge: 300 });
    }
    const v = itemPage(it, a);
    return page(ctx, a, { title: v.title, description: `${v.title}: the public record and its source.`, body: v.body });
  });
}

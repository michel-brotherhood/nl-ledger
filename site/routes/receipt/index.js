import { renderReceipt } from "../../lib/receipt.mjs";
import { esc } from "../../lib/html.mjs";
import { money, num } from "../../lib/format.mjs";
import { assets, page } from "../_shared.js";

let R = null;
export async function onRequestGet(ctx) {
  const a = await assets(ctx);
  R ||= await (await ctx.env.ASSETS.fetch(new URL("/data/receipt.json", ctx.request.url))).json();
  const raw = new URL(ctx.request.url).searchParams.get("income") || "";
  const cleaned = raw.replace(/[\s,$]/g, "");
  const valid = /^\d{1,8}(\.\d{0,2})?$/.test(cleaned);
  const income = valid ? Math.min(10_000_000, Math.floor(Number(cleaned))) : a.stats.median_annual_wage.value;
  const body = `<header class="pagehead"><div class="wrap"><p class="crumbs"><a href="/">Home</a> / Your receipt</p><h1>Your receipt</h1>
    ${raw && !valid ? `<p class="lede">That income could not be read, so the median wage is shown. Enter a whole number of dollars, like 55000.</p>` : ""}
    <p class="lede">What your ${R.tax.year} provincial income tax paid for in ${R.year}, spread the way the province spent its money. <a href="/method/receipt/">How this is worked out</a>.</p></div></header>
  <section class="section"><div class="wrap grid-2">
    <form class="field" action="/receipt/" method="get" data-receipt-form style="max-inline-size:26rem">
      <label for="inc">Your yearly income</label>
      <div class="field-row"><span class="pre">$</span><input id="inc" name="income" inputmode="numeric" value="${esc(num(income))}" autocomplete="off"><button class="btn" type="submit">Update</button></div>
      <p class="small muted" style="margin-block-start:.8rem">The median full-time wage in the province is ${money(a.stats.median_annual_wage.value)}.</p>
    </form>
    <div data-receipt-out>${renderReceipt(R, income, a.stats)}</div>
  </div></section>`;
  const res = page(ctx, a, { title: "Your receipt", body, path: "/receipt/", maxAge: 0 });
  res.headers.set("cache-control", "private, no-store");
  return res;
}

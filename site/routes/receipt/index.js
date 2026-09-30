import { renderReceipt } from "../../lib/receipt.mjs";
import { receiptForm } from "../../lib/html.mjs";
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
    <p class="lede">An estimate of ${R.tax.year} provincial income tax on employment income, illustrated using the province’s ${R.year} spending shares. <a href="/method/receipt/">How this is worked out</a>.</p></div></header>
  <section class="section"><div class="wrap grid-2">
    <div>${receiptForm({ id: "inc", value: raw && !valid ? raw : num(income), error: raw && !valid ? "Enter an amount in dollars, for example 55000. The median-wage illustration is shown until you enter a valid income." : "" })}
      <p class="small muted">The median full-time wage in the province is ${money(a.stats.median_annual_wage.value)}.</p></div>
    <div data-receipt-out>${renderReceipt(R, income, a.stats)}</div>
  </div></section>`;
  const res = page(ctx, a, { title: "NL employment income tax illustration", description: `Estimate ${R.tax.year} Newfoundland and Labrador provincial income tax for a single employee with one job and illustrate spending shares, using form NL428.`, body, path: "/receipt/", maxAge: 0 });
  res.headers.set("cache-control", "private, no-store");
  return res;
}

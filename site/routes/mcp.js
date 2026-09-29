// The MCP server, served from the site's own address.
import { handleMcp } from "../lib/mcp.mjs";
import { searchIO } from "./_shared.js";

const cache = new Map();
export async function onRequest(ctx) {
  const io = {
    ...searchIO(ctx),
    json: async (p) => {
      if (cache.has(p)) return cache.get(p);
      const res = await ctx.env.ASSETS.fetch(new URL(p, ctx.request.url));
      const v = res.ok ? await res.json() : null;
      if (cache.size > 40) cache.clear();
      cache.set(p, v);
      return v;
    },
  };
  return handleMcp(ctx.request, io);
}

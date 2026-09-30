// The site's Worker. Static pages come straight from dist (wrangler.config.ts); only the
// paths listed in runWorkerFirst (cloudflare.config.ts) reach this code, where they are rendered from D1.
import * as search from "./routes/search/index.js";
import * as supplier from "./routes/supplier/[h].js";
import * as item from "./routes/item/[id].js";
import * as receipt from "./routes/receipt/index.js";
import * as feedback from "./routes/feedback.js";
import * as mcp from "./routes/mcp.js";
import * as serverCard from "./routes/mcp/server-card.js";
import * as aiCatalog from "./routes/.well-known/ai-catalog.json.js";

const ROUTES = [
  [/^\/search\/?$/, search],
  [/^\/supplier\/(?<h>[^/]+)\/?$/, supplier],
  [/^\/item\/(?<id>[^/]+)\/?$/, item],
  [/^\/receipt\/?$/, receipt],
  [/^\/feedback\/?$/, feedback],
  [/^\/feedback\/sent\/?$/, feedback.sent],
  [/^\/mcp\/?$/, mcp],
  [/^\/mcp\/server-card$/, serverCard],
  [/^\/\.well-known\/ai-catalog\.json$/, aiCatalog],
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    for (const [re, mod] of ROUTES) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const handler = mod.onRequest || ((request.method === "GET" || request.method === "HEAD") && mod.onRequestGet);
      if (!handler) return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      return handler({ request, env, params: m.groups || {}, waitUntil: (p) => ctx.waitUntil(p) });
    }
    return env.ASSETS.fetch(request);
  },
};

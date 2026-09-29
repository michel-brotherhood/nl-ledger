import { existsSync } from "node:fs";
import { bindings, defineConfig } from "cf/config";

// Deploy settings come from the environment, or from site/.env (see .env.example).
if (existsSync(".env")) process.loadEnvFile(".env");
const env = (name: string) => process.env[name] ?? "";

// The whole site is one Worker: static pages from dist (built by build.mjs, see wrangler.config.ts),
// and only the paths in runWorkerFirst run worker.mjs, which renders them from D1.
export default defineConfig({
  accountId: env("CLOUDFLARE_ACCOUNT_ID"),
  worker: {
    name: "nlledger",
    compatibilityDate: "2026-09-01",
    entrypoint: "./worker.mjs",
    assets: {
      notFoundHandling: "404-page",
      // Every other path is a static asset: free and unlimited, not counted against 100,000 requests a day.
      runWorkerFirst: ["/search", "/search/*", "/supplier/*", "/item/*", "/receipt", "/receipt/*", "/mcp", "/mcp/*", "/.well-known/ai-catalog.json"],
    },
    domains: ["nlledger.ca"],
    workersDev: false,
    previewUrls: false,
    observability: { enabled: true },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ id: env("NL_LEDGER_D1_ID"), name: "nl-ledger" }),
    },
  },
});

import { existsSync } from "node:fs";
import { bindings, defineConfig } from "cf/config";

// Deploy settings come from the environment, or from site/.env (see .env.example).
if (existsSync(".env")) process.loadEnvFile(".env");
const env = (name: string) => process.env[name] ?? "";

// The whole site is one Worker: static pages from dist (built by build.mjs, see wrangler.config.ts),
// and only the paths in runWorkerFirst run worker.mjs, which renders them from D1.
// NL_LEDGER_PREVIEW=1 deploys the same code and bindings as a second Worker, nlledger-preview, on its
// workers.dev address and leaves the live site alone: for trying a change against the real D1, mail and
// Turnstile before it goes live (NOTES.md "Preview copy").
const preview = env("NL_LEDGER_PREVIEW") === "1";

export default defineConfig({
  accountId: env("CLOUDFLARE_ACCOUNT_ID"),
  worker: {
    name: preview ? "nlledger-preview" : "nlledger",
    compatibilityDate: "2026-09-01",
    entrypoint: "./worker.mjs",
    assets: {
      notFoundHandling: "404-page",
      // Every other path is a static asset: free and unlimited, not counted against 100,000 requests a day.
      runWorkerFirst: ["/search", "/search/*", "/supplier/*", "/item/*", "/receipt", "/receipt/*", "/feedback", "/feedback/*", "/mcp", "/mcp/*", "/.well-known/ai-catalog.json"],
    },
    domains: preview ? [] : ["nlledger.ca"],
    workersDev: preview,
    previewUrls: false,
    observability: { enabled: true },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ id: env("NL_LEDGER_D1_ID"), name: "nl-ledger" }),
      // Search by meaning (lib/meaning.mjs, NOTES.md "Search"): Workers AI turns the query into a vector,
      // Vectorize finds the closest search documents (filled by pipeline/vectorize_sync.py), and the rate
      // limit caps how many queries per minute, per Cloudflare location, may reach either.
      AI: bindings.ai({}),
      MEANING: bindings.vectorize({ name: "nl-ledger-meaning" }),
      MEANING_LIMIT: bindings.rateLimit({ namespace: "346", simple: { limit: 30, period: 60 } }),
      // The feedback box (routes/feedback.js, NOTES.md "Feedback box"): notes are emailed from an address on the
      // domain, and one network address may post four times a minute. The two secrets are set once on the
      // Worker (NOTES.md has the commands); naming them here is what makes a deploy keep them.
      TURNSTILE_SECRET: bindings.secret(),
      FEEDBACK_TO: bindings.secret(),
      MAIL: bindings.sendEmail({}),
      FEEDBACK_LIMIT: bindings.rateLimit({ namespace: "349", simple: { limit: 4, period: 60 } }),
    },
  },
});

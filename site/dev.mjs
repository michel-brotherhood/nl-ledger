// Run the whole site on this computer, with no Cloudflare account: `./dev.sh` from the repository root.
// Uses the real data in data/build/ if the pipeline has been run, otherwise the small sample in sample/.
// Builds the static pages, then serves them with the same request-time code the Worker runs
// (search, supplier, record, receipt and MCP pages), reading a local SQLite copy of the search index.
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const BUILD = join(ROOT, "data", "build");
const DIST = join(HERE, "dist");
const PORT = Number(process.env.PORT || process.argv[2] || 8787);

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node 22.13 or newer is needed (this is ${process.versions.node}).`);
  process.exit(1);
}
const { DatabaseSync } = await import("node:sqlite");

// 1. Data: the pipeline's database if there is one, otherwise the sample.
const dbPath = join(BUILD, "ledger.db");
let sample = false;
if (!existsSync(dbPath)) {
  console.log("No data/build/ledger.db, so loading the sample data (a random sample of the records).");
  mkdirSync(join(BUILD, "d1"), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(gunzipSync(readFileSync(join(ROOT, "sample", "ledger.sql.gz"))).toString("utf8"));
  db.close();
  writeFileSync(join(BUILD, "d1", "docs.jsonl"), gunzipSync(readFileSync(join(ROOT, "sample", "docs.jsonl.gz"))));
  for (const f of ["schema.sql"]) writeFileSync(join(BUILD, "d1", f), readFileSync(join(ROOT, "sample", f)));
  mkdirSync(join(ROOT, "data", "cache"), { recursive: true });
  if (!existsSync(join(ROOT, "data", "cache", "manifest.json"))) writeFileSync(join(ROOT, "data", "cache", "manifest.json"), readFileSync(join(ROOT, "sample", "manifest.json")));
  writeFileSync(join(BUILD, "flag_catalog.json"), readFileSync(join(ROOT, "sample", "flag_catalog.json")));
  rmSync(join(BUILD, "local-search.db"), { force: true });
}
{
  const db = new DatabaseSync(dbPath, { readOnly: true });
  sample = !!db.prepare("SELECT 1 FROM facts WHERE key='sample'").get();
  db.close();
}
if (sample) console.log("Using the sample data. Run the pipeline (see the README) for everything.");

// 2. Static pages.
console.log("Building the pages...");
const built = spawnSync(process.execPath, ["build.mjs"], { cwd: HERE, stdio: "inherit", env: { ...process.env, ...(sample ? { NL_SAMPLE: "1" } : {}) } });
if (built.status !== 0) process.exit(built.status ?? 1);
if (sample) process.env.NL_SAMPLE = "1";

// 3. The search index, as a local SQLite file (D1 is SQLite, so the same queries run).
const searchPath = join(BUILD, "local-search.db");
const docsPath = join(BUILD, "d1", "docs.jsonl");
if (!existsSync(searchPath) || statSync(searchPath).mtimeMs < statSync(docsPath).mtimeMs) {
  console.log("Loading the search index...");
  rmSync(searchPath, { force: true });
  const s = new DatabaseSync(searchPath);
  s.exec(readFileSync(join(BUILD, "d1", "schema.sql"), "utf8"));
  const cols = ["rowid", "body", "tags", "doc_id", "dataset", "title", "buyer", "total", "n", "date_min", "date_max", "h", "items"];
  const ins = s.prepare(`INSERT INTO docs (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
  s.exec("BEGIN");
  // Row ids are 60-bit (export.py) and JSON.parse would round them: read them from the text as BigInt,
  // so the local copy has the same row ids as D1 and lookups by row id (search by meaning) find them.
  for (const line of readFileSync(docsPath, "utf8").split("\n")) {
    if (!line) continue;
    const d = JSON.parse(line);
    d.rowid = BigInt(line.match(/"rowid":\s*(\d+)/)[1]);
    ins.run(...cols.map((c) => d[c]));
  }
  s.exec("COMMIT");
  s.close();
}
const search = new DatabaseSync(searchPath, { readOnly: true });

// 4. A small stand-in for D1 and for the static-assets binding, then the Worker itself.
const d1 = {
  prepare(sql) {
    const st = search.prepare(sql);
    const run = (args) => ({
      all: async () => ({ results: st.all(...args) }),
      first: async () => st.get(...args) ?? null,
      run: async () => ({ success: true }),
    });
    return { ...run([]), bind: (...args) => run(args) };
  },
};
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };
async function assetsFetch(request) {
  const url = new URL(request.url);
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, path);
  if (!file.startsWith(DIST)) return new Response("Not found", { status: 404 });
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  else if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
  if (!existsSync(file)) {
    const nf = join(DIST, "404.html");
    return new Response(existsSync(nf) ? readFileSync(nf) : "Not found", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return new Response(readFileSync(file), { headers: { "content-type": TYPES[extname(file)] || "application/octet-stream" } });
}
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
const { default: worker } = await import("./worker.mjs");
const env = { DB: d1, ASSETS: { fetch: (r) => assetsFetch(r instanceof Request ? r : new Request(r)) } };
const RUN_FIRST = [/^\/search(\/|$)/, /^\/supplier\//, /^\/item\//, /^\/receipt(\/|$)/, /^\/mcp(\/|$)/, /^\/\.well-known\/ai-catalog\.json$/];

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = RUN_FIRST.some((re) => re.test(url.pathname)) ? await worker.fetch(request, env, { waitUntil: () => {} }) : await assetsFetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Server error: " + e.message);
  }
}).listen(PORT, "127.0.0.1", () => console.log(`\nNL Ledger is running at http://localhost:${PORT}/  (Ctrl+C to stop)`));

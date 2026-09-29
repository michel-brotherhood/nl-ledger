// Static site build: reads data/build/ledger.db, writes site/dist.
// Search, supplier, item and receipt pages are rendered on request by the Worker
// (worker.mjs, routes/) from D1 and from the JSON this build writes under dist/data.
import { mkdirSync, writeFileSync, cpSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load, DB_PATH as D_PATH } from "./src/data.mjs";
import { layout, setAssetVersion } from "./lib/html.mjs";
import { home } from "./src/pages/home.mjs";
import { priorities, departments } from "./src/pages/priorities.mjs";
import { bodies } from "./src/pages/bodies.mjs";
import { flagPages } from "./src/pages/flags.mjs";
import { members } from "./src/pages/members.mjs";
import { pay } from "./src/pages/pay.mjs";
import { consulting } from "./src/pages/consulting.mjs";
import { info } from "./src/pages/info.mjs";
import { buildReceiptData } from "./src/receiptdata.mjs";
import { buildSupplierShards } from "./src/shards.mjs";
import { departmentsJSON, flagResultsJSON, membersJSON } from "./src/mcpdata.mjs";
import { serverJson, TOOLS } from "./lib/mcp.mjs";
import { llmsTxt } from "./src/llms.mjs";
import { desc, siteLd } from "./src/seo.mjs";
import { supplierIndexable, SUPPLIER_MIN_RECORDS, SUPPLIER_MIN_TOTAL } from "./lib/indexing.mjs";
import { SITE } from "./lib/format.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(HERE, "static"), DIST, { recursive: true });
mkdirSync(join(DIST, "lib"), { recursive: true });
for (const f of ["format.mjs", "receipt.mjs"]) cpSync(join(HERE, "lib", f), join(DIST, "lib", f));

// cache-busting version from the CSS and JS contents
const v = createHash("sha1")
  .update(readFileSync(join(HERE, "static", "site.css")))
  .update(readFileSync(join(HERE, "static", "app.js")))
  .digest("hex")
  .slice(0, 8);
setAssetVersion(v);

const D = load();
let pages = 0;
const PATHS = [];
export function write(path, page) {
  if (path !== "/404.html" && path.endsWith("/")) PATHS.push(path);
  const file = path.endsWith("/") ? join(DIST, path, "index.html") : join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof page === "string" ? page : layout({ ...page, path, updated: D.gathered }));
  pages++;
}
export function writeJSON(path, obj) {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj));
}

const R = buildReceiptData(D);
writeJSON("data/receipt.json", R);
writeJSON("data/stats.json", D.stats);
writeJSON("data/flags.json", D.catalog);
// The code that renders pages on request; part of the edge cache key, so a code change is never served from an old render.
const codeHash = createHash("sha1");
for (const f of ["worker.mjs", ...readdirSync(join(HERE, "lib")).map((n) => join("lib", n)), ...readdirSync(join(HERE, "routes"), { recursive: true }).map((n) => join("routes", n))].sort()) {
  if (statSync(join(HERE, f)).isFile()) codeHash.update(f).update(readFileSync(join(HERE, f)));
}
writeJSON("data/version.json", { v, data: createHash("sha1").update(readFileSync(D_PATH)).digest("hex").slice(0, 8), code: codeHash.digest("hex").slice(0, 8), updated: D.gathered });
writeJSON("data/departments.json", departmentsJSON(D));
writeJSON("data/flag_results.json", flagResultsJSON(D));
writeJSON("data/members.json", membersJSON(D));

const h = home(D, R);
write("/", { title: "NL government spending: every contract, expense and salary", description: desc(`Every Newfoundland and Labrador government contract, grant, MHA expense claim and salary over $100,000, in one searchable place. Each figure links to its source. Try the tax receipt.`), body: h.body, notes: h.notes, bodyClass: "home", jsonld: siteLd() });

for (const [path, page] of [
  ...priorities(D, R),
  ...departments(D, R),
  ...bodies(D, R),
  ...flagPages(D, R),
  ...members(D, R),
  ...pay(D, R),
  consulting(D, R),
  ...info(D, R),
]) write(path, page);

const shards = buildSupplierShards(D);
for (const [n, obj] of Object.entries(shards.files)) writeJSON(`data/s/${n}.json`, obj);

// Which /body/, /pay/ and /department/ pages exist, so pages rendered on request link only to pages that are there.
const under = (prefix) => PATHS.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length, -1)).filter((x) => x && !x.includes("/"));
writeJSON("data/links.json", { body: under("/body/"), pay: under("/pay/"), department: under("/department/") });

// sitemap.xml: every static page, /receipt/, and the suppliers with enough on record. Record pages are left out on purpose.
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const urls = [...PATHS, "/receipt/"];
let supplierUrls = 0;
for (const file of Object.values(shards.files)) for (const [h, sup] of Object.entries(file)) if (supplierIndexable(sup)) { urls.push(`/supplier/${h}/`); supplierUrls++; }
const lastmod = D.gathered;
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(SITE.url + u)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(DIST, "robots.txt"), `# ${SITE.name}: public spending records. Everything is open to crawlers and AI assistants.\nUser-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

// Discovery: MCP registry entry, AI catalog (draft), llms.txt
writeFileSync(join(DIST, "server.json"), JSON.stringify(serverJson(), null, 2) + "\n");
writeFileSync(join(DIST, "llms.txt"), llmsTxt(D, R, TOOLS));

writeFileSync(join(DIST, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/site.css
  Cache-Control: public, max-age=31536000, immutable
/app.js
  Cache-Control: public, max-age=31536000, immutable
/data/*
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *
/server.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=3600
/llms.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *
`);

console.log(`${pages} pages, ${shards.count} suppliers in ${Object.keys(shards.files).length} shards; sitemap ${urls.length} URLs (${supplierUrls} suppliers with ${SUPPLIER_MIN_RECORDS}+ records or ${SUPPLIER_MIN_TOTAL}+ dollars)`);

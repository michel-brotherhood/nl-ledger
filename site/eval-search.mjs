// The search query set, scored before (keyword only, search()) and after (find(): spelling help,
// meaning, suggestions), on the first 10 records a reader sees. Needs a full pipeline run (data/build/d1)
// and the local cf login; reads the live meaning index through the Cloudflare API.
//   node site/eval-search.mjs            (NOTES.md, "Search")
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { QUERIES } from "./search-queries.mjs";
import { search, find, words } from "./lib/search.mjs";
import { MEANING } from "./lib/meaning.mjs";
import { buildVocab } from "./lib/spell.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const D1 = HERE + "../data/build/d1/";
const index = process.argv[2] || "nl-ledger-meaning";
if (process.argv[3]) MEANING.min = Number(process.argv[3]);
const A = process.env.CLOUDFLARE_ACCOUNT_ID || readFileSync(HERE + ".env", "utf8").match(/^CLOUDFLARE_ACCOUNT_ID=(.+)$/m)[1].trim();
spawnSync("cf", ["auth", "whoami"], { cwd: HERE, stdio: "ignore" }); // renews the login's token
const cfg = `${process.env.HOME}/${process.platform === "darwin" ? "Library/Preferences" : ".config"}/cloudflare/config/`;
const T = readdirSync(cfg).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(cfg + f, "utf8")).oauth_token).find(Boolean);

const lines = readFileSync(D1 + "docs.jsonl", "utf8").split("\n").filter(Boolean);
const sdb = new DatabaseSync(":memory:");
sdb.exec(readFileSync(D1 + "schema.sql", "utf8"));
const cols = ["rowid", "body", "tags", "doc_id", "dataset", "title", "buyer", "total", "n", "date_min", "date_max", "h", "items"];
const ins = sdb.prepare(`INSERT INTO docs (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
sdb.exec("BEGIN");
const bodies = [];
for (const line of lines) {
  const d = JSON.parse(line);
  d.rowid = BigInt(line.match(/"rowid":\s*(\d+)/)[1]);
  ins.run(...cols.map((c) => d[c]));
  bodies.push(d.body);
}
sdb.exec("COMMIT");
const vocab = buildVocab(bodies, words);
const db = {
  prepare(sql) {
    const st = sdb.prepare(sql);
    const run = (args) => ({ all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) ?? null });
    return { ...run([]), bind: (...args) => run(args) };
  },
};
async function cf(path, body) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}${path}`, { method: "POST", headers: { authorization: `Bearer ${T}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.success) return j.result;
    if (i === 3) throw new Error(path + " " + JSON.stringify(j.errors));
    await new Promise((r) => setTimeout(r, 2000));
  }
}
const io = {
  db,
  onError: (e) => console.log("meaning search failed:", e.message),
  vocab: async () => vocab,
  ...(process.env.NO_MEANING === "1" ? {} : {
    ai: { run: (model, input) => cf(`/ai/run/${model}`, input) },
    vec: { query: (vector, opts) => cf(`/vectorize/v2/indexes/${index}/query`, { vector, ...opts }) },
  }),
};
// What the record says, as the relevance rules read it.
const itemText = (it) => [it.s, it.p, it.b, it.d, it.m, it.city, it.x?.program, it.dtitle, ...(it.f || [])].filter(Boolean).join(" ").toLowerCase();
const shown = (items) => [...items].sort((a, b) => (b.a || 0) - (a.a || 0));

const rows = [];
let bHit = 0, aHit = 0, bRel = 0, bN = 0, aRel = 0, aN = 0, negB = 0, negA = 0;
for (const Q of QUERIES) {
  const b = (await search(db, { q: Q.q }, { limit: 30 })).items;
  const r = await find(io, { q: Q.q }, { limit: 30 });
  const before = shown(b).slice(0, 10);
  const after = [...shown(r.items), ...(r.near || [])].slice(0, 10);
  const br = before.filter((it) => Q.rel(itemText(it))).length;
  const ar = after.filter((it) => Q.rel(itemText(it))).length;
  if (Q.neg) { negB += before.length; negA += after.length; }
  else {
    bHit += br > 0; aHit += ar > 0; bRel += br; bN += before.length; aRel += ar; aN += after.length;
  }
  rows.push({ q: Q.q, who: Q.who, before: `${br}/${before.length}`, after: `${ar}/${after.length}`, exact: r.items.length, near: r.near?.length ?? "off", corrected: r.corrected?.q || "", suggest: r.suggest.join(" | ") });
  console.log(Q.q.padEnd(34), "before", `${br}/${before.length}`.padStart(5), " after", `${ar}/${after.length}`.padStart(5), r.corrected ? `(corrected: ${r.corrected.q})` : "", r.suggest.length ? `try: ${r.suggest.join(" | ")}` : "");
}
console.log(`\nmin ${MEANING.min}: found something relevant in the first 10: before ${bHit}/30, after ${aHit}/30; precision of the first 10: before ${(bRel / Math.max(1, bN)).toFixed(2)} (${bN} shown), after ${(aRel / Math.max(1, aN)).toFixed(2)} (${aN} shown); records shown for the 3 nonsense queries: before ${negB}, after ${negA}`);

// Checks on search (lib/search.mjs, spell.mjs, meaning.mjs) against the committed sample, with
// stand-ins for Workers AI and Vectorize. Runs in CI with no account: `node site/check-search.mjs`.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { find, search, words } from "./lib/search.mjs";
import { buildVocab, correct, distance } from "./lib/spell.mjs";
import { rowidOf, MEANING } from "./lib/meaning.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const lines = gunzipSync(readFileSync(ROOT + "sample/docs.jsonl.gz")).toString("utf8").split("\n").filter(Boolean);
const db0 = new DatabaseSync(":memory:");
db0.exec(readFileSync(ROOT + "sample/schema.sql", "utf8"));
const cols = ["rowid", "body", "tags", "doc_id", "dataset", "title", "buyer", "total", "n", "date_min", "date_max", "h", "items"];
const ins = db0.prepare(`INSERT INTO docs (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
const docs = [];
for (const line of lines) {
  const d = JSON.parse(line);
  d.rowid = BigInt(line.match(/"rowid":\s*(\d+)/)[1]);
  ins.run(...cols.map((c) => d[c]));
  docs.push(d);
}
const db = {
  prepare(sql) {
    const st = db0.prepare(sql);
    const run = (args) => ({ all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) ?? null });
    return { ...run([]), bind: (...args) => run(args) };
  },
};
const vocab = buildVocab(docs.map((d) => d.body), words);

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};

// Row ids: the Worker's must equal the pipeline's (export.py: first 15 hex digits of sha1(doc_id)).
for (const d of docs.slice(0, 50)) {
  const py = BigInt("0x" + createHash("sha1").update(d.doc_id).digest("hex").slice(0, 15)).toString();
  if ((await rowidOf(d.doc_id)) !== py || d.rowid.toString() !== py) { check(false, `row id of ${d.doc_id}`); break; }
}
check(true, "row ids match export.py for 50 documents");

// Spelling.
check(distance("memorail", "memorial", 2) === 1, "a swapped pair of letters is one edit");
const memo = correct(vocab, ["memorail", "hospital"]);
check(memo?.q === "memorial hospital", `"memorail hospital" corrects to "memorial hospital" (got ${memo?.q})`);
check(correct(vocab, ["snow"]) === null, "a known word is left alone");
check(correct(vocab, ["zzqxv"]) === null, "a word close to nothing is left alone");

// Keyword only: no bindings (local dev, CI) must behave exactly as search() did.
const io = { db, vocab: async () => vocab };
const plain = await search(db, { q: "ferry" }, { limit: 30 });
const noAi = await find(io, { q: "ferry" }, { limit: 30 });
check(noAi.items.length === plain.items.length && noAi.items.length > 0 && noAi.near === null, `no AI bindings: same ${plain.items.length} exact records, no meaning section`);
const typo = await find(io, { q: "memorail" }, { limit: 30 });
check(typo.corrected?.q === "memorial" && typo.items.length > 0, `a misspelled search shows the corrected one's ${typo.items.length} records`);
const long = await find(io, { q: "who fixes the ferry zzqxv" }, { limit: 30 });
check(long.items.length === 0 && long.suggest.includes("ferry") && long.suggest.every((s) => !s.includes("who")), `an empty search suggests shorter ones that match: ${long.suggest.join(" | ")}`);

// Meaning: stand-ins return the documents whose text holds "snow", as if closest in meaning.
const snowDocs = docs.filter((d) => /snow/i.test(d.body));
const ai = { run: async () => ({ data: [[0.1, 0.2]] }) };
const vec = { query: async (_v, opts) => ({ matches: snowDocs.filter((d) => !opts.filter?.ds || d.dataset === opts.filter.ds).map((d, i) => ({ id: d.doc_id, score: 0.9 - i * 0.001 })).concat([{ id: "ppa:none", score: 0.1 }]) }) };
const withAi = await find({ ...io, ai, vec }, { q: "snow clearing" }, { limit: 30 });
const exactDocs = new Set(withAi.items.map((it) => it.doc));
check(withAi.near?.length > 0, `meaning adds ${withAi.near?.length} records`);
check(withAi.near.every((it) => !exactDocs.has(it.doc)), "records close in meaning never repeat an exact match");
check(withAi.near.every((it) => it.near >= MEANING.min), "nothing below the cutoff is shown");
check(withAi.items.length === (await search(db, { q: "snow clearing" }, { limit: 30 })).items.length, "exact matches are unchanged when meaning is on");
const ds = snowDocs[0]?.dataset;
const filtered = await find({ ...io, ai, vec }, { q: "snow clearing", ds }, { limit: 30 });
check(filtered.near.every((it) => it.ds === ds) && filtered.items.every((it) => it.ds === ds), `the source filter holds for both lists (${ds})`);
const page2 = await find({ ...io, ai, vec }, { q: "snow" }, { limit: 30, page: 2 });
check(page2.near === null, "meaning is on page 1 only");
const narrow = await find({ ...io, ai, vec }, { q: "snow", s: "0123456789" }, { limit: 30 });
check(narrow.near === null, "a supplier filter switches meaning off");

// Failures fall back to keyword only.
const broken = await find({ ...io, ai: { run: async () => { throw new Error("AI down"); } }, vec }, { q: "snow clearing" }, { limit: 30 });
check(broken.near === null && broken.items.length === withAi.items.length, "a failed AI call leaves the exact records");
const limited = await find({ ...io, ai, vec, limiter: { limit: async () => ({ success: false }) } }, { q: "snow clearing" }, { limit: 30 });
check(limited.near === null, "the rate limit reached switches meaning off");
const slow = await find({ ...io, ai: { run: () => new Promise(() => {}) }, vec }, { q: "snow plow" }, { limit: 30 });
check(slow.near === null, `a call slower than ${MEANING.timeoutMs} ms is abandoned`);

if (failed) {
  console.error(`\n${failed} search check(s) failed`);
  process.exit(1);
}
console.log("\nsearch checks: pass");

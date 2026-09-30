// Loads everything the static build needs from data/build/ledger.db (the pipeline's output).
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slug } from "../lib/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DB_PATH = join(ROOT, "data", "build", "ledger.db");

export function keyHash(s, n = 10) {
  return createHash("sha1").update(s || "").digest("hex").slice(0, n);
}

export function load() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const q = (sql, ...a) => db.prepare(sql).all(...a);
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const fact = (k) => JSON.parse(one("SELECT value FROM facts WHERE key=?", k).value);
  const stats = fact("stats");
  const datasets = fact("datasets");
  const federal = fact("federal_report");
  const matching = fact("supplier_matching");
  const catalog = JSON.parse(readFileSync(join(ROOT, "data", "build", "flag_catalog.json"), "utf8"));
  const flagById = Object.fromEntries(catalog.flags.map((f) => [f.id, f]));
  const manifest = JSON.parse(readFileSync(join(ROOT, "data", "cache", "manifest.json"), "utf8"));
  const gathered = Object.values(manifest)
    .map((m) => (m.fetched_at || "").slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();

  // Department names as printed, keyed by lower-case name, per year
  const deptSummary = q("SELECT * FROM dept_summary WHERE kind='actual'");
  const programs = q("SELECT * FROM programs");
  const nameFix = new Map();
  for (const p of programs) nameFix.set(p.department.toLowerCase(), p.department);
  const pretty = (d) => nameFix.get(d.toLowerCase()) || d.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/\bOf\b/g, "of");

  const years = [...new Set(deptSummary.map((r) => r.fiscal_year))].sort();
  const deptYear = {}; // fy -> [{name, gross, current, capital, page, url}]
  for (const fy of years) {
    const m = new Map();
    for (const r of deptSummary.filter((x) => x.fiscal_year === fy)) {
      const name = pretty(r.department);
      const d = m.get(name) || { name, gross: 0, current: 0, capital: 0, pages: new Set(), url: r.source_url, file: r.source_file };
      d.gross += r.gross || 0;
      d[r.account === "CURRENT" ? "current" : "capital"] += r.gross || 0;
      d.pages.add(r.page);
      m.set(name, d);
    }
    deptYear[fy] = [...m.values()].sort((a, b) => b.gross - a.gross);
  }

  const flagRows = q("SELECT * FROM flags");
  const itemFlags = new Map();
  for (const f of flagRows) if (f.item_id) (itemFlags.get(f.item_id) || itemFlags.set(f.item_id, []).get(f.item_id)).push(f.flag);
  const flagSummary = Object.fromEntries(q("SELECT * FROM flag_summary").map((r) => [r.flag, r]));
  const issues = q("SELECT * FROM publisher_issues");

  return { db, q, one, stats, datasets, federal, matching, catalog, flagById, manifest, gathered, deptSummary, programs, years, deptYear, flagRows, itemFlags, flagSummary, issues, pretty, keyHash, slug };
}

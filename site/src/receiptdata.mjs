// Figures for the home page and the personal receipt, computed once at build time.
import { num } from "../lib/format.mjs";

// Which provincial public bodies (as named in the award reports) belong to a department.
export function bodyKeysFor(D, deptName) {
  const want = D.slug(deptName.replace(/^Department of /i, ""));
  const keys = new Set();
  for (const r of D.q("SELECT DISTINCT buyer, buyer_key FROM items WHERE dataset='ppa'")) {
    const s = D.slug(r.buyer.replace(/^Department of /i, ""));
    if (s === want) keys.add(r.buyer_key);
  }
  return [...keys];
}

export function buildReceiptData(D) {
  const actualYears = D.years;
  const fy = actualYears[actualYears.length - 1];
  const [y0] = fy.split("-").map(Number);
  const from = `${y0}-04-01`;
  const to = `${y0 + 1}-03-31`;
  const depts = D.deptYear[fy];
  const total = depts.reduce((s, d) => s + d.gross, 0);
  const pages = [...new Set(depts.flatMap((d) => [...d.pages]))].sort((a, b) => a - b);

  const departments = depts.map((d) => {
    const original = D.one(
      "SELECT sum(col3) v FROM programs WHERE fiscal_year=? AND kind='actual' AND line_type='object' AND lower(department)=lower(?)",
      fy, d.name
    ).v;
    const examples = [];
    const keys = bodyKeysFor(D, d.name);
    if (keys.length) {
      const rows = D.q(
        `SELECT id, supplier, description, amount, date, buyer FROM items WHERE dataset='ppa' AND amount > 0 AND date BETWEEN ? AND ?
         AND buyer_key IN (${keys.map(() => "?").join(",")}) ORDER BY amount DESC LIMIT 2`,
        from, to, ...keys
      );
      for (const r of rows) examples.push({ title: `${r.supplier}: ${r.description}`.slice(0, 140), amount: r.amount, href: `/item/${r.id.split("-").pop()}/` });
    }
    const prog = D.one(
      "SELECT program, sum(col1) v FROM programs WHERE fiscal_year=? AND kind='actual' AND line_type='object' AND lower(department)=lower(?) GROUP BY program ORDER BY v DESC LIMIT 1",
      fy, d.name
    );
    if (prog) examples.push({ title: `${d.name === "Consolidated Fund Services" && /Debentures|Treasury Bills|Borrowings/.test(prog.program) ? `Interest on ${prog.program.toLowerCase()}` : prog.program} (the department's largest program)`, amount: prog.v, href: `/department/${D.slug(d.name)}/#programs` });
    return { name: d.name, slug: D.slug(d.name), gross: d.gross, original, share: d.gross / total, examples };
  });

  // Four real items for "what a working life buys", largest first
  const timeExamples = [];
  const bigAward = D.one(
    "SELECT * FROM items WHERE dataset='ppa' AND method='Sole source' AND date BETWEEN ? AND ? ORDER BY amount DESC LIMIT 1", from, to);
  if (bigAward) timeExamples.push({ title: bigAward.supplier, amount: bigAward.amount, what: `${bigAward.buyer} awarded this without competition (only one source available): ${bigAward.description}.`, href: `/item/${bigAward.id.split("-").pop()}/`, url: bigAward.source_url, page: bigAward.page, locator: bigAward.locator });
  const rent = D.one("SELECT sum(amount) amount, count(DISTINCT person) people, min(source_url) source_url, min(page) page FROM items WHERE dataset='mha' AND method LIKE '%Office Accommodations%' AND fiscal_year=?", fy);
  if (rent?.amount) timeExamples.push({ title: `MHA constituency office rent, ${fy}`, amount: rent.amount, what: `Rent for constituency offices, the ${rent.people} members whose reports show office rent that year, added together.`, href: `/members/`, url: rent.source_url, page: rent.page, locator: "office accommodations section (one member's report shown)" });
  const lastMin = D.one("SELECT max(json_extract(extra,'$.period')) p FROM items WHERE dataset='minister'").p;
  const trav = D.one("SELECT sum(amount) amount, count(*) n, count(DISTINCT person) people FROM items WHERE dataset='minister' AND method LIKE 'Travel%' AND json_extract(extra,'$.period')=?", lastMin);
  if (trav?.amount) timeExamples.push({ title: `Ministers' travel and expense claims, ${lastMin.replace(" to ", " to ").replace(/(\d{4})-(\d{2})-\d{2}/g, "$1-$2")}`, amount: trav.amount, what: `${trav.n} claims by ${trav.people} ministers in one six-month reporting period, car allowances not included.`, href: "/members/", url: "https://www.gov.nl.ca/exec/cabinet/expenseclaims/", page: null, locator: "one PDF per minister" });
  const lastPay = D.one("SELECT max(fiscal_year) y FROM items WHERE dataset='sunshine'").y;
  const nurseN = D.one("SELECT count(*) n FROM items WHERE dataset='sunshine' AND description LIKE 'Registered Nurse%' AND fiscal_year=?", lastPay).n;
  const nurse = D.one("SELECT * FROM items WHERE dataset='sunshine' AND description LIKE 'Registered Nurse%' AND fiscal_year=? ORDER BY amount LIMIT 1 OFFSET ?", lastPay, Math.floor(nurseN / 2));
  if (nurse) timeExamples.push({ title: `The middle registered nurse on the over-$100,000 list, ${lastPay.replace("calendar ", "")}`, amount: nurse.amount, what: `The middle of the ${num(nurseN)} registered nurses paid over $100,000 in ${lastPay.replace("calendar ", "")}, overtime included, as published by ${nurse.buyer}.`, href: `/pay/${D.slug(nurse.buyer)}/`, url: nurse.source_url, page: null, locator: nurse.locator });
  timeExamples.sort((a, b) => b.amount - a.amount);

  const lv = (sets) => D.one(`SELECT sum(amount) v FROM items WHERE dataset IN (${sets.map((s) => `'${s}'`).join(",")})`).v || 0;
  const levels = [
    { level: "provincial", label: "Provincial awards, expense claims and pay", amount: lv(["ppa", "minister", "mha", "sunshine"]) },
    { level: "federal", label: "Federal contracts and grants to NL", amount: lv(["fed_contract", "fed_grant"]) },
    { level: "municipal", label: "Municipal payments", amount: lv(["paradise", "stjohns"]) },
  ].filter((l) => l.amount);

  const top = D.q(`SELECT supplier_key, sum(amount) amount, group_concat(DISTINCT dataset) ds, count(*) n FROM items
      WHERE supplier_key IS NOT NULL AND supplier_key != '' AND dataset IN ('ppa','fed_contract','fed_grant','paradise')
      GROUP BY supplier_key ORDER BY amount DESC LIMIT 10`);
  const labels = { ppa: "provincial awards", fed_contract: "federal contracts", fed_grant: "federal grants", paradise: "Paradise payments" };
  const topRecipients = top.map((r) => {
    const name = D.one("SELECT supplier, count(*) c FROM items WHERE supplier_key=? GROUP BY supplier ORDER BY c DESC LIMIT 1", r.supplier_key).supplier;
    return { name, amount: r.amount, href: `/supplier/${D.keyHash(r.supplier_key)}/`, sources: r.ds.split(",").map((x) => labels[x]).join(", ") };
  });

  const checks = D.one("SELECT sum(ok) ok, count(*) n FROM dept_summary");
  const broken = D.issues.filter((i) => /404|web page/.test(i.issue)).length;
  const late = D.flagSummary["late-publication"]?.items || 0;
  const badDates = D.flagSummary["date-check"]?.items || 0;
  const reportCard = [
    { label: "Line items loaded", value: num(D.one("SELECT count(*) n FROM items").n) },
    { label: "Department totals matched to the printed statement", value: `${checks.ok} of ${checks.n}` },
    { label: "Minister and MHA reports adding up to their printed totals", value: "all" },
    { label: "Links on government pages that lead nowhere", value: num(broken) },
    { label: "Provincial awards reported more than 90 days late", value: num(late) },
    { label: "Award dates printed that cannot be right", value: num(badDates) },
  ];

  return {
    year: fy, total, source: { url: depts[0].url, file: depts[0].file, pages },
    departments, tax: D.stats.nl_tax, timeExamples, levels, topRecipients, reportCard,
    suggestions: ["ferry", "snow clearing", "consulting", "legal services", "helicopter", "software licence", "catering"],
    itemCount: D.one("SELECT count(*) n FROM items").n,
  };
}

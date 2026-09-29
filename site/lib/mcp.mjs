// Read-only MCP server (Model Context Protocol, streamable HTTP transport, JSON responses).
// Served by the site's Worker at /mcp (routes/mcp.js).
// `io` supplies: db (D1), json(path) -> fetches one of the site's /data files.
import { search, getItem, sha10 } from "./search.mjs";
import { SITE, money, moneyWords, workTime, perPerson, perHousehold, DATASET_LABEL } from "./format.mjs";

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS = `NL Ledger: public spending records for Newfoundland and Labrador. It covers provincial contract awards, minister and MHA expenses, public sector pay over $100,000, department and program spending, federal contracts, grants and transfers in the province, and municipal payments from Paradise and a St. John's sample.

Rules for answers:
- Answer only from tool results. If the records do not answer the question, say so.
- Cite every figure. Each record has source_url, locator and page_url. Give the source link with each figure.
- Tell the user once per conversation: automated scripts gathered and combined these figures from public records, and nobody has independently vetted them. The user should open the source before relying on a figure.
- Patterns ("flags") are questions, not findings. Never call a flagged record wrongdoing, waste or corruption.
- Amounts are in Canadian dollars. Contract and grant values can span several years.

How to start: use search_records for words or names, get_supplier for one company or recipient, get_department for provincial budgets, get_members to compare MHA or minister expenses, list_flags for patterns, human_scale to make an amount easy to picture.`;

const PAGE = 25;
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const SOURCE_IDS = Object.keys(DATASET_LABEL);
const SOURCE_HELP = SOURCE_IDS.map((k) => `${k} = ${DATASET_LABEL[k]}`).join("; ");

export const TOOLS = [
  {
    name: "search_records",
    title: "Search spending records",
    description: `Search every line item: contract awards, federal contracts and grants, minister and MHA expense lines, pay over $100,000, and municipal payments. Every word must match; words match by prefix. Give a query, a filter, or both. Returns up to ${PAGE} records per page, largest amount first (use page for more), each with its source citation. Sources: ${SOURCE_HELP}.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to find, e.g. 'ferry repair', a company name, a town or a job title." },
        source: { type: "string", enum: SOURCE_IDS, description: "Limit to one source." },
        year: { type: "string", pattern: "^\\d{4}$", description: "Calendar year of the record date, e.g. 2024." },
        pattern: { type: "string", description: "Flag id from list_flags, e.g. no-competition." },
        supplier_id: { type: "string", description: "Supplier id from get_supplier." },
        page: { type: "integer", minimum: 1, maximum: 20, description: "Page number. Default 1." },
      },
    },
    annotations: { title: "Search spending records", ...READ_ONLY },
  },
  {
    name: "get_record",
    title: "Get one record",
    description: "Get one line item by its 12-character id (from search_records). Returns every published field, the source file with page or row, and the amount per resident and as time to earn.",
    inputSchema: { type: "object", properties: { id: { type: "string", pattern: "^[0-9a-fA-F]{12}$", description: "Record id, e.g. 2ebb7ad3bd29." } }, required: ["id"] },
    annotations: { title: "Get one record", ...READ_ONLY },
  },
  {
    name: "get_supplier",
    title: "Get a supplier or recipient",
    description: "Get everything one supplier or recipient received from provincial, federal and municipal sources: totals by source, year and buyer, flags, and the largest records. Give a name or a supplier_id. If the name does not match exactly, the result lists close matches with their ids.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Company or recipient name, e.g. 'Pennecon'." }, supplier_id: { type: "string", description: "10-character id from an earlier result." } } },
    annotations: { title: "Get a supplier or recipient", ...READ_ONLY },
  },
  {
    name: "get_department",
    title: "Get a provincial department's spending",
    description: "Get a provincial department's gross spending by program: actual against amended and original estimates, for a fiscal year from 2019-20 to 2024-25, or the 2026-27 estimates. Leave out name to list the departments and years.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Department name or part of it, e.g. 'Health'." }, year: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "Fiscal year, e.g. 2024-25 or 2026-27. Default: the latest year with actual spending." } } },
    annotations: { title: "Get a provincial department's spending", ...READ_ONLY },
  },
  {
    name: "get_members",
    title: "Compare MHA and minister expenses",
    description: "Rank Members of the House of Assembly by allowance spending for a fiscal year, overall or for one category (for example travel), with the average. Give a name to get one member's spending by year and category. Set group to ministers for ministers' expense claim totals.",
    inputSchema: { type: "object", properties: {
      group: { type: "string", enum: ["mha", "ministers"], description: "Default mha." },
      year: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "MHA fiscal year, e.g. 2024-25. Default: the latest full year." },
      category: { type: "string", description: "Words in the category name, e.g. 'travel', 'office', 'constituency'." },
      name: { type: "string", description: "Part of a member's name." },
    } },
    annotations: { title: "Compare MHA and minister expenses", ...READ_ONLY },
  },
  {
    name: "list_flags",
    title: "List spending patterns",
    description: "List the patterns people read as waste or perks (for example sole-source awards, contracts that grew, purchases just under a limit), with counts. Each pattern is a question, not a finding.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "List spending patterns", ...READ_ONLY },
  },
  {
    name: "get_flag",
    title: "Get one spending pattern",
    description: "Get one pattern by id (from list_flags): why people look at it, exactly how it is computed, what it cannot tell you, and its largest results.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Pattern id, e.g. no-competition." } }, required: ["id"] },
    annotations: { title: "Get one spending pattern", ...READ_ONLY },
  },
  {
    name: "human_scale",
    title: "Put an amount in human terms",
    description: "Express a dollar amount per resident, per household, and as time to earn at the Newfoundland and Labrador median full-time wage. Includes the Statistics Canada sources.",
    inputSchema: { type: "object", properties: { amount: { type: "number", minimum: 0, description: "Amount in Canadian dollars, e.g. 50000000." } }, required: ["amount"] },
    annotations: { title: "Put an amount in human terms", ...READ_ONLY },
  },
  {
    name: "search",
    title: "Search (for ChatGPT deep research)",
    description: "Search the records and return a short list of results, each with id, title and url. Use fetch with an id to get the full record. Prefer search_records when you can pass filters.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to find." } }, required: ["query"] },
    annotations: { title: "Search", ...READ_ONLY },
  },
  {
    name: "fetch",
    title: "Fetch one record (for ChatGPT deep research)",
    description: "Fetch the full text of one result from search, by id.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Id from search." } }, required: ["id"] },
    annotations: { title: "Fetch", ...READ_ONLY },
  },
];

// Starter questions, offered to clients that show MCP prompts (for example as slash commands).
export const PROMPTS = [
  { name: "no_open_call", title: "Awards without an open call", description: "What the province awarded without an open call in a year, and to whom.", arguments: [{ name: "year", description: "Calendar year, e.g. 2025", required: false }],
    text: (a) => `Using NL Ledger, what did Newfoundland and Labrador public bodies award without an open call in ${a.year || "the most recent full year"}? List the largest awards with buyer, supplier and amount, and cite the source of each.` },
  { name: "follow_the_money", title: "Follow one company's money", description: "Everything one company or group received, from every level of government.", arguments: [{ name: "name", description: "Company or recipient name", required: true }],
    text: (a) => `Using NL Ledger, show everything ${a.name || "this company"} received from provincial, federal and municipal governments, by source and year. Cite the largest records.` },
  { name: "mha_travel", title: "MHA travel", description: "How MHA travel spending compares across members.", arguments: [],
    text: () => "Using NL Ledger, which MHAs charged the most travel to their allowances in 2024-25, and how does that compare with the average member? Cite the reports." },
  { name: "make_it_human", title: "Make an amount human", description: "Turn any amount into per person, per household and time to earn.", arguments: [{ name: "amount", description: "Amount in dollars", required: true }],
    text: (a) => `Using NL Ledger, what is ${a.amount || "$50 million"} per person and per household in Newfoundland and Labrador, and how long would someone on the median wage work to earn it?` },
];

// ---- discovery: MCP registry server.json and the (draft) MCP server card
export const REGISTRY_NAME = "ca.nlledger/nl-ledger";
const DESCRIPTION = "Read-only public spending records for Newfoundland and Labrador, each with its source.";
export const SERVER_VERSION = "0.2.1";
// The logo, for clients that show one beside the server's name (icons in server info, server.json and the server card).
export const ICONS = () => [
  { src: `${SITE.url}/nl-ledger-icon-256.png`, mimeType: "image/png", sizes: ["256x256"] },
  { src: `${SITE.url}/app-icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
];

export function serverJson() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: REGISTRY_NAME,
    title: SITE.name,
    description: DESCRIPTION,
    version: SERVER_VERSION,
    websiteUrl: `${SITE.url}/data/`,
    icons: ICONS(),
    remotes: [{ type: "streamable-http", url: `${SITE.url}/mcp` }],
  };
}

export function serverCard() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: REGISTRY_NAME,
    title: SITE.name,
    description: DESCRIPTION,
    version: SERVER_VERSION,
    websiteUrl: `${SITE.url}/data/`,
    icons: ICONS(),
    remotes: [{ type: "streamable-http", url: `${SITE.url}/mcp`, supportedProtocolVersions: PROTOCOLS }],
  };
}

export function aiCatalog() {
  return {
    specVersion: "1.0",
    entries: [{ identifier: `urn:air:${new URL(SITE.url).host}:mcp:nl-ledger`, type: "application/mcp-server-card+json", url: `${SITE.url}/mcp/server-card` }],
  };
}

// Same normalisation as pipeline/common.py entity_key (tests/test_names.py checks they agree).
const TAIL = /\s*[,(-]?\s*\b(o\/a|o\.a\.|operating as|c\/o|care of|dba|d\/b\/a|doing business as|t\/a|trading as|carrying on business as|formerly|previously|now known as)\b.*$/i;
const SUFFIX = /\b(incorporated|inc|ltd|limited|corp|corporation|co|company|llc|lp|llp|plc|ulc|partnership|ltee|ltée|l\.?t\.?d|the)\b\.?/g;
export function entityKey(name) {
  let s = String(name || "").replace(/\s+/g, " ").trim().replace(/[\u2018\u2019`]/g, "'");
  s = s.replace(TAIL, "") || s;
  s = s.replace(/\s(and|&)\s+(co|company)\b\.?/gi, " ");
  s = s.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase();
  s = s.replace(/'/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim().replace(/\s(l td|limit ed|limite d|limi ted|lim ited|inc orporated)$/, "");
  if (String(name || "").length >= 33) s = s.replace(/\s(limite|limit|limi|lim|lt|incorp|incorpor|incorporat|corporat)$/, "");
  s = s.replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
  return s.replace(/\bn l\b|\bnl\b/g, "newfoundland and labrador").replace(/\bnfld\b/g, "newfoundland");
}

// Drop empty fields so every answer stays small enough for any client's context.
function compact(o) {
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined || (Array.isArray(o[k]) && !o[k].length)) delete o[k];
  return o;
}

function cite(it) {
  const pdf = /\.pdf($|\?)/i.test(it.u || "");
  return compact({
    id: it.i,
    source: DATASET_LABEL[it.ds] || it.ds,
    level: it.lv,
    buyer: it.b || null,
    supplier: it.s || null,
    supplier_id: it.k || null,
    person: it.p || null,
    description: it.d || null,
    amount_cad: it.a ?? null,
    amount_original: it.o ? { value: it.o, currency: it.c || "USD" } : undefined,
    date: it.t || it.fy || null,
    method: it.m || null,
    flags: it.f || [],
    details: it.x || undefined,
    source_url: pdf && it.g ? `${it.u}#page=${it.g}` : it.u,
    locator: it.l,
    page_url: `${SITE.url}/item/${it.i}/`,
  });
}

const CAUTION = "Figures come from public records, gathered by automated scripts, and have not been independently vetted. Open source_url before relying on a figure.";

// A tool-level error the model can act on: what went wrong and what to try.
function problem(error, extra = {}) {
  return { error, ...extra };
}

async function call(name, args, io) {
  const stats = await io.json("/data/stats.json");
  switch (name) {
    case "search_records": {
      const q = String(args.query || "").trim();
      if (!q && !args.source && !args.year && !args.pattern && !args.supplier_id) return problem("Give a query or at least one filter (source, year, pattern or supplier_id).");
      if (args.source && !SOURCE_IDS.includes(args.source)) return problem(`Unknown source "${args.source}".`, { sources: DATASET_LABEL });
      // One window of matching documents, flattened to line items and sorted once; pages slice that list.
      const r = await search(io.db, { q, ds: args.source, y: args.year, f: args.pattern, s: args.supplier_id }, { limit: 40, order: "amount" });
      const all = r.items.sort((a, b) => (b.a || 0) - (a.a || 0));
      const page = Math.min(20, Math.max(1, Math.floor(Number(args.page) || 1)));
      const items = all.slice((page - 1) * PAGE, page * PAGE).map(cite);
      if (!all.length) return { records: [], note: "Nothing matched. Try fewer or shorter words, or drop a filter. Names match by the start of each word." };
      if (!items.length) return { records: [], note: `Page ${page} is past the end. There are ${all.length} records in ${Math.ceil(all.length / PAGE)} pages.` };
      const more = all.length > page * PAGE;
      return {
        records_found: all.length,
        page,
        pages: Math.ceil(all.length / PAGE),
        next_page: more ? page + 1 : undefined,
        truncated: r.more ? "More records match than one search returns. These are the largest; add words or a filter (source, year) to see smaller ones." : undefined,
        caution: CAUTION,
        records: items,
        search_page_url: `${SITE.url}/search/?${new URLSearchParams(Object.entries({ q, ds: args.source, y: args.year, f: args.pattern, s: args.supplier_id }).filter(([, v]) => v))}`,
      };
    }
    case "get_record": {
      const id = String(args.id || "").trim().toLowerCase();
      if (!/^[0-9a-f]{12}$/.test(id)) return problem("A record id is 12 characters, 0-9 and a-f. Get ids from search_records.");
      const it = await getItem(io.db, id);
      if (!it) return problem("No record with that id. Get ids from search_records.");
      const out = cite(it);
      if (it.a) out.human_scale = scale(it.a, stats);
      out.caution = CAUTION;
      return out;
    }
    case "get_supplier": {
      let h = String(args.supplier_id || "").trim().toLowerCase();
      const nm = String(args.name || "").trim();
      if (!h && nm) h = await sha10(entityKey(nm));
      if (!h || !/^[0-9a-f]{10}$/.test(h)) return problem("Give a supplier name or a 10-character supplier_id.");
      const shardOf = (x) => io.json(`/data/s/${parseInt(x.slice(0, 4), 16) % 512}.json`);
      let s = (await shardOf(h))?.[h];
      // A name the supplier is also printed under points to the supplier.
      if (s?.to) {
        h = s.to;
        s = (await shardOf(h))?.[h];
      }
      if (!s) {
        if (!nm) return problem("No supplier with that id.");
        // Offer close matches: suppliers whose records contain every word of the name.
        const r = await search(io.db, { q: nm }, { limit: 20 });
        const seen = new Map();
        for (const it of r.items) if (it.s && it.k && !seen.has(it.k)) seen.set(it.k, { supplier_id: it.k, name: it.s, source: DATASET_LABEL[it.ds] || it.ds });
        const want = entityKey(nm).split(" ").filter(Boolean);
        const named = [...seen.values()].filter((m) => want.every((w) => entityKey(m.name).split(" ").some((x) => x.startsWith(w))));
        const matches = named.slice(0, 12);
        return problem(`No supplier is named exactly "${nm}".`, matches.length ? { close_matches: matches, next_step: "Call get_supplier with one of these supplier_id values." } : { next_step: "Try search_records with part of the name." });
      }
      return {
        supplier_id: h, name: s.name, total_cad: s.total, records: s.n,
        also_printed_as: s.combined ? s.combined.map((c) => c.t).filter((t) => t !== s.name) : s.names?.filter((t) => t !== s.name),
        names_matched_how: s.combined ? `${SITE.url}/method/suppliers/` : undefined,
        by_source: Object.fromEntries(Object.entries(s.byDs).map(([k, [n, a]]) => [DATASET_LABEL[k] || k, { records: n, total_cad: a }])),
        by_year: s.byYear, buyers: s.buyers, flags: s.flags,
        largest_records: s.top.slice(0, 20).map((it) => cite({ ...it, s: s.name })),
        page_url: `${SITE.url}/supplier/${h}/`,
        human_scale: scale(s.total, stats),
        caution: CAUTION,
      };
    }
    case "get_department": {
      const d = await io.json("/data/departments.json");
      if (!args.name) return { departments: Object.keys(d.departments), years: d.years };
      const want = String(args.name).toLowerCase();
      const key = Object.keys(d.departments).find((k) => k.toLowerCase() === want)
        || Object.keys(d.departments).find((k) => k.toLowerCase().includes(want));
      if (!key) return problem("No department by that name.", { departments: Object.keys(d.departments) });
      const dep = d.departments[key];
      const year = args.year || Object.keys(dep).sort().filter((y) => !dep[y].estimates).pop() || Object.keys(dep).sort().pop();
      const y = dep[year];
      if (!y) return problem(`No figures for ${year}.`, { years: Object.keys(dep) });
      return { department: key, fiscal_year: year, ...y, page_url: `${SITE.url}/department/${y.slug}/` };
    }
    case "get_members": {
      const M = await io.json("/data/members.json");
      if (!M) return problem("Member data is not available right now.");
      const abs = (u) => `${SITE.url}${u}`;
      if (args.group === "ministers") {
        const list = M.ministers.filter((m) => !args.name || m.name.toLowerCase().includes(String(args.name).toLowerCase()));
        return { source: M.minister_source, ministers: list.map((m) => ({ ...m, page_url: abs(m.page_url) })), caution: CAUTION };
      }
      if (args.name) {
        const want = String(args.name).toLowerCase();
        const hits = Object.entries(M.mha).filter(([n]) => n.toLowerCase().includes(want)).slice(0, 5);
        if (!hits.length) return problem("No MHA by that name.", { members: Object.keys(M.mha) });
        return { source: M.mha_source, members: hits.map(([n, m]) => ({ name: n, district: m.district, years: m.years, page_url: abs(m.page_url) })), caution: CAUTION };
      }
      const year = args.year || M.mha_years[M.mha_years.length - 2] || M.mha_years[M.mha_years.length - 1];
      if (!M.mha_years.includes(year)) return problem(`No MHA reports for ${year}.`, { years: M.mha_years });
      const cat = String(args.category || "").toLowerCase().trim();
      const rows = [];
      const cats = new Set();
      for (const [n, m] of Object.entries(M.mha)) {
        const y = m.years[year];
        if (!y) continue;
        let amt = y.total;
        if (cat) {
          const keys = Object.keys(y.by_category).filter((k) => k.toLowerCase().includes(cat));
          keys.forEach((k) => cats.add(k));
          amt = keys.reduce((t, k) => t + y.by_category[k], 0);
        }
        rows.push({ name: n, district: m.district, amount_cad: Math.round(amt * 100) / 100, page_url: abs(m.page_url) });
      }
      if (cat && !cats.size) {
        const all = new Set(Object.values(M.mha).flatMap((m) => Object.values(m.years).flatMap((y) => Object.keys(y.by_category))));
        return problem(`No category matches "${args.category}".`, { categories: [...all] });
      }
      rows.sort((a, b) => b.amount_cad - a.amount_cad);
      const avg = rows.reduce((t, r) => t + r.amount_cad, 0) / (rows.length || 1);
      return {
        source: M.mha_source, fiscal_year: year, categories: cat ? [...cats] : "all allowances", members: rows.length,
        average_cad: Math.round(avg * 100) / 100,
        note: "Members who served part of the year, or who are ministers or party leaders with other budgets, spend less from these allowances. This is not a ranking of thrift.",
        ranking: rows, caution: CAUTION,
      };
    }
    case "list_flags": {
      const f = await io.json("/data/flags.json");
      const r = await io.json("/data/flag_results.json");
      return { caveat: f.caveat, flags: f.flags.map((x) => ({ id: x.id, title: x.title, short: x.short, count: r[x.id]?.count })) };
    }
    case "get_flag": {
      const f = await io.json("/data/flags.json");
      const r = await io.json("/data/flag_results.json");
      const x = f.flags.find((x) => x.id === args.id);
      if (!x) return problem("Unknown pattern id.", { ids: f.flags.map((x) => x.id) });
      return { ...x, caveat: f.caveat, results: r[x.id], page_url: `${SITE.url}/flags/${x.id}/`, method_url: `${SITE.url}/method/${x.id}/` };
    }
    case "human_scale": {
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount < 0) return problem("amount must be a number of dollars, 0 or more, e.g. 50000000.");
      return scale(amount, stats);
    }
    // OpenAI's search/fetch shape, used by ChatGPT deep research and company knowledge.
    case "search": {
      const q = String(args.query || "").trim();
      if (!q) return { results: [] };
      const r = await search(io.db, { q }, { limit: 20 });
      return {
        results: r.items.sort((a, b) => (b.a || 0) - (a.a || 0)).slice(0, PAGE).map((it) => ({
          id: it.i,
          title: [it.s || it.p, it.d, it.a != null ? money(it.a) : null, it.t || it.fy].filter(Boolean).join(" · "),
          url: `${SITE.url}/item/${it.i}/`,
        })),
      };
    }
    case "fetch": {
      const id = String(args.id || "").trim().toLowerCase();
      const it = /^[0-9a-f]{12}$/.test(id) ? await getItem(io.db, id) : null;
      if (!it) return problem("No record with that id.");
      const c = cite(it);
      return {
        id: it.i,
        title: [it.s || it.p, it.d].filter(Boolean).join(" · ") || c.source,
        text: JSON.stringify({ ...c, human_scale: it.a ? scale(it.a, stats) : undefined, caution: CAUTION }, null, 1),
        url: c.page_url,
        metadata: { source: c.source, source_url: c.source_url, locator: c.locator },
      };
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}. Call tools/list for the tool names.`), { code: -32602 });
  }
}

function scale(amount, stats) {
  return {
    amount: money(amount),
    in_words: moneyWords(amount),
    per_resident: money(perPerson(amount, stats), { cents: true }),
    per_household: money(perHousehold(amount, stats), { cents: true }),
    time_to_earn_at_median_wage: workTime(amount, stats),
    basis: {
      population: `${stats.population.value} (Statistics Canada table ${stats.population.table}, ${stats.population.date})`,
      households: `${stats.households.value} (Statistics Canada table ${stats.households.table}, 2021 Census)`,
      median_full_time_wage: `${money(stats.median_annual_wage.value)} a year (table ${stats.median_weekly_wage.table}, vector ${stats.median_weekly_wage.vector}, ${stats.median_weekly_wage.year}, weekly x 52)`,
    },
  };
}

// Any origin may call this read-only server from a browser.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id, authorization",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

function reply(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, "cache-control": "no-store", ...(body === null ? {} : { "content-type": "application/json" }) },
  });
}

const ABOUT = `${SITE.name} MCP server: read-only public spending records for Newfoundland and Labrador. No sign-in.

Address: ${SITE.url}/mcp (streamable HTTP; POST JSON-RPC here)
How to connect your AI assistant: ${SITE.url}/data/
Tools: ${TOOLS.map((t) => t.name).join(", ")}
`;

export async function handleMcp(request, io) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method === "GET") {
    const accept = request.headers.get("accept") || "";
    // No server-initiated stream: every answer comes back on the POST.
    if (accept.includes("text/event-stream")) return new Response(null, { status: 405, headers: { ...CORS, allow: "POST, DELETE, OPTIONS" } });
    return new Response(ABOUT, { headers: { ...CORS, "content-type": "text/plain; charset=utf-8" } });
  }
  if (request.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...CORS, allow: "GET, POST, DELETE, OPTIONS" } });
  let msg;
  try {
    msg = await request.json();
  } catch {
    return reply({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: the body must be JSON-RPC 2.0." } }, 400);
  }
  if (Array.isArray(msg)) {
    if (!msg.length) return reply({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request: empty batch." } }, 400);
    const out = (await Promise.all(msg.map((m) => one(m, io)))).filter(Boolean);
    return out.length ? reply(out) : reply(null, 202);
  }
  const res = await one(msg, io);
  return res ? reply(res) : reply(null, 202);
}

async function one(msg, io) {
  if (!msg || typeof msg !== "object") return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request." } };
  const { id, method, params = {} } = msg;
  if (id === undefined || id === null) return null; // notification or response: nothing to send back
  if (typeof method !== "string") return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid request: method is missing." } };
  try {
    if (method === "initialize") {
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return { jsonrpc: "2.0", id, result: {
        protocolVersion: v,
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "nl-ledger", title: SITE.name, version: SERVER_VERSION, websiteUrl: `${SITE.url}/data/`, icons: ICONS() },
        instructions: INSTRUCTIONS,
      } };
    }
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (method === "tools/call") {
      const out = await call(params.name, params.arguments || {}, io);
      const isError = !!out?.error;
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out, isError } };
    }
    if (method === "prompts/list") return { jsonrpc: "2.0", id, result: { prompts: PROMPTS.map(({ text, ...p }) => p) } };
    if (method === "prompts/get") {
      const p = PROMPTS.find((x) => x.name === params.name);
      if (!p) return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown prompt: ${params.name}` } };
      return { jsonrpc: "2.0", id, result: { description: p.description, messages: [{ role: "user", content: { type: "text", text: p.text(params.arguments || {}) } }] } };
    }
    if (method === "resources/list") return { jsonrpc: "2.0", id, result: { resources: [] } };
    if (method === "resources/templates/list") return { jsonrpc: "2.0", id, result: { resourceTemplates: [] } };
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (e) {
    return { jsonrpc: "2.0", id, error: { code: e.code || -32603, message: String(e.message || e) } };
  }
}

// JSON the MCP server reads: department programs by year, and each flag's top results.
export function departmentsJSON(D) {
  const out = { years: [], departments: {} };
  const rows = D.q(`SELECT fiscal_year, kind, department, program_code, program, account, sum(col1) c1, sum(col2) c2, sum(col3) c3, min(page) page, source_url
    FROM programs WHERE line_type='object' GROUP BY fiscal_year, kind, department, program_code, program, account ORDER BY program_code`);
  for (const r of rows) {
    const dep = (out.departments[r.department] ||= {});
    const y = (dep[r.fiscal_year] ||= {
      estimates: r.kind === "estimates",
      columns: r.kind === "estimates" ? ["estimate", "revised_prior_year", "budget_prior_year"] : ["actual", "amended_estimate", "original_estimate"],
      source_url: r.source_url, slug: D.slug(r.department), gross: [0, 0, 0], programs: [],
    });
    y.gross[0] += r.c1; y.gross[1] += r.c2; y.gross[2] += r.c3;
    y.programs.push({ code: r.program_code, program: r.program, account: r.account.toLowerCase(), values: [r.c1, r.c2, r.c3], page: r.page, source: `${r.source_url}#page=${r.page}` });
  }
  out.years = [...new Set(rows.map((r) => r.fiscal_year))].sort();
  return out;
}

export function flagResultsJSON(D) {
  const out = {};
  for (const f of D.catalog.flags) {
    const s = D.flagSummary[f.id] || {};
    const subjects = D.flagRows.filter((r) => r.flag === f.id && !r.item_id).sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 25)
      .map((r) => ({ subject: r.subject, value: r.value, detail: JSON.parse(r.detail || "{}") }));
    const ids = D.flagRows.filter((r) => r.flag === f.id && r.item_id).map((r) => r.item_id);
    const items = ids.length ? D.q(`SELECT id, dataset, buyer, supplier, person, description, amount, date, source_url, page, locator FROM items WHERE id IN (${ids.slice(0, 3000).map(() => "?").join(",")}) ORDER BY amount DESC LIMIT 25`, ...ids.slice(0, 3000))
      .map((i) => ({ id: i.id.split("-").pop(), dataset: i.dataset, buyer: i.buyer, supplier: i.supplier || i.person, description: i.description, amount: i.amount, date: i.date, source_url: i.page && /\.pdf/i.test(i.source_url) ? `${i.source_url}#page=${i.page}` : i.source_url, locator: i.locator })) : [];
    out[f.id] = { count: { items: s.items || 0, subjects: s.subjects || 0, amount: s.amount || 0 }, top_subjects: subjects.length ? subjects : undefined, top_items: items.length ? items : undefined, extra: s.detail ? JSON.parse(s.detail) : undefined };
  }
  return out;
}

// MHA allowance spending per member, year and category, and ministers' claim totals: the figures the
// Members pages publish, for questions that compare members.
export function membersJSON(D) {
  const mha = {};
  for (const r of D.q(`SELECT person, json_extract(extra,'$.district') district, fiscal_year y, method cat, count(*) n, sum(amount) a, min(source_url) u
      FROM items WHERE dataset='mha' GROUP BY person, fiscal_year, method`)) {
    const m = (mha[r.person] ||= { district: r.district, page_url: `/mha/${D.slug(r.person)}/`, years: {} });
    const y = (m.years[r.y] ||= { total: 0, lines: 0, by_category: {} });
    y.total += r.a || 0;
    y.lines += r.n;
    y.by_category[r.cat] = Math.round((r.a || 0) * 100) / 100;
  }
  for (const m of Object.values(mha)) for (const y of Object.values(m.years)) y.total = Math.round(y.total * 100) / 100;
  const ministers = D.q(`SELECT person, count(*) claims, sum(amount) a, min(date) d0, max(date) d1 FROM items WHERE dataset='minister' GROUP BY person ORDER BY a DESC`)
    .map((r) => ({ name: r.person, claims: r.claims, total: Math.round(r.a * 100) / 100, from: r.d0, to: r.d1, page_url: `/ministers/${D.slug(r.person)}/` }));
  const years = D.q("SELECT DISTINCT fiscal_year y FROM items WHERE dataset='mha' ORDER BY y").map((r) => r.y);
  return { mha_years: years, mha_source: "House of Assembly, Member Accountability and Disclosure Reports", mha, ministers, minister_source: "Executive Council, ministers' expense claims" };
}

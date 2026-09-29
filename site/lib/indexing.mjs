// What search engines are asked to index. Shared by the build (sitemap) and the Worker routes (robots meta).
// The sitemap lists the pages that can answer a search on their own: departments, MHAs, ministers,
// pay lists, patterns, methods, public bodies and the suppliers with enough on record to be worth a page.
// A record page is one line of one report, so most are left out of the index; the good ones can still
// be indexed when linked from a supplier or body page.

export const SUPPLIER_MIN_RECORDS = 3;
export const SUPPLIER_MIN_TOTAL = 250000;
export const RECORD_MIN_AMOUNT = 25000;
const RECORD_SETS = new Set(["ppa", "fed_contract", "fed_grant", "canadabuys", "pa_pss", "pa_tp"]);

export const supplierIndexable = (s) => s.n >= SUPPLIER_MIN_RECORDS || s.total >= SUPPLIER_MIN_TOTAL;

// A record is indexable when it is a contract, grant or large payment of at least $25,000 with a description that says what
// was bought. Pay lines and expense lines are never indexed on their own: they are one person's or
// one small payment, and the employer, member or supplier page is the useful unit.
export function recordIndexable(it) {
  if (!RECORD_SETS.has(it.ds)) return false;
  if (!(it.a >= RECORD_MIN_AMOUNT)) return false;
  if ((it.f || []).includes("vague-description")) return false;
  return String(it.d || "").trim().length >= 15;
}

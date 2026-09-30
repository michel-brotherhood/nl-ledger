// Number formatting and the human-scale conversions. Shared by the static build,
// the Worker routes and the MCP server, so every surface says the same thing.

export const SITE = {
  name: "NL Ledger",
  tagline: "Where Newfoundland and Labrador's public money goes",
  url: "https://nlledger.ca",
  corrections: "corrections@nlledger.ca",
  // The address a visitor is pointed to when the feedback box cannot take a note.
  contact: "info@nlledger.ca",
};

// A share-card description: whole sentences that fit `max` characters, never cut off with an ellipsis.
// Too long: keep the leading sentences that fit; if even the first is too long, end it at the last clause break.
export function fit(text, max = 155) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const sentences = s.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [];
  let out = "";
  for (const x of sentences) {
    const next = (out + " " + x.trim()).trim();
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = s.slice(0, max);
  const at = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(": "), cut.lastIndexOf("; "));
  const head = at > max * 0.5 ? cut.slice(0, at) : cut.replace(/\s+\S*$/, "");
  return head.replace(/[\s,;:–-]+$/, "") + ".";
}

const nf0 = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(v, { cents = false } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return "n/a";
  const neg = v < 0;
  const s = "$" + (cents ? nf2.format(Math.abs(v)) : nf0.format(Math.round(Math.abs(v))));
  return neg ? `(${s})` : s;
}

// "$10.6 billion", "$459 million", "$45,069"
export function moneyWords(v, digits = 1) {
  if (v === null || v === undefined) return "n/a";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(digits)} billion`;
  if (a >= 1e6) return `$${trim((v / 1e6).toFixed(a >= 1e8 ? 0 : digits))} million`;
  return money(v);
}

// "$10.6B" for tight spaces (axis ticks, chips)
export function moneyShort(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${trim((v / 1e9).toFixed(1))}B`;
  if (a >= 1e6) return `$${trim((v / 1e6).toFixed(a >= 1e8 ? 0 : 1))}M`;
  if (a >= 1e3) return `$${trim((v / 1e3).toFixed(a >= 1e5 ? 0 : 1))}K`;
  return money(v);
}

function trim(s) {
  return s.replace(/\.0$/, "");
}

export function num(v) {
  return nf0.format(v);
}

export function pct(v, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

// Human scale. `stats` is the stats.json written by pipeline/stats.py.
export function perPerson(v, stats) {
  return v / stats.population.value;
}

export function perHousehold(v, stats) {
  return v / stats.households.value;
}

export function yearsOfWage(v, stats) {
  return v / stats.median_annual_wage.value;
}

// "about 3 years and 2 months", "about 6 weeks", "about 4 days", "about 3 hours"
export function workTime(v, stats) {
  const years = yearsOfWage(v, stats);
  const weeks = years * 52;
  if (years >= 100) return `${num(Math.round(years))} years`;
  if (years >= 2) return `${years.toFixed(1).replace(/\.0$/, "")} years`;
  if (weeks >= 8) return `${Math.round(weeks)} weeks`;
  const days = weeks * 5; // working days
  if (days >= 2) return `${Math.round(days)} working days`;
  const hours = days * 7.5;
  if (hours >= 1) return `${Math.round(hours)} working hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `${Math.max(1, Math.round(hours * 60))} working minutes`;
}

export function date(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!m) return String(y);
  const mon = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."][m - 1];
  return day ? `${mon} ${day}, ${y}` : `${mon} ${y}`;
}

export function slug(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Same algorithm as pipeline/common.py key_hash: first n hex chars of sha1.
// Web Crypto is async; the build uses node:crypto directly.
export async function keyHash(s, n = 10) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, n);
}

// Employee CPP and EI for a year of employment income, at the tax year's rates:
// base CPP (a credit), enhanced CPP and CPP2 (deductions from income), EI premiums (a credit).
export function payrollContributions(income, tax) {
  const { cpp, ei } = tax;
  if (!cpp || !ei) return { baseCpp: 0, deduction: 0, ei: 0 };
  const pensionable = Math.min(Math.max(income - cpp.exemption, 0), cpp.ympe - cpp.exemption);
  const second = Math.min(Math.max(income - cpp.ympe, 0), cpp.yampe - cpp.ympe);
  const cents = (x) => Math.round(x * 100) / 100;
  return {
    baseCpp: cents(pensionable * cpp.base_rate),
    deduction: cents(pensionable * cpp.enhanced_rate) + cents(second * cpp.cpp2_rate),
    ei: cents(Math.min(income, ei.max_insurable) * ei.rate),
  };
}

// Provincial income tax, the way form NL428 computes it, for a single employee whose income is
// all employment income: the brackets on net income (income less the enhanced CPP and CPP2
// deductions), less the credits at the lowest rate (basic personal amount, base CPP and EI
// premiums). Other credits are ignored.
export function nlIncomeTax(income, tax) {
  const pay = payrollContributions(income, tax);
  const net = Math.max(0, income - pay.deduction);
  let owed = 0;
  for (const [lo, hi, rate] of tax.brackets) {
    if (net <= lo) break;
    owed += (Math.min(net, hi ?? Infinity) - lo) * rate;
  }
  owed -= (tax.basic_personal_amount + pay.baseCpp + pay.ei) * tax.brackets[0][2];
  // Low-income tax reduction for a single person (form NL428 lines 95 to 104)
  if (tax.low_income) {
    const red = Math.max(0, tax.low_income.basic - tax.low_income.rate * Math.max(0, net - tax.low_income.threshold));
    owed -= red;
  }
  return Math.max(0, owed);
}

export const DATASET_LABEL = {
  ppa: "Provincial contract award",
  minister: "Minister's expense claim",
  mha: "MHA expense",
  sunshine: "Public sector pay over $100,000",
  fed_contract: "Federal contract",
  fed_grant: "Federal grant or contribution",
  canadabuys: "Federal award notice",
  pa_pss: "Federal professional services payment",
  pa_tp: "Federal transfer payment",
};

export const LEVEL_LABEL = { provincial: "Provincial", federal: "Federal", municipal: "Municipal" };

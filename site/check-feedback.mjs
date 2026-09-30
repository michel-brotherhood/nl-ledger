// Checks on the feedback box's endpoint (routes/feedback.js) with stand-ins for D1, the mail binding, the rate
// limit and Turnstile. Runs in CI with no account: `node site/check-feedback.mjs`.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "./worker.mjs";
import { layout, FEEDBACK_MAX } from "./lib/html.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const sql = new DatabaseSync(":memory:");
sql.exec(readFileSync(HERE + "feedback.sql", "utf8"));
const DB = {
  prepare(text) {
    const st = sql.prepare(text);
    const run = (args) => ({ all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) ?? null, run: async () => (st.run(...args), { success: true }) });
    return { ...run([]), bind: (...args) => run(args) };
  },
};
const mails = [];
let mailFails = false;
let allow = true; // the rate limit's answer
let human = true; // Turnstile's answer
const pending = [];
const DATA = { "/data/stats.json": {}, "/data/flags.json": { flags: [], caveat: "" }, "/data/version.json": { v: "t", updated: "2026-01-01" }, "/data/links.json": {} };
const env = {
  DB,
  TURNSTILE_SECRET: "test-secret",
  FEEDBACK_TO: "inbox@example.org",
  MAIL: { send: async (m) => { if (mailFails) throw Object.assign(new Error("no route"), { code: "E_TEST" }); mails.push(m); return { messageId: "m1" }; } },
  FEEDBACK_LIMIT: { limit: async () => ({ success: allow }) },
  ASSETS: { fetch: async (u) => Response.json(DATA[new URL(u.url || u).pathname] ?? {}) },
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => (String(u).includes("siteverify") ? Response.json({ success: human && init.body.get("response") === "good" }) : realFetch(u, init));

const post = async (fields, headers = {}, e = env) => {
  const res = await worker.fetch(new Request("https://nlledger.ca/feedback", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(fields) }), e, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending.splice(0));
  return res;
};
const JSON_ = { accept: "application/json" };
const rows = () => sql.prepare("SELECT * FROM feedback ORDER BY id").all();

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};

// ---- the box is on every page, and posts to the endpoint
{
  const h = layout({ title: "T", body: "<p>x</p>", path: "/flags/" });
  check(/<section class="fb" id="feedback"/.test(h) && /action="\/feedback" method="post"/.test(h), "every page carries the box");
  check(/name="page" value="\/flags\/"/.test(h), "the page's address travels with the note");
  check(/href="#feedback"/.test(h), "the top bar links to the box");
  check(!/id="feedback"/.test(layout({ title: "T", body: "", feedback: false })), "a page can leave the box out");
}

// ---- with the Turnstile check passed: stored, emailed, JSON answer
{
  const res = await post({ kind: "idea", note: "  Show budget against actual.\r\nPlease.  ", email: "reader@example.ca", page: "/priorities/", "cf-turnstile-response": "good" }, JSON_);
  const r = rows()[0];
  check(res.status === 200 && (await res.json()).ok === true, "a checked note is accepted");
  check(r && r.kind === "idea" && r.note === "Show budget against actual.\nPlease." && r.email === "reader@example.ca" && r.page === "/priorities/" && r.checked === "turnstile", "it is stored as sent, trimmed");
  check(r.mail === "sent m1" && mails.length === 1, "it is emailed, and the row says so");
  const m = mails[0];
  check(m.to === "inbox@example.org" && m.from === "feedback@nlledger.ca" && m.replyTo === "reader@example.ca", "the email goes to the address in FEEDBACK_TO, with the visitor's as reply-to");
  check(/I have an idea: \/priorities\/$/.test(m.subject) && m.text.includes("Show budget against actual.") && m.text.includes("https://nlledger.ca/priorities/"), "the email carries the kind, the page and the note");
  check(res.headers.get("cache-control") === "private, no-store", "the answer is never cached");
  check(!Object.keys(r).some((k) => /ip|agent/i.test(k)), "no network address or browser detail is stored");
}

// ---- a subject line cannot be bent by the page field
{
  await post({ note: "x", page: "/a\r\nBcc: someone@example.com", "cf-turnstile-response": "good" }, JSON_);
  check(!/[\r\n]/.test(mails.at(-1).subject) && rows().at(-1).page === "/aBcc: someone@example.com", "line breaks are stripped from the page address");
  await post({ note: "x", page: "https://evil.example/", "cf-turnstile-response": "good" }, JSON_);
  check(rows().at(-1).page === "", "an address on another site is not kept as the page");
}

// ---- without Turnstile: the check page, then one more press
{
  const before = rows().length;
  const f = { kind: "wrong", note: "A <b>figure</b> looks off", email: "", page: "/item/abc/" };
  let res = await post(f);
  let h = await res.text();
  check(res.status === 200 && /Check your note, then send it/.test(h) && rows().length === before, "no check: the note is shown back, nothing stored");
  check(h.includes("A &lt;b&gt;figure&lt;/b&gt; looks off") && !h.includes("<b>figure</b>"), "the note is escaped when shown back");
  check(res.headers.get("cache-control") === "private, no-store" && !/id="feedback"/.test(h.split("<footer")[1] || ""), "the check page is never cached");
  const token = h.match(/name="confirm" value="([^"]+)"/)[1];
  res = await post({ ...f, confirm: token });
  check(/That was quick/.test(await res.text()) && rows().length === before, "a press within two seconds is asked again");
  const old = Date.now;
  Date.now = () => old() + 5000;
  res = await post({ ...f, note: "Something else entirely", confirm: token });
  check(/Check your note/.test(await res.text()) && rows().length === before, "a token does not carry over to a different note");
  res = await post({ ...f, confirm: token.replace(/.$/, (c) => (c === "A" ? "B" : "A")) });
  check(/Check your note/.test(await res.text()) && rows().length === before, "a forged token is refused");
  res = await post({ ...f, confirm: token });
  check(res.status === 303 && res.headers.get("location") === "/feedback/sent/?from=%2Fitem%2Fabc%2F" && rows().length === before + 1 && rows().at(-1).checked === "confirm", "after the wait the note is stored, and the browser is sent to the thank-you");
  res = await post({ ...f, confirm: token });
  check(res.status === 303 && rows().length === before + 1, "the same token stores once");
  Date.now = () => old() + 31 * 60_000;
  res = await post({ ...f, confirm: token });
  check(/Check your note/.test(await res.text()), "a token over half an hour old is refused");
  Date.now = old;
  res = await post({ ...f, edit: "1" });
  h = await res.text();
  check(/Change your note/.test(h) && /<textarea[^>]*>A &lt;b&gt;figure/.test(h), "Change it hands the note back in the form");
}

// ---- refusals
{
  const before = rows().length;
  const mailsBefore = mails.length;
  let res = await post({ note: "bot", "cf-turnstile-response": "bad" }, JSON_);
  check(res.status === 403 && (await res.json()).fallback === true, "a failed Turnstile check is refused");
  res = await post({ note: "   ", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 400 && (await res.json()).field === "note", "an empty note is refused");
  res = await post({ note: "x".repeat(FEEDBACK_MAX + 1), "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 400, `a note over ${FEEDBACK_MAX} characters is refused`);
  res = await post({ note: "x".repeat(20000), "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 413, "an oversized request is refused before it is read");
  res = await post({ note: "x", email: "not an address", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 400 && (await res.json()).field === "email", "a bad email address is refused");
  res = await post({ note: "x", email: "a@b.ca\r\nBcc: x@y.z", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 400, "an email address with a line break is refused");
  res = await post({ note: "x", "cf-turnstile-response": "good" }, { ...JSON_, origin: "https://evil.example" });
  check(res.status === 403, "a post from another site is refused");
  res = await post({ note: "buy pills", hp_leave_empty: "http://spam.example", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 200 && rows().length === before, "a filled trap field gets a thank-you and stores nothing");
  allow = false;
  res = await post({ note: "x", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 429 && res.headers.get("retry-after") === "60", "over the rate limit: refused, with when to try again");
  res = await post({ note: "my only copy" });
  const limitedPage = await res.text();
  check(res.status === 429 && /Too many notes/.test(limitedPage) && />my only copy<\/textarea>/.test(limitedPage), "the refusal is a page that hands the note back");
  allow = true;
  res = await worker.fetch(new Request("https://nlledger.ca/feedback", { method: "DELETE" }), env, { waitUntil() {} });
  check(res.status === 405, "other methods are refused");
  res = await post({ note: "x", "cf-turnstile-response": "good" }, JSON_, { ...env, TURNSTILE_SECRET: undefined });
  check(res.status === 503, "with no secret set, nothing is accepted");
  check(rows().length === before && mails.length === mailsBefore, "none of the refusals stored or emailed anything");
}

// ---- a note a visitor sent with a bad field comes back to them, and only to them
{
  const res = await post({ note: "keep this text", email: "nope", kind: "question" });
  const h = await res.text();
  check(res.status === 400 && /role="alert"/.test(h) && />keep this text<\/textarea>/.test(h) && /value="question" checked/.test(h), "a refused note comes back in the form with what is wrong");
  const get = await worker.fetch(new Request("https://nlledger.ca/feedback/"), env, { waitUntil() {} });
  check(get.status === 200 && !(await get.text()).includes("keep this text"), "the form page shows nothing anyone sent");
}

// ---- mail failing does not lose the note
{
  mailFails = true;
  const res = await post({ note: "mail is down", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 200 && rows().at(-1).note === "mail is down" && /^failed: E_TEST/.test(rows().at(-1).mail), "a mail failure keeps the note and records the failure");
  mailFails = false;
}

// ---- one address, one day
{
  const from = (ip) => ({ ...JSON_, "cf-connecting-ip": ip });
  const n = rows().length;
  let last;
  for (let i = 0; i < 11; i++) last = await post({ note: `note ${i}`, "cf-turnstile-response": "good" }, from("203.0.113.9"));
  check(last.status === 429 && rows().length === n + 10, "one address stores ten notes in a day, and the eleventh is refused");
  const other = await post({ note: "someone else", "cf-turnstile-response": "good" }, from("203.0.113.10"));
  check(other.status === 200, "another address is not affected");
  await post({ note: "v6 a", "cf-turnstile-response": "good" }, from("2001:db8:1:2:aaaa::1"));
  await post({ note: "v6 b", "cf-turnstile-response": "good" }, from("2001:db8:1:2:bbbb::2"));
  const seen = sql.prepare("SELECT k, n FROM feedback_seen ORDER BY n").all();
  check(seen.length === 3 && seen.at(-2).n === 2, "an IPv6 /64 counts as one address");
  check(seen.every((r) => !/203|2001|db8/.test(r.k)) && !JSON.stringify(rows()).includes("203.0.113"), "no address is stored, only a one-way code, apart from the notes");
}

// ---- the day's cap
{
  const ins = sql.prepare("INSERT INTO feedback (created, note, checked, nonce) VALUES (?, 'fill', 'test', ?)");
  for (let i = 0; i < 300; i++) ins.run(new Date().toISOString(), `fill-${i}`);
  const n = rows().length;
  const res = await post({ note: "one too many", "cf-turnstile-response": "good" }, JSON_);
  check(res.status === 503 && rows().length === n, "past 300 notes in a day, no more are stored");
}

// ---- the thank-you
{
  const get = (u) => worker.fetch(new Request("https://nlledger.ca" + u), env, { waitUntil() {} }).then((r) => r.text());
  check(/href="\/flags\/">Back to the page you were on/.test(await get("/feedback/sent/?from=/flags/")), "the thank-you links back to the page");
  check(!/evil/.test(await get("/feedback/sent/?from=//evil.example/")) && !/evil/.test(await get("/feedback/sent/?from=https://evil.example/")), "and never to another site");
}

console.log(failed ? `${failed} FAILED` : "feedback checks: pass");
process.exit(failed ? 1 : 0);

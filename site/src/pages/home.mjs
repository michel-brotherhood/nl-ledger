// Home: the cover, your receipt, a working life, priorities, where it went, patterns, receipts.
import { esc, html, icon, Notes, leaders, oneToOne, bar, receipt } from "../../lib/html.mjs";
import { money, moneyWords, num, pct, workTime, perPerson, perHousehold, yearsOfWage, nlIncomeTax, date as fmtDate } from "../../lib/format.mjs";
import { renderReceipt } from "../../lib/receipt.mjs";
import { caveat } from "../common.mjs";
import { EXAMPLE } from "../connect.mjs";

export function home(D, R) {
  const notes = new Notes();
  const S = D.stats;
  const fy = R.year;
  const total = R.total;
  const src = R.source;
  const cite = notes.cite({ url: src.url, page: src.pages[0], label: `Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund ${fy}, Statement of Expenditure and Related Revenue by Department (current and capital accounts), gross expenditure, all departments`, locator: `PDF pages ${src.pages.join(" and ")}` });
  const citePop = notes.cite({ url: S.population.url, label: `Statistics Canada table ${S.population.table}, population of Newfoundland and Labrador on ${fmtDate(S.population.date)}: ${num(S.population.value)}` });
  const citeWage = notes.cite({ url: S.median_weekly_wage.url, label: `Statistics Canada table ${S.median_weekly_wage.table} (vector ${S.median_weekly_wage.vector}), median weekly wage of full-time employees in Newfoundland and Labrador, ${S.median_weekly_wage.year}: ${money(S.median_weekly_wage.value, { cents: true })}, times 52 weeks = ${money(S.median_annual_wage.value)} a year` });
  const citeHH = notes.cite({ url: S.households.url, label: `Statistics Canada table ${S.households.table}, private households in Newfoundland and Labrador, 2021 Census: ${num(S.households.value)}` });
  const citeRev = notes.cite({ url: S.provincial_government.url, label: `Statistics Canada table ${S.provincial_government.table}, Newfoundland and Labrador provincial government, ${S.provincial_government.year}: income taxes from households ${moneyWords(S.provincial_government.personal_income_tax)} (vector ${S.provincial_government.vectors["From households"]}) of total revenue ${moneyWords(S.provincial_government.revenue)} (vector ${S.provincial_government.vectors["General governments revenue"]})` });
  const citeTax = notes.cite({ url: S.nl_tax.source, label: `${S.nl_tax.source_label}. The receipt applies the ${S.nl_tax.year} brackets, the basic personal amount, CPP and EI credits and the low-income reduction; other credits are not applied` });

  const people = Math.round(yearsOfWage(total, S));
  const median = S.median_annual_wage.value;
  const career = median * 40;
  const perHour = total / (365 * 24);
  const careerHours = career / perHour;
  const h = Math.floor(careerHours);
  const m = Math.round((careerHours - h) * 60);

  // examples for "what a working life buys"
  const ex = R.timeExamples;

  const depts = R.departments;
  const top = depts.slice(0, 8);
  const max = top[0].gross;

  const levelTotals = R.levels;
  const lvMax = Math.max(...levelTotals.map((l) => l.amount));

  const cover = html`
<section class="cover" aria-labelledby="cover-h">
  <div class="cover-in">
    <h1 id="cover-h" class="cover-title">The Newfoundland and Labrador government spent</h1>
    <p class="cover-fig">${moneyWords(total)}${cite}</p>
    <p class="cover-sub">in ${fy}. That is <em>${money(perPerson(total, S))}</em> for every person in the province${citePop}, or what <em>${num(people)}</em> people earning the median full-time wage make in a year${citeWage}.</p>
    <hr class="cover-rule">
    <div class="cover-forms">
      <form class="field" action="/receipt/" method="get" data-receipt-form>
        <label for="inc">What did your taxes pay for?</label>
        <div class="field-row"><span class="pre">$</span><input id="inc" name="income" inputmode="numeric" pattern="[0-9,]*" placeholder="Your yearly income" autocomplete="off"><button class="btn" type="submit">Show me</button></div>
      </form>
      <form class="field" action="/search/" method="get" role="search">
        <label for="cq">Search ${num(R.itemCount)} records</label>
        <div class="field-row"><span class="pre">${icon("search")}</span><input id="cq" name="q" type="search" placeholder="A company, a town, a word" autocomplete="off"><button class="btn" type="submit">Search</button></div>
      </form>
    </div>
  </div>
</section>`;

  const aiSec = html`
<section class="section ai-home" id="ask-ai" aria-labelledby="ai-h">
  <div class="wrap grid-2">
    <div>
      <div class="section-head">
        <h2 id="ai-h">Ask your own AI anything</h2>
        <p class="lede">These pages show a small part of the records. Connect Claude, ChatGPT or another AI assistant to all ${num(R.itemCount)} of them and ask whatever you want to know, in your own words. It answers from the records and links each figure to its source.</p>
      </div>
      <div class="cta">
        <a class="btn" href="/data/#claude">Connect Claude ${icon("arrow")}</a>
        <a class="btn ghost" href="/data/#chatgpt">Connect ChatGPT</a>
        <a class="btn ghost" href="/data/#connect">Other assistants</a>
      </div>
      <p class="small muted">Free, read-only, no sign-in, and about a minute to set up. <a href="/data/#try">See what your AI would get back</a> before connecting anything.</p>
    </div>
    <figure class="qa-fig">
    <dl class="qa">
      <div><dt>Asked</dt><dd class="qa-q">${esc(EXAMPLE.q)}</dd></div>
      <div><dt>${esc(EXAMPLE.by)} answered</dt><dd class="qa-a"><p>${esc(EXAMPLE.a)}</p><p class="qa-src"><a href="${esc(EXAMPLE.source.href)}" rel="noopener">${esc(EXAMPLE.source.label)} ${icon("out")}</a> · <a href="${EXAMPLE.record}">The record on this site</a></p></dd></div>
    </dl>
    <figcaption>A real answer from ${esc(EXAMPLE.by)} (in ${esc(EXAMPLE.via)}) connected to this site on ${fmtDate(EXAMPLE.on)}. Only the source link it ended with has been moved below the text.</figcaption>
    </figure>
  </div>
</section>`;

  const receiptSec = html`
<section class="section" id="receipt" aria-labelledby="rc-h">
  <div class="wrap grid-2">
    <div class="sticky">
      <div class="section-head">
        <h2 id="rc-h">Your receipt</h2>
        <p class="lede">Put in your income and see what your provincial income tax paid for, department by department, down to real contracts.</p>
      </div>
      <p>The receipt works out your ${S.nl_tax.year} Newfoundland and Labrador income tax${citeTax}, then spreads it the way the province spread all its spending in ${fy}. Health got ${pct(depts[0].share)} of every dollar spent, so ${pct(depts[0].share)} of your tax lands there.</p>
      <p class="muted small">Personal income tax brought in ${pct(S.provincial_government.personal_income_tax / S.provincial_government.revenue)} of provincial revenue in ${S.provincial_government.year}${citeRev}; sales taxes, federal transfers and resource revenue pay most of the rest. The receipt shows your part, not the whole bill. <a href="/method/receipt/">How the receipt works</a>.</p>
      <form class="field" action="/receipt/" method="get" data-receipt-form style="max-inline-size:26rem;margin-block-start:1.5rem">
        <label for="inc2">Your yearly income</label>
        <div class="field-row"><span class="pre">$</span><input id="inc2" name="income" inputmode="numeric" pattern="[0-9,]*" value="${num(median)}" autocomplete="off"><button class="btn" type="submit">Update</button></div>
      </form>
    </div>
    <div data-receipt-out>${renderReceipt(R, median, S)}</div>
  </div>
</section>`;

  const lifeSec = html`
<section class="section" aria-labelledby="life-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="life-h">What a working life buys</h2>
      <p class="lede">Someone earning the median full-time wage here, ${money(median)} a year, makes about ${moneyWords(career)} over a 40-year career. In ${fy} the province spent that much every ${h} hours and ${m} minutes.</p>
    </div>
    <div style="max-inline-size:40rem;margin-block-end:2.5rem">${leaders([
      { label: `Provincial spending for every resident, ${fy.replace("-", "\u2011")}`, value: money(perPerson(total, S)) },
      { label: `Provincial spending for every household${citeHH}`, value: money(perHousehold(total, S)) },
      { label: "Provincial spending every hour, around the clock, all year", value: moneyWords(perHour, 1) },
      { label: "A 40-year career at the median wage", value: moneyWords(career), cls: "total" },
    ]).replace('class="leaders"', 'class="leaders big"')}</div>
    <div class="grid-2" style="align-items:stretch">
      ${ex.map((e) => oneToOne({ title: e.title, amount: e.amount, href: e.href, body: `${esc(e.what)} It would take someone on the median wage <strong>${workTime(e.amount, S)}</strong> to earn. ${receipt(e.url, e.page, e.locator)}`, against: { amount: career, label: "a 40-year career at the median wage" } }))}
    </div>
    <p style="margin-block-start:2rem"><a class="btn solo" href="/scale/">Fold out $1 billion ${icon("arrow")}</a></p>
  </div>
</section>`;

  const prioSec = html`
<section class="section" aria-labelledby="pr-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="pr-h">Priorities</h2>
      <p class="lede">Where the provincial dollar went in ${fy}, set against what the budget said it would cost.</p>
    </div>
    <ul class="legend"><li><span class="sw"></span>Spent (actual)</li><li><span class="sw ghost"></span>Budgeted (original estimate)</li></ul>
    <div class="sched-wrap"><table class="sched">
      <thead><tr><th scope="col">Department</th><th scope="col" class="hide-sm" style="inline-size:36%">Spent against budget</th><th scope="col" class="n">Spent</th><th scope="col" class="n">Budgeted</th><th scope="col" class="n hide-sm">Per person</th></tr></thead>
      <tbody>${top.map((d) => html`<tr>
        <th scope="row"><a href="/department/${d.slug}/">${esc(d.name)}</a></th>
        <td class="hide-sm"><span class="pair">${bar(d.gross, max)}${d.original != null ? bar(d.original, max, "ghost") : ""}</span></td>
        <td class="n">${moneyWords(d.gross)}</td>
        <td class="n">${d.original ? moneyWords(d.original) : "not printed"}</td>
        <td class="n hide-sm">${money(perPerson(d.gross, S))}</td></tr>`)}
        <tr class="sub"><th scope="row"><a href="/priorities/">${depts.length - top.length} more departments</a></th><td class="hide-sm"></td>
        <td class="n">${moneyWords(depts.slice(top.length).reduce((s, d) => s + d.gross, 0))}</td>
        <td class="n">${moneyWords(depts.slice(top.length).reduce((s, d) => s + (d.original || 0), 0))}</td>
        <td class="n hide-sm">${money(perPerson(depts.slice(top.length).reduce((s, d) => s + d.gross, 0), S))}</td></tr>
      </tbody>
      <tfoot><tr class="total"><th scope="row">All ${depts.length} departments</th><td class="hide-sm"></td><td class="n">${moneyWords(total)}</td><td class="n">${moneyWords(depts.reduce((s, d) => s + (d.original || 0), 0))}</td><td class="n hide-sm">${money(perPerson(total, S))}</td></tr></tfoot>
    </table></div>
    <p style="margin-block-start:1.5rem"><a href="/priorities/">Every department and program, ${D.years[0]} to ${fy} ${icon("arrow")}</a></p>
  </div>
</section>`;

  const whereSec = html`
<section class="section" aria-labelledby="wh-h">
  <div class="wrap grid-2">
    <div>
      <div class="section-head">
        <h2 id="wh-h">Where it went</h2>
        <p class="lede">${num(R.itemCount)} line items from provincial and federal records: contract awards (including sole-source), grants, MHA and minister expense claims and salaries over $100,000 (the sunshine list).</p>
      </div>
      <form class="field" action="/search/" method="get" role="search" style="max-inline-size:30rem">
        <label for="wq">Search every record</label>
        <div class="field-row"><span class="pre">${icon("search")}</span><input id="wq" name="q" type="search" placeholder="Try ferry, snow clearing, consulting" autocomplete="off"><button class="btn" type="submit">Search</button></div>
      </form>
      <ul class="chips" style="margin-block-start:1rem">${R.suggestions.map((s) => `<li><a href="/search/?q=${encodeURIComponent(s)}">${esc(s)}</a></li>`)}</ul>
      <h3 style="margin-block:2rem .8rem">By level of government</h3>
      ${leaders(levelTotals.map((l) => ({ label: `<span class="sw lv-${l.level}"></span>${esc(l.label)}`, value: moneyWords(l.amount) })))}
      <p class="small muted" style="margin-block-start:.8rem">Federal: contracts with suppliers that have an NL postal code, and grant and contribution agreements, whose values can span several years (major transfers are on the <a href="/federal/">federal page</a>). Provincial: contract awards since 2021, minister and MHA claims, and four years of pay over $100,000. The sources cover different years and kinds of money, so these are not one year's spending and should not be compared as if they were. <a href="/sources/">What each source covers</a>.</p>
    </div>
    <div>
      <h3 style="margin-block-end:.8rem">Largest recipients across all three levels</h3>
      <div class="sched-wrap"><table class="sched compact">
        <thead><tr><th scope="col">Recipient</th><th scope="col" class="n">On record</th></tr></thead>
        <tbody>${R.topRecipients.map((r) => html`<tr><th scope="row"><a href="${r.href}">${esc(r.name)}</a><span class="meta">${esc(r.sources)}</span></th><td class="n">${moneyWords(r.amount)}</td></tr>`)}</tbody>
      </table></div>
      <p class="small muted">Contract values and grant agreement values as reported, which can span several years; not money paid in one year. Federal major transfers to the provincial government (health, social) are not in this list; they are on the <a href="/federal/">federal page</a>.</p>
    </div>
  </div>
</section>`;

  const flagSec = html`
<section class="section" aria-labelledby="fl-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="fl-h">Patterns people ask about</h2>
      <p class="lede">Sole-source contracts and other awards without competition, contracts that grew, purchases just under a limit, year-end rushes, overtime bigger than salary. Each is counted from the records, with its method written down.</p>
    </div>
    ${caveat(esc(D.catalog.caveat))}
    <ul class="flaglist" style="margin-block-start:1rem">${D.catalog.flags.slice(0, 8).map((f) => {
      const s = D.flagSummary[f.id] || {};
      const count = s.items ? `${num(s.items)} items` : s.subjects ? `${num(s.subjects)} found` : "none found";
      return html`<li><a class="q" href="/flags/${f.id}/" aria-hidden="true" tabindex="-1">${icon("query")}</a><h3><a href="/flags/${f.id}/">${esc(f.title)}</a></h3><span class="count">${count}</span><p>${esc(f.short)}</p></li>`;
    })}</ul>
    <p style="margin-block-start:1.5rem"><a href="/flags/">All ${D.catalog.flags.length} patterns and how each is worked out ${icon("arrow")}</a></p>
  </div>
</section>`;

  const rcptSec = html`
<section class="section" aria-labelledby="rp-h">
  <div class="wrap grid-2">
    <div>
      <div class="section-head">
        <h2 id="rp-h">Every figure has a receipt</h2>
        <p class="lede">Each number on this site links to the public file it came from, and to the page or row inside it.</p>
      </div>
      <p>Where a total is added up here, the sum is checked against the total the source prints. Where the source is wrong, broken or missing, that goes on the <a href="/sources/">publisher report card</a> rather than being quietly fixed.</p>
      <p><a href="/sources/">Sources and report card</a> · <a href="/corrections/">Corrections</a> · <a href="/data/">Ask your own AI about the records</a></p>
    </div>
    <div>
      ${leaders(R.reportCard.map((x) => ({ label: esc(x.label), value: esc(x.value) })))}
    </div>
  </div>
</section>`;

  return { body: cover + receiptSec + lifeSec + prioSec + aiSec + whereSec + flagSec + rcptSec, notes };
}

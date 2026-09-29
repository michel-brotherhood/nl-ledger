// /data/: connect your own AI assistant to the records, ask it something, and see what it gets back.
import { esc, html, icon, schedule } from "../../lib/html.mjs";
import { num, SITE } from "../../lib/format.mjs";
import { TOOLS } from "../../lib/mcp.mjs";
import { pagehead, caveat } from "../common.mjs";
import { MCP_URL, CLIENTS, MORE, QUESTIONS, askClaude, askChatGPT, asked } from "../connect.mjs";

const VERIFIED = {
  tested: "Tested on 29 September 2026: it connected and answered questions from the records.",
  seen: "",
  docs: "",
};

// A copyable block: a label, the text, and a Copy button (the button works with JavaScript; the text is selectable without it).
export function copyBlock(label, text, { inline = false } = {}) {
  const body = inline ? esc(text) : esc(text).replaceAll(`&quot;${MCP_URL}&quot;`, `<span class="nobr">&quot;${MCP_URL}&quot;</span>`).replaceAll(new RegExp(`(?<!>&quot;)${MCP_URL.replaceAll(".", "\\.")}(?!&quot;<)`, "g"), (u) => `<span class="nobr">${u}</span>`);
  return html`<div class="copy${inline ? " inline" : ""}">
    <span class="copy-label">${esc(label)}</span>
    <pre tabindex="0"><code>${body}</code></pre>
    <button class="copy-btn" type="button" data-copy hidden>${icon("copy", "i-copy")}${icon("check", "i-done")}<span aria-live="polite">Copy</span></button>
  </div>`;
}

function actionButton(a) {
  return html`<p class="client-act"><a class="btn solo" href="${esc(a.href)}"${a.app ? "" : ' target="_blank" rel="noopener"'}${a.copies ? ` data-copy-open="${esc(a.copies)}"` : ""}>${icon(a.app ? "plug" : "out")}${esc(a.label)}</a>${a.app ? `<span class="small muted">Opens the app if it is installed on this computer.</span>` : ""}</p>`;
}

function clientPanel(c) {
  const at = c.action ? c.action.after ?? c.steps.length : -1;
  const list = (steps, start) => (steps.length ? `<ol class="steps"${start > 1 ? ` start="${start}"` : ""}>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : "");
  // Chat apps: address first, then the button, then the steps. Coding tools: button, steps, then the config to copy.
  const chat = c.group === "chat";
  return html`<article class="client" id="${c.id}" data-client="${c.id}" aria-labelledby="h-${c.id}">
    <header class="client-head">
      <h3 id="h-${c.id}">${esc(c.name)}</h3>
      <p${chat ? "" : ' class="muted small"'}>${esc(c.lead)}</p>
    </header>
    ${chat ? c.copy.map((x) => copyBlock(x.label, x.text)) : ""}
    ${c.action && at === 0 ? actionButton(c.action) : ""}
    ${list(c.steps.slice(0, Math.max(0, at)), 1)}
    ${c.action && at > 0 ? actionButton(c.action) : ""}
    ${list(c.steps.slice(Math.max(0, at)), Math.max(0, at) + 1)}
    ${chat ? "" : c.copy.map((x) => copyBlock(x.label, x.text))}
    ${c.note ? `<p class="small">${esc(c.note)}</p>` : ""}
    <p class="client-check small">${c.verified === "tested" ? `${icon("check")}${esc(VERIFIED.tested)} ` : ""}<a href="${esc(c.doc)}" rel="noopener">${esc(c.docName || c.name)}'s own instructions</a></p>
  </article>`;
}

export function connectPage(D, R) {
  const groups = [["chat", "Chat apps"], ["code", "Coding tools"]];
  const body = html`${pagehead({
    crumbs: [["/", "Home"], [null, "Ask your AI"]],
    title: "Ask your own AI about every record",
    lede: `This site shows a small part of what is in the records. Connect Claude, ChatGPT or another AI assistant to all ${num(R.itemCount)} of them and ask it anything in plain words. It answers from the records and links each figure to its source.`,
    extra: html`<div class="addr">
      ${copyBlock("The address your assistant needs", MCP_URL, { inline: true })}
      <p class="small">Free, read-only, and no sign-in. Your conversation stays with your assistant: this site only sees the words it looks up, and keeps no accounts.</p>
      <nav class="jump" aria-label="On this page"><a href="#connect">1. Connect it</a><a href="#ask">2. Ask it something</a><a href="#try">Try it here first</a></nav>
    </div>`,
  })}

<section class="section" id="connect" aria-labelledby="connect-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="connect-h">1. Connect your assistant</h2>
      <p class="lede">Pick the one you use. Most take under a minute, and you only do it once.</p>
    </div>
    <div class="picker" data-picker>
      ${groups.map(([g, label]) => html`<div class="picker-row"><span class="picker-label">${label}</span><ul role="list">${CLIENTS.filter((c) => c.group === g).map((c) => `<li><a class="pick" href="#${c.id}" data-pick="${c.id}">${esc(c.name)}</a></li>`)}</ul></div>`)}
    </div>
    <div class="clients">${CLIENTS.map(clientPanel)}</div>
    <p class="works"><strong>How to tell it is working:</strong> ask "Using ${esc(SITE.name)}, what are the largest snow clearing contracts?" The answer should name suppliers and amounts and link to government files. If it answers without links, the connector is not switched on for that chat. <a href="#try">Try the same lookup here</a> to compare.</p>
    <details class="more" id="other">
      <summary><span>Other assistants</span><span class="small muted">${MORE.length} more with a documented way to add a remote server</span></summary>
      ${schedule({ compact: true, cols: [{ label: "Assistant" }, { label: "Where to add it" }, { label: "What to enter" }], rows: MORE.map(([n, w, c, d]) => ({ cells: [`<a href="${esc(d)}" rel="noopener">${esc(n)}</a>`, esc(w), `<code>${esc(c)}</code>`] })) })}
      <p class="small">Anything else that can use a remote MCP server (Model Context Protocol, the standard these assistants share) works the same way: give it the address above, choose streamable HTTP if asked, and no authentication.</p>
    </details>
  </div>
</section>

<section class="section" id="ask" aria-labelledby="ask-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="ask-h">2. Ask it something</h2>
      <p class="lede">A few questions that show what is in the records. Copy one, or open a new chat with it already typed in, then press send.</p>
    </div>
    <p class="warn"><strong>Connect first.</strong> The Ask links only open a chat; your assistant uses the records once the connector is added. In ChatGPT, also choose Developer mode and ${esc(SITE.name)} from the + menu in each new chat, or it will answer without the records.</p>
    <ol class="asks" role="list">${QUESTIONS.map((x, i) => html`<li class="ask">
      <p class="ask-q">${esc(x.q)}</p>
      <div class="ask-do">
        <button class="linkbtn" type="button" data-copy-text="${esc(asked(x.q))}" hidden>${icon("copy", "i-copy")}${icon("check", "i-done")}<span>Copy</span></button>
        <a href="${esc(askClaude(x.q))}" target="_blank" rel="noopener">${icon("chat")}Ask Claude</a>
        <a href="${esc(askChatGPT(x.q))}" target="_blank" rel="noopener">${icon("chat")}Ask ChatGPT</a>
      </div>
    </li>`)}</ol>
    ${caveat(`The figures come from public records, gathered and combined by automated scripts, and have not been independently vetted. The server tells your assistant to cite a source for every figure. Open it before relying on an answer.`)}
  </div>
</section>

<section class="section" id="try" aria-labelledby="try-h">
  <div class="wrap grid-2">
    <div>
      <div class="section-head">
        <h2 id="try-h">Try it here first</h2>
        <p class="lede">See exactly what your assistant gets back when it looks something up. This calls the same server your assistant will.</p>
      </div>
      <p>Your assistant picks the right lookup for your question on its own, often several in a row, then writes the answer from what comes back. Every record carries a link to the government file it came from.</p>
      <noscript><p class="small">This panel needs JavaScript. Everything else on the page works without it.</p></noscript>
    </div>
    <div class="trybox" data-try hidden>
      <form class="tryform" data-try-form>
        <div class="field">
          <label for="try-tool">Look up</label>
          <div class="field-row"><select id="try-tool" name="tool">
            <option value="search_records" data-ph="snow clearing" data-arg="query" data-hint="Try a company, a town, a kind of work or a job title.">Records matching some words</option>
            <option value="get_supplier" data-ph="Newfoundland Power" data-arg="name" data-hint="A company or organization's name. If it is not exact, close matches are listed.">Everything one company received</option>
            <option value="get_members" data-ph="travel" data-arg="category" data-hint="One of: travel, office, constituency, operational.">MHAs ranked by a kind of spending</option>
            <option value="human_scale" data-ph="$50 million" data-arg="amount" data-hint="Write it any way: 50000000, 50,000,000 or $50 million.">An amount in human terms</option>
          </select></div>
        </div>
        <div class="field">
          <label for="try-arg">Words</label>
          <div class="field-row"><input id="try-arg" name="arg" type="text" value="snow clearing" autocomplete="off" enterkeyhint="go"><button class="btn" type="submit">Run it</button></div>
        </div>
      </form>
      <p class="small muted" data-try-hint>Try a company, a town, a kind of work or a job title.</p>
      <div class="tryout" data-try-out aria-live="polite"></div>
    </div>
  </div>
</section>

<section class="section" id="tools" aria-labelledby="tools-h">
  <div class="wrap">
    <h2 id="tools-h" class="vh">Details</h2>
    <details class="more" id="lookups">
      <summary><span>What your assistant can look up</span><span class="small muted">${TOOLS.length} lookups, described the way your assistant sees them</span></summary>
      ${schedule({ compact: true, cols: [{ label: "Lookup" }, { label: "What it does" }], rows: TOOLS.map((t) => ({ cells: [`${esc(t.title)}<span class="meta"><code>${esc(t.name)}</code></span>`, esc(t.description.replace(/ Sources: .*$/, ""))] })) })}
    </details>
    <details class="more" id="developers">
      <summary><span>For developers</span><span class="small muted">Transport, discovery files and data</span></summary>
      <ul class="prose">
        <li>Address: <code>${MCP_URL}</code>. Streamable HTTP, JSON responses, no session, no authentication. Protocol versions 2024-11-05 to 2025-11-25. CORS is open, so browser clients can call it directly.</li>
        <li>Discovery: <a href="/server.json">server.json</a> (MCP registry format), <a href="/.well-known/ai-catalog.json">/.well-known/ai-catalog.json</a> and <a href="/mcp/server-card">/mcp/server-card</a> (MCP server card, draft), <a href="/llms.txt">llms.txt</a>.</li>
        <li>Also offers <code>search</code> and <code>fetch</code> in the shape ChatGPT deep research expects, and four starter prompts.</li>
        <li>Summary files this site is built from: <a href="/data/receipt.json">receipt.json</a>, <a href="/data/stats.json">stats.json</a>, <a href="/data/flags.json">flags.json</a>, <a href="/data/departments.json">departments.json</a>, <a href="/data/members.json">members.json</a>.</li>
      </ul>
    </details>
  </div>
</section>`;
  return ["/data/", { title: "Ask your AI", description: `Connect Claude, ChatGPT or another AI assistant to ${num(R.itemCount)} Newfoundland and Labrador public spending records and ask it anything. Free, read-only, no sign-in.`, body }];
}

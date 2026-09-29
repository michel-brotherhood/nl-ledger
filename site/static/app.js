// Small enhancements. Every page works without this file.
(() => {
  const root = document.documentElement;

  // Theme toggle: follows the system until the reader picks one.
  const btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    btn.hidden = false;
    btn.addEventListener("click", () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = dark ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
    });
  }

  // Live receipt: recompute in the browser as the income changes.
  const out = document.querySelector("[data-receipt-out]");
  const forms = document.querySelectorAll("[data-receipt-form]");
  if (out && forms.length) {
    let R, stats, render;
    const ready = Promise.all([
      fetch("/data/receipt.json").then((r) => r.json()),
      fetch("/data/stats.json").then((r) => r.json()),
      import("/lib/receipt.mjs"),
    ]).then(([r, s, m]) => {
      R = r;
      stats = s;
      render = m.renderReceipt;
    });
    let t;
    for (const form of forms) {
      const input = form.querySelector("input[name=income]");
      const update = () => {
        const cleaned = (input.value || "").replace(/[\s,$]/g, "");
        if (!/^\d{1,8}(\.\d{0,2})?$/.test(cleaned)) return;
        const v = Math.floor(Number(cleaned));
        ready.then(() => (out.innerHTML = render(R, Math.min(10000000, v), stats)));
      };
      // on the home cover the receipt sits further down: jump to it
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        update();
        const sec = document.getElementById("receipt");
        const other = document.getElementById("inc2");
        if (other && other !== input) other.value = input.value;
        if (sec && !sec.contains(form)) sec.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
      input.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(update, 180);
      });
    }
  }
})();

// Ask your AI: copy buttons, the assistant picker, and the live "try it here" panel.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- copy to clipboard, with a fallback for browsers without the async API
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;inset-block-start:-100px;opacity:0";
      document.body.append(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) {}
      t.remove();
      return ok;
    }
  }
  function flash(btn, ok) {
    const label = btn.querySelector("span");
    const was = label.dataset.was || label.textContent;
    label.dataset.was = was;
    label.textContent = ok ? "Copied" : "Select and copy";
    btn.classList.toggle("is-done", ok);
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      label.textContent = was;
      btn.classList.remove("is-done");
    }, 2000);
  }
  for (const btn of document.querySelectorAll("[data-copy], [data-copy-text]")) {
    btn.hidden = false;
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copyText ?? btn.closest(".copy").querySelector("pre").textContent;
      flash(btn, await copyText(text));
    });
  }

  // Buttons that open an assistant also copy the address, so it is ready to paste there.
  for (const a of document.querySelectorAll("[data-copy-open]")) {
    a.addEventListener("click", () => {
      copyText(a.dataset.copyOpen);
    });
  }

  // ---- the picker: one assistant at a time; the hash (#claude) and the last choice select it
  const picker = document.querySelector("[data-picker]");
  if (picker) {
    const panels = [...document.querySelectorAll("[data-client]")];
    const picks = [...picker.querySelectorAll("[data-pick]")];
    const ids = panels.map((p) => p.dataset.client);
    document.querySelector(".clients").classList.add("is-tabbed");
    const select = (id, { scroll = false, remember = true } = {}) => {
      if (!ids.includes(id)) id = ids[0];
      for (const p of panels) p.hidden = p.dataset.client !== id;
      for (const a of picks) a.setAttribute("aria-current", a.dataset.pick === id ? "true" : "false");
      if (remember) try { localStorage.setItem("ai-client", id); } catch (e) {}
      if (scroll) document.getElementById(id).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    };
    let saved = null;
    try { saved = localStorage.getItem("ai-client"); } catch (e) {}
    const fromHash = () => location.hash.slice(1);
    select(ids.includes(fromHash()) ? fromHash() : saved || "claude", { remember: false });
    for (const a of picks) {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        select(a.dataset.pick, { scroll: true });
        history.replaceState(null, "", `#${a.dataset.pick}`);
      });
    }
    addEventListener("hashchange", () => ids.includes(fromHash()) && select(fromHash(), { scroll: true }));
  }

  // ---- try it here: one call to the live MCP server per press, never on load
  const box = document.querySelector("[data-try]");
  if (box) {
    box.hidden = false;
    const form = box.querySelector("[data-try-form]");
    const out = box.querySelector("[data-try-out]");
    const tool = form.elements.tool;
    const arg = form.elements.arg;
    const argLabel = form.querySelector('label[for="try-arg"]');
    const LABELS = { query: "Words", name: "Company or recipient", category: "Kind of spending", amount: "Amount in dollars" };
    const opt = () => tool.selectedOptions[0];
    const hint = box.querySelector("[data-try-hint]");
    tool.addEventListener("change", () => {
      argLabel.textContent = LABELS[opt().dataset.arg];
      hint.textContent = opt().dataset.hint || "";
      arg.value = opt().dataset.ph;
      arg.inputMode = opt().dataset.arg === "amount" ? "numeric" : "text";
    });
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const $ = (v) => (v == null ? "" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: v >= 1000 ? 0 : 2 }).format(v).replace("CA", ""));
    const safe = (u) => (/^https?:\/\//.test(u || "") ? esc(u) : "#");
    const rec = (r) => `<li><span>${esc(r.supplier || r.person || r.buyer || "")}${r.description ? ` · ${esc(r.description)}` : ""}</span><span class="amt">${$(r.amount_cad)}</span>
      <span class="meta">${esc(r.source)}${r.buyer && r.supplier ? `, ${esc(r.buyer)}` : ""}${r.date ? `, ${esc(r.date)}` : ""} · <a href="${safe(r.source_url)}" rel="noopener">source</a> · <a href="${safe(r.page_url)}">record</a></span></li>`;

    function readable(name, d) {
      if (d.error) {
        const m = d.close_matches;
        return `<p class="try-err"><strong>The server says:</strong> ${esc(d.error)}</p>${m ? `<p class="small">Close matches, as your assistant would see them:</p><div class="chipbtns">${m.map((x) => `<button type="button" data-sid="${esc(x.supplier_id)}">${esc(x.name)}</button>`).join("")}</div>` : ""}${d.next_step ? `<p class="small muted">${esc(d.next_step)}</p>` : ""}`;
      }
      if (name === "search_records") {
        if (!d.records?.length) return `<p>${esc(d.note || "Nothing matched.")}</p>`;
        return `<h3>${d.records_found} records${d.truncated ? ", largest first" : ""}</h3><ul class="try-list">${d.records.slice(0, 8).map(rec).join("")}</ul>${d.records_found > 8 ? `<p class="small muted">Showing 8. Your assistant gets ${d.records.length} per page and can ask for more.</p>` : ""}`;
      }
      if (name === "get_supplier") {
        return `<h3>${esc(d.name)}: ${$(d.total_cad)}</h3><p class="small">${d.records} records. ${esc(d.human_scale?.per_resident)} per resident.</p><ul class="try-list">${d.largest_records.slice(0, 6).map(rec).join("")}</ul>`;
      }
      if (name === "get_members") {
        return `<h3>${esc(d.fiscal_year)}: average ${$(d.average_cad)}</h3><p class="small muted">${esc(Array.isArray(d.categories) ? d.categories.join("; ") : d.categories)}</p><ul class="try-list">${d.ranking.slice(0, 8).map((m) => `<li><span>${esc(m.name)}</span><span class="amt">${$(m.amount_cad)}</span><span class="meta">${esc(m.district || "")} · <a href="${safe(m.page_url)}">claims</a></span></li>`).join("")}</ul><p class="small muted">${esc(d.note)}</p>`;
      }
      if (name === "human_scale") {
        return `<h3>${esc(d.in_words || d.amount)}</h3><ul class="try-list"><li><span>Per resident</span><span class="amt">${esc(d.per_resident)}</span></li><li><span>Per household</span><span class="amt">${esc(d.per_household)}</span></li><li><span>Time to earn at the median wage</span><span class="amt">${esc(d.time_to_earn_at_median_wage)}</span></li></ul>`;
      }
      return "";
    }

    let busy = false;
    async function run(name, args) {
      if (busy) return;
      busy = true;
      out.innerHTML = `<p class="status">Asking the server…</p>`;
      const req = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } };
      try {
        const res = await fetch("/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(req) });
        const j = await res.json();
        if (j.error) throw new Error(j.error.message);
        const d = j.result.structuredContent;
        const text = j.result.content[0].text;
        out.innerHTML = readable(name, d) + `<details class="try-raw"><summary>What your assistant receives (${new Intl.NumberFormat("en-CA").format(text.length)} characters)</summary><p class="small muted">It sent:</p><pre><code>${esc(JSON.stringify(req, null, 1))}</code></pre><p class="small muted">It got back:</p><pre><code>${esc(JSON.stringify(d, null, 1))}</code></pre></details>`;
        for (const b of out.querySelectorAll("[data-sid]")) b.addEventListener("click", () => run("get_supplier", { supplier_id: b.dataset.sid }));
      } catch (e) {
        out.innerHTML = `<p class="try-err"><strong>That did not work.</strong> The server could not be reached (${esc(e.message)}). Check your connection and press Run it again.</p>`;
      } finally {
        busy = false;
      }
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const key = opt().dataset.arg;
      const v = arg.value.trim();
      if (!v) { arg.focus(); return; }
      let args = { [key]: v };
      if (key === "amount") {
        // "$50 million", "50,000,000", "2.5 billion", "50m"
        const m = /^\$?\s*([\d.,]+)\s*(million|mil|m|billion|bn|b|thousand|k)?$/i.exec(v.replace(/\s+/g, " ").trim());
        const mult = { million: 1e6, mil: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, thousand: 1e3, k: 1e3 };
        const n = m ? Number(m[1].replace(/,/g, "")) * (mult[(m[2] || "").toLowerCase()] || 1) : NaN;
        if (!Number.isFinite(n)) { out.innerHTML = `<p class="try-err">Write the amount as a number, for example 50000000 or $50 million.</p>`; return; }
        args = { amount: n };
      }
      run(tool.value, args);
    });
  }
})();

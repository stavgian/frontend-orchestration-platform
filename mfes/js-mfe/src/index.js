// Compliance: a plain-JavaScript native Web Component.
// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

// Fictional checks, keyed by the context id the shell announces.
const INITIAL = {
  "CASE-2026-1082": [{ check: "Conflict check", result: "pass" }, { check: "Sanctions screening", result: "pass" }],
  "CASE-2026-1083": [{ check: "Conflict check", result: "pass" }, { check: "Privacy review", result: "review" }],
  "CASE-2026-1084": [{ check: "Conflict check", result: "pass" }, { check: "Anti-money-laundering", result: "review" }],
  "CASE-2026-1085": [{ check: "Conflict check", result: "pass" }],
  "CASE-2026-1086": [{ check: "Conflict check", result: "pass" }, { check: "Data-protection review", result: "review" }],
};

// Messages come from other apps, so never insert them into HTML unescaped.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const STYLES = `
  :host { display: block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color: var(--text, #171a20); }
  .ctx { margin: 0 0 10px; font-size: 13px; color: var(--text-secondary, #5a6578); }
  ul { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
  li { display: flex; gap: 10px; padding: 8px 12px; border-radius: 8px; background: var(--surface, #f7f8fa); font-size: 14px; }
  li span:first-child { flex: 1; }
  .pass { color: var(--ok, #15803d); font-weight: 600; }
  .review { color: #a16207; font-weight: 600; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 9999px; cursor: pointer; border: 0; color: #fff; background: #c2410c; }
  button:focus-visible { outline: 2px solid #0495d4; outline-offset: 3px; }
  .empty { margin: 0; padding: 18px 12px; text-align: center; color: var(--text-secondary, #5a6578); font-size: 14px; border-radius: 8px; border: 2px dashed var(--border, #e5e7eb); }
`;

class JsMfe extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.ctx = null;
    // Local state: checks per context id.
    this.checks = {};
    this.bus = null;
  }

  connectedCallback() {
    this.bus = connect({
      id: "js-mfe",
      name: "Compliance",
      version: "1.0.0",
      meta: { framework: "Plain JavaScript", element: "Native Web Component" },
    });

    // Follow the portal's active context; ask once in case it was announced before this app loaded.
    this.bus.subscribe("context:changed", (msg) => this.setContext(msg.payload));
    this.bus.request("context:get", undefined, { to: "portal" }).then((c) => c && this.setContext(c), () => undefined);

    // Someone uploaded a document: screen it, then tell everyone the outcome.
    this.bus.subscribe("document:uploaded", ({ payload: doc }) => {
      this.runCheck(doc.contextId, `Document screening: ${doc.name}`, doc.kind === "evidence" ? "review" : "pass");
    });

    this.render();
  }

  disconnectedCallback() {
    this.bus?.disconnect();
    this.bus = null;
  }

  setContext(ctx) {
    this.ctx = ctx;
    this.render();
  }

  list(contextId) {
    return this.checks[contextId] ?? (this.checks[contextId] = [...(INITIAL[contextId] ?? [])]);
  }

  runCheck(contextId, check, result) {
    this.list(contextId).push({ check, result });
    this.bus.publish("compliance:check:completed", { contextId, check, result, text: `${check}: ${result === "pass" ? "passed" : "needs review"}` });
    this.render();
  }

  render() {
    const id = this.ctx?.contextId;
    const rows = id ? this.list(id) : [];
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>` + (id
      ? `<p class="ctx">Context <code>${escapeHtml(id)}</code> · ${rows.length} checks</p>
         <ul>${rows.map((r) => `<li><span>${escapeHtml(r.check)}</span><span class="${r.result === "pass" ? "pass" : "review"}">${r.result === "pass" ? "pass" : "needs review"}</span></li>`).join("")}</ul>
         <button id="run">Run periodic check</button>`
      : `<p class="empty">Waiting for a context from the portal…</p>`);
    this.shadowRoot.querySelector("#run")?.addEventListener("click", () =>
      this.runCheck(id, "Periodic review", "pass"));
  }
}

if (!customElements.get("js-mfe")) {
  customElements.define("js-mfe", JsMfe);
}

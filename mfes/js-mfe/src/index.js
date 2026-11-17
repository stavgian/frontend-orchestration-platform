// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

const CART_ID = "react-mfe";

// Messages come from other apps, so never insert them into HTML unescaped.
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const STYLES = `
  :host { display: block; font: 14px/1.45 Inter, system-ui, sans-serif; color: #e9eef5; }
  .intro { margin: 0 0 12px; color: #94a3b6; font-size: 13px; }
  .status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b6; margin-bottom: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; }
  .dot.off { background: transparent; box-shadow: none; border: 1.5px solid #94a3b6; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 999px; cursor: pointer; border: 0; color: #0a0f16; background: #f5d742; }
  button.secondary { color: #e9eef5; background: transparent; border: 1px solid rgba(255,255,255,0.18); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .result { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); font-size: 13px; }
  .result strong { font-size: 16px; }
  .muted { color: #94a3b6; }
  .error { color: #ff8fa8; }
  .note { margin: 12px 0 0; font-size: 13px; color: #94a3b6; }
`;

class JsMfe extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = { cartOnline: false, busy: false, summary: null, error: null, note: null };
    this.bus = null;
  }

  connectedCallback() {
    this.bus = connect({ id: "js-mfe", name: "Checkout", version: "1.0.0" });
    // Presence: only offer checkout while the cart app is connected.
    this.bus.onPeersChange((peers) => this.update({ cartOnline: peers.some((p) => p.id === CART_ID) }));
    this.bus.subscribe("cart:*", () => this.update({ summary: null })); // cart changed: old total is stale
    this.bus.subscribe("portal:announcement", (msg) => this.update({ note: `📣 ${msg.payload?.text ?? ""}` }));
    this.render();
  }

  disconnectedCallback() {
    this.bus?.disconnect();
    this.bus = null;
  }

  update(patch) {
    Object.assign(this.state, patch);
    this.render();
  }

  // Request/response: ask the cart app, and wait for its answer (or a timeout).
  async askCart() {
    this.update({ busy: true, error: null, note: null });
    const started = performance.now();
    try {
      const summary = await this.bus.request("cart:get-summary", undefined, { to: CART_ID, timeout: 2000 });
      this.update({ busy: false, summary: { ...summary, ms: Math.round(performance.now() - started) } });
    } catch (err) {
      const error = err.code === "timeout" ? "The cart didn't answer in time." : err.message;
      this.update({ busy: false, summary: null, error });
    }
  }

  placeOrder() {
    const { count, total } = this.state.summary;
    this.bus.publish("order:placed", { count, total });
    this.update({ summary: null, note: `Order sent: ${count} items, €${total}.` });
  }

  render() {
    const { cartOnline, busy, summary, error, note } = this.state;
    const canOrder = cartOnline && summary && summary.count > 0;

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <p class="intro">Checkout doesn't keep a copy of the cart. It asks the cart app directly.</p>
      <div class="status">
        <span class="dot ${cartOnline ? "" : "off"}"></span>
        ${cartOnline ? "Cart app is online" : "Cart app is offline"}
      </div>
      <div class="actions">
        <button id="ask" ${!cartOnline || busy ? "disabled" : ""}>${busy ? "Asking…" : "Ask cart for total"}</button>
        <button id="order" class="secondary" ${canOrder ? "" : "disabled"}>Place order</button>
      </div>
      ${
        summary
          ? `<div class="result"><strong>€${escapeHtml(summary.total)}</strong> for ${escapeHtml(summary.count)} items
             <div class="muted">The cart answered in ${escapeHtml(summary.ms)} ms</div></div>`
          : ""
      }
      ${error ? `<div class="result error">${escapeHtml(error)}</div>` : ""}
      ${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}
    `;

    this.shadowRoot.querySelector("#ask")?.addEventListener("click", () => this.askCart());
    this.shadowRoot.querySelector("#order")?.addEventListener("click", () => this.placeOrder());
  }
}

if (!customElements.get("js-mfe")) {
  customElements.define("js-mfe", JsMfe);
}

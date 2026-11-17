// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

const CART_ID = "react-mfe";

// Messages come from other apps, so never insert them into HTML unescaped.
const items = (n) => `${n} ${n === 1 ? "item" : "items"}`;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const STYLES = `
  :host { display: block; font: 14px/1.45 Inter, system-ui, sans-serif; color: #e9eef5; }
  .status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b6; margin-bottom: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; }
  .dot.off { background: transparent; box-shadow: none; border: 1.5px solid #94a3b6; }
  .total { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.04); margin-bottom: 12px; }
  .total strong { font-size: 22px; }
  .muted { color: #94a3b6; font-size: 12px; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 999px; cursor: pointer; border: 0; color: #0a0f16; background: #f5d742; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .error { margin: 12px 0 0; color: #ff8fa8; font-size: 13px; }
  .note { margin: 12px 0 0; font-size: 13px; color: #94a3b6; }
  .announce { display: flex; flex-direction: column; gap: 2px; margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; font-size: 13px; background: rgba(182,243,107,0.08); border: 1px solid rgba(182,243,107,0.3); animation: announce-in 250ms ease-out; }
  .from { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #b6f36b; }
  @keyframes announce-in { from { opacity: 0; transform: translateY(-4px); } }
`;

class JsMfe extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = { cartOnline: false, summary: null, busy: false, error: null, note: null, announcement: null };
    this.announceTimer = undefined;
    this.bus = null;
  }

  connectedCallback() {
    this.bus = connect({ id: "js-mfe", name: "Checkout", version: "1.0.0" });

    // Events keep the total current: the cart announces every change.
    this.bus.subscribe("cart:updated", (msg) => this.update({ summary: msg.payload, error: null }));
    this.bus.subscribe("portal:announcement", (msg) => {
      this.update({ announcement: String(msg.payload?.text ?? "") });
      clearTimeout(this.announceTimer);
      this.announceTimer = setTimeout(() => this.update({ announcement: null }), 6000);
    });

    // Presence + request: when the cart comes online, ask once for what it already holds.
    // Events only report changes, so without this a late-loading checkout would show nothing.
    this.bus.onPeersChange((peers) => {
      const online = peers.some((p) => p.id === CART_ID);
      if (online && !this.state.cartOnline) this.fetchSnapshot();
      this.update({ cartOnline: online, ...(online ? {} : { summary: null }) });
    });

    this.render();
  }

  disconnectedCallback() {
    clearTimeout(this.announceTimer);
    this.bus?.disconnect();
    this.bus = null;
  }

  update(patch) {
    Object.assign(this.state, patch);
    this.render();
  }

  askCart() {
    return this.bus.request("cart:get-summary", undefined, { to: CART_ID, timeout: 2000 });
  }

  async fetchSnapshot() {
    try {
      this.update({ summary: await this.askCart() });
    } catch {
      // The cart will announce its next change anyway.
    }
  }

  // Request at the moment of truth: confirm the total with the cart itself before ordering.
  async placeOrder() {
    this.update({ busy: true, error: null, note: null });
    const started = performance.now();
    try {
      const confirmed = await this.askCart();
      const ms = Math.round(performance.now() - started);
      if (!confirmed.count) {
        this.update({ busy: false, summary: confirmed, error: "The cart is empty now." });
        return;
      }
      this.bus.publish("order:placed", confirmed);
      this.update({
        busy: false,
        note: `Order placed: ${items(confirmed.count)}, €${confirmed.total}. Total confirmed by the cart in ${ms} ms.`,
      });
    } catch (err) {
      const error = err.code === "timeout" ? "The cart didn't confirm in time. Order not placed." : err.message;
      this.update({ busy: false, error });
    }
  }

  render() {
    const { cartOnline, summary, busy, error, note, announcement } = this.state;
    const count = summary?.count ?? 0;
    const canOrder = cartOnline && count > 0 && !busy;

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      ${announcement ? `<div class="announce" role="status"><span class="from">📣 From the portal</span>${escapeHtml(announcement)}</div>` : ""}
      <div class="status">
        <span class="dot ${cartOnline ? "" : "off"}"></span>
        ${cartOnline ? "Cart app is online" : "Cart app is offline"}
      </div>
      <div class="total">
        <strong>€${escapeHtml(summary?.total ?? 0)}</strong> · ${escapeHtml(items(count))}
        <div class="muted">${cartOnline ? "Kept up to date by the cart's events" : "Waiting for the cart"}</div>
      </div>
      <button id="order" ${canOrder ? "" : "disabled"}>${busy ? "Confirming with cart…" : "Place order"}</button>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      ${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}
    `;

    this.shadowRoot.querySelector("#order")?.addEventListener("click", () => this.placeOrder());
  }
}

if (!customElements.get("js-mfe")) {
  customElements.define("js-mfe", JsMfe);
}

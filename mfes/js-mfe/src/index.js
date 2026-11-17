// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

const CART_ID = "react-mfe";

// Messages come from other apps, so never insert them into HTML unescaped.
const items = (n) => `${n} ${n === 1 ? "item" : "items"}`;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const STYLES = `
  :host { display: block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color: var(--text, #171a20); }
  .status { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary, #5a6578); margin-bottom: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok, #15803d); }
  .dot.off { background: transparent; border: 1.5px solid var(--text-secondary, #5a6578); }
  .total { padding: 12px 14px; border-radius: 8px; background: var(--surface, #f7f8fa); margin-bottom: 12px; }
  .total strong { font-size: 24px; letter-spacing: -0.02em; }
  .muted { color: var(--text-secondary, #5a6578); font-size: 13px; }
  button { font: inherit; font-size: 14px; font-weight: 600; padding: 8px 18px; border-radius: 9999px; cursor: pointer; border: 0; color: #fff; background: #c2410c; transition: background-color 150ms; }
  button:hover:not(:disabled) { background: #9a3412; }
  button:focus-visible { outline: 2px solid #0495d4; outline-offset: 3px; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .error { margin: 12px 0 0; color: var(--danger, #c92a2a); font-size: 14px; }
  .note { margin: 12px 0 0; font-size: 14px; color: var(--text-secondary, #5a6578); }
  .announce { display: flex; flex-direction: column; gap: 2px; margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; font-size: 14px; background:rgba(4,149,212,0.07); border:1px solid rgba(4,149,212,0.3); animation: announce-in 250ms ease-out; }
  .from { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent, #006ca0); }
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
    this.bus = connect({
      id: "js-mfe",
      name: "Checkout",
      version: "1.0.0",
      meta: { framework: "Plain JavaScript", element: "Native Web Component" },
    });

    // Events keep the total current: the cart announces every change.
    this.bus.subscribe("cart:updated", (msg) => this.update({ summary: msg.payload, error: null }));
    this.bus.subscribe("portal:announcement", (msg) =>
      this.showBanner({ from: "the shell portal", direct: msg.to === "js-mfe", text: String(msg.payload?.text ?? "") })
    );
    // A direct message from the cart: only checkout receives it.
    this.bus.subscribe("checkout:start", (msg) => {
      const { count, total } = msg.payload;
      this.update({ summary: { count, total } });
      this.showBanner({ from: "the shopping cart", direct: true, text: `Ready to check out ${items(count)}, €${total}.` });
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

  showBanner(announcement) {
    this.update({ announcement });
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => this.update({ announcement: null }), 6000);
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
      const error = err.code === "timeout" ? "The cart did not confirm in time. The order was not placed." : err.message;
      this.update({ busy: false, error });
    }
  }

  render() {
    const { cartOnline, summary, busy, error, note, announcement } = this.state;
    const count = summary?.count ?? 0;
    const canOrder = cartOnline && count > 0 && !busy;

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      ${announcement ? `<div class="announce" role="status"><span class="from">From ${escapeHtml(announcement.from)}${announcement.direct ? " · only to you" : ""}</span>${escapeHtml(announcement.text)}</div>` : ""}
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

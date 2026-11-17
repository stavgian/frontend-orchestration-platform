// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

// Messages come from other apps, so never insert them into HTML unescaped.
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

class JsMfe extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = { last: null, peers: [] };
    this.bus = null;
  }

  connectedCallback() {
    this.bus = connect({ id: "js-mfe", name: "JavaScript app", version: "1.0.0" });
    this.bus.subscribe("*", (msg) => {
      if (typeof msg.payload?.text !== "string") return;
      this.state.last = { text: msg.payload.text, from: msg.source, type: msg.type };
      this.render();
    });
    this.bus.onPeersChange((peers) => {
      this.state.peers = peers;
      this.render();
    });
    this.render();
  }

  disconnectedCallback() {
    this.bus?.disconnect();
    this.bus = null;
  }

  render() {
    const { shadowRoot } = this;
    if (!shadowRoot) return;

    const { last, peers } = this.state;
    const peerNames = peers.map((p) => p.id).join(", ") || "nobody yet";
    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: #f7f9fc;
          font-family: "Inter", system-ui, sans-serif;
        }
        .card {
          background: linear-gradient(180deg, #111827, #0b1220);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.25);
        }
        .title { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
        .subtitle { color: #9fb1c9; margin: 0 0 12px; font-size: 13px; }
        button {
          margin-top: 12px;
          background: linear-gradient(90deg, #6bdcff, #9b8cff);
          border: 1px solid rgba(255,255,255,0.08);
          color: #0b1220;
          font-weight: 700;
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(107, 220, 255, 0.12);
        }
        .note { margin-top: 10px; color: #9fb1c9; font-size: 12px; }
      </style>
      <div class="card">
        <p class="title">JS MFE</p>
        <p class="subtitle">Says hi and listens to every message</p>
        <button id="hi">Say hi to everyone</button>
        ${last ? `<div class="note">Last heard: ${escapeHtml(last.text)} (${escapeHtml(last.from)} · ${escapeHtml(last.type)})</div>` : ''}
        <div class="note">Connected with: ${escapeHtml(peerNames)}</div>
      </div>
    `;

    const hiBtn = shadowRoot.querySelector("#hi");
    if (hiBtn) {
      hiBtn.addEventListener("click", () => {
        this.bus?.publish("chat:hello", { text: "Hi from JS MFE — hope you see this!" });
      });
    }
  }
}

if (!customElements.get("js-mfe")) {
  customElements.define("js-mfe", JsMfe);
}

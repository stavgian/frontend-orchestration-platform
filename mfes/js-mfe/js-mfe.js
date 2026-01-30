(() => {
  const EVENT_NAMES = {
    statusMessage: "statusMessage",
  };

  const requiredFields = {
    [EVENT_NAMES.statusMessage]: ["text"],
  };

  const target = window;

  function validate(eventName, payload) {
    const missing = requiredFields[eventName].filter(
      (key) => typeof payload[key] !== "string" || !payload[key]
    );
    if (missing.length) {
      throw new Error(
        `Invalid payload for ${eventName}: missing string fields ${missing.join(",")}`
      );
    }
  }

  function publish(eventName, payload) {
    validate(eventName, payload);
    const evt = new CustomEvent(eventName, { detail: payload });
    target.dispatchEvent(evt);
  }

  function subscribe(eventName, handler) {
    const listener = (event) => {
      try {
        validate(eventName, event.detail);
        handler(event.detail);
      } catch (err) {
        console.warn(err);
      }
    };
    target.addEventListener(eventName, listener);
    return () => target.removeEventListener(eventName, listener);
  }

  class JsMfe extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.state = { lastStatus: null };
      this.unsubscribeStatus = null;
    }

    connectedCallback() {
      this.render();
      this.unsubscribeStatus = subscribe(EVENT_NAMES.statusMessage, (msg) => {
        this.state.lastStatus = msg;
        this.render();
      });
    }

    disconnectedCallback() {
      if (this.unsubscribeStatus) this.unsubscribeStatus();
    }

    render() {
      const { shadowRoot } = this;
      if (!shadowRoot) return;

      const status = this.state.lastStatus;
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
          <p class="subtitle">Says hi and listens to status messages</p>
          <button id="hi">Say hi to everyone</button>
          ${status ? `<div class="note">Last heard: ${status.text} (${status.source || 'unknown'})</div>` : ''}
        </div>
      `;

      const hiBtn = shadowRoot.querySelector("#hi");
      if (hiBtn) {
        hiBtn.addEventListener("click", () => {
          publish(EVENT_NAMES.statusMessage, {
            text: "Hi from JS MFE — hope you see this!",
            source: "js-mfe",
            emittedAt: new Date().toISOString(),
          });
        });
      }
    }
  }

  if (!customElements.get("js-mfe")) {
    customElements.define("js-mfe", JsMfe);
  }
})();

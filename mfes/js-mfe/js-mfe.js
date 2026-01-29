(() => {
  const EVENT_NAMES = {
    customerSelected: "customerSelected",
    ticketCreated: "ticketCreated",
  };

  const requiredFields = {
    [EVENT_NAMES.customerSelected]: ["customerId", "name"],
    [EVENT_NAMES.ticketCreated]: ["ticketId", "customerId"],
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
      this.state = { customer: null };
      this.unsubscribe = null;
    }

    connectedCallback() {
      this.render();
      this.unsubscribe = subscribe(EVENT_NAMES.customerSelected, (customer) => {
        this.state.customer = customer;
        this.render();
      });
    }

    disconnectedCallback() {
      if (this.unsubscribe) this.unsubscribe();
    }

    render() {
      const { shadowRoot } = this;
      if (!shadowRoot) return;

      const customer = this.state.customer;
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
          .details { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1); }
          button {
            margin-top: 12px;
            background: linear-gradient(90deg, #6bdcff, #9b8cff);
            border: none;
            color: #0b1220;
            font-weight: 700;
            padding: 10px 14px;
            border-radius: 10px;
            cursor: pointer;
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        </style>
        <div class="card">
          <p class="title">JS MFE</p>
          <p class="subtitle">Listens for customerSelected, publishes ticketCreated</p>
          ${customer ? `
            <div class="details">
              <div><strong>ID:</strong> ${customer.customerId}</div>
              <div><strong>Name:</strong> ${customer.name}</div>
            </div>
            <button id="create">Create ticket</button>
          ` : `
            <div class="details">No customer selected yet.</div>
            <button id="create" disabled>Create ticket</button>
          `}
        </div>
      `;

      const btn = shadowRoot.querySelector("#create");
      if (btn && customer) {
        btn.addEventListener("click", () => {
          const ticketId = `TCK-${Date.now().toString(36)}-${Math.floor(
            Math.random() * 1000
          )}`;
          publish(EVENT_NAMES.ticketCreated, {
            ticketId,
            customerId: customer.customerId,
          });
        });
      }
    }
  }

  if (!customElements.get("js-mfe")) {
    customElements.define("js-mfe", JsMfe);
  }
})();

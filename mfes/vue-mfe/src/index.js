// Shipping: a small Vue app. It only listens: the cart's events tell it everything it needs.
import { computed, defineCustomElement, h, onMounted, onUnmounted, ref, version } from "vue";
// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

const FREE_SHIPPING_FROM = 50;

const STYLES = `
  :host { display: block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color: var(--text, #171a20); }
  .intro { margin: 0 0 12px; color: var(--text-secondary, #5a6578); font-size: 14px; }
  .goal { padding: 12px 14px; border-radius: 8px; background: var(--surface, #f7f8fa); }
  .goal strong { font-size: 17px; }
  .bar { height: 8px; margin-top: 10px; border-radius: 9999px; background: var(--border, #e5e7eb); overflow: hidden; }
  .fill { height: 100%; border-radius: inherit; background: #1e7a3c; transition: width 300ms ease; }
  .note { margin: 12px 0 0; font-size: 14px; color: var(--text-secondary, #5a6578); }
`;

const ShippingApp = {
  setup() {
    const total = ref(0);
    const note = ref(null);
    let bus;

    const remaining = computed(() => Math.max(0, FREE_SHIPPING_FROM - total.value));
    const progress = computed(() => Math.min(100, (total.value / FREE_SHIPPING_FROM) * 100));

    onMounted(() => {
      bus = connect({
        id: "vue-mfe",
        name: "Shipping",
        version: "1.0.0",
        // Read at runtime, so the shell shows the version this bundle really ships.
        meta: { framework: `Vue ${version}`, element: "Vue defineCustomElement" },
      });
      bus.subscribe("cart:updated", (msg) => {
        total.value = msg.payload.total;
        // The cart empties itself after an order; keep the order note until a new basket starts.
        if (msg.payload.count > 0) note.value = null;
      });
      bus.subscribe("order:placed", (msg) => {
        const free = msg.payload.total >= FREE_SHIPPING_FROM;
        note.value = `Order received. It ships within two days${free ? ", free of charge" : ""}.`;
      });
    });

    onUnmounted(() => {
      bus?.disconnect();
    });

    return () => [
      h("p", { class: "intro" }, `Listens to the cart. Free shipping from €${FREE_SHIPPING_FROM}.`),
      h("div", { class: "goal" }, [
        remaining.value === 0
          ? h("strong", "Free shipping unlocked.")
          : [h("strong", `€${remaining.value}`), " to go for free shipping"],
        h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(progress.value) }, [
          h("div", { class: "fill", style: { width: `${progress.value}%` } }),
        ]),
      ]),
      note.value && h("p", { class: "note" }, note.value),
    ];
  },
  styles: [STYLES],
};

if (!customElements.get("vue-mfe")) {
  customElements.define("vue-mfe", defineCustomElement(ShippingApp));
}

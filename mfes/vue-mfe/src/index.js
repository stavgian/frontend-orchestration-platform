// Finance: a small Vue app. It owns time entries and billing for the active context and
// announces every change with an event; it knows nothing about who listens.
import { computed, defineCustomElement, h, onMounted, onUnmounted, reactive, ref, version } from "vue";
// The only thing this app shares with the others: the published message library.
import { connect } from "@stavgian/mfe-communication";

const RATE = 250;
// Fictional time entries, keyed by the context id the shell announces.
const INITIAL = {
  "CASE-2026-1082": [{ who: "A. Marlowe", hours: 6.5 }, { who: "T. Brandt", hours: 3 }],
  "CASE-2026-1083": [{ who: "J. Okafor", hours: 4 }],
  "CASE-2026-1084": [{ who: "S. Lindqvist", hours: 12 }, { who: "R. Hale", hours: 8.5 }],
  "CASE-2026-1085": [{ who: "M. Duarte", hours: 5 }],
  "CASE-2026-1086": [{ who: "K. Brennan", hours: 7.5 }, { who: "T. Brandt", hours: 2 }],
};

const STYLES = `
  :host { display: block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color: var(--text, #171a20); }
  .ctx { margin: 0 0 10px; font-size: 13px; color: var(--text-secondary, #5a6578); }
  ul { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
  li { display: flex; gap: 10px; padding: 8px 12px; border-radius: 8px; background: var(--surface, #f7f8fa); font-size: 14px; }
  li span:first-child { flex: 1; }
  .total { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .total strong { font-size: 20px; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 9999px; cursor: pointer; border: 0; color: #fff; background: #1e7a3c; }
  button:focus-visible { outline: 2px solid #0495d4; outline-offset: 3px; }
  .empty { margin: 0; padding: 18px 12px; text-align: center; color: var(--text-secondary, #5a6578); font-size: 14px; border-radius: 8px; border: 2px dashed var(--border, #e5e7eb); }
`;

const FinanceApp = {
  setup() {
    const ctx = ref(null);
    // Local state: time entries per context id.
    const entries = reactive({});
    let bus;

    const list = (id) => (entries[id] ??= [...(INITIAL[id] ?? [])]);
    const current = computed(() => (ctx.value ? list(ctx.value.contextId) : []));
    const hours = computed(() => current.value.reduce((sum, e) => sum + e.hours, 0));

    const logTime = () => {
      const id = ctx.value.contextId;
      list(id).push({ who: "You", hours: 1.5 });
      const total = list(id).reduce((sum, e) => sum + e.hours, 0);
      bus.publish("billing:updated", { contextId: id, hours: 1.5, totalHours: total, amount: total * RATE, text: `Logged 1.5 h, ${total} h billed in total` });
    };

    onMounted(() => {
      bus = connect({
        id: "vue-mfe",
        name: "Finance",
        version: "1.0.0",
        // Read at runtime, so the shell shows the version this bundle really ships.
        meta: { framework: `Vue ${version}`, element: "Vue defineCustomElement" },
      });
      // Follow the portal's active context; ask once in case it was announced before this app loaded.
      bus.subscribe("context:changed", (msg) => (ctx.value = msg.payload));
      bus.request("context:get", undefined, { to: "portal" }).then((c) => c && (ctx.value = c), () => {});
    });

    onUnmounted(() => bus?.disconnect());

    return () =>
      ctx.value
        ? [
            h("p", { class: "ctx" }, `Context ${ctx.value.contextId}`),
            h("ul", current.value.map((e, i) => h("li", { key: i }, [h("span", e.who), h("span", `${e.hours} h`)]))),
            h("div", { class: "total" }, [
              h("span", [h("strong", `€${(hours.value * RATE).toLocaleString("en")}`), ` · ${hours.value} h billed`]),
              h("button", { onClick: logTime }, "Log 1.5 h"),
            ]),
          ]
        : h("p", { class: "empty" }, "Waiting for a context from the portal…");
  },
  styles: [STYLES],
};

if (!customElements.get("vue-mfe")) {
  customElements.define("vue-mfe", defineCustomElement(FinanceApp));
}

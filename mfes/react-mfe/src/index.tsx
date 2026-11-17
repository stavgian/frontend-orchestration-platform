import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

// The only thing this app shares with the others: the published message library.
import { Connection, connect } from '@stavgian/mfe-communication';

// The messages this app understands. Other apps declare their own; nothing is shared but the names.
type Item = { sku: string; name: string; price: number };
type Summary = { count: number; total: number };

declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'cart:item-added': Item;
    /** Published after every change, so other apps can stay in sync without asking. */
    'cart:updated': Summary;
    'order:placed': Summary;
    /** Sent only to checkout (a direct message), when the shopper is ready to pay. */
    'checkout:start': Summary;
  }
  interface RequestMap {
    'cart:get-summary': { request: void; response: Summary };
  }
}

type Line = Item & { qty: number };

const summarize = (lines: Line[]): Summary => ({
  count: lines.reduce((n, l) => n + l.qty, 0),
  total: lines.reduce((sum, l) => sum + l.qty * l.price, 0),
});

const App: React.FC = () => {
  const [bus, setBus] = useState<Connection | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // The responder reads the latest cart without re-registering on every change.
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    const connection = connect({
      id: 'react-mfe',
      name: 'Shopping cart',
      version: '1.0.0',
      meta: { framework: `React ${React.version}`, element: 'React root in a custom element' },
    });

    connection.subscribe('cart:item-added', ({ payload: item }) => {
      setNote(null);
      setLines((current) => {
        const existing = current.find((l) => l.sku === item.sku);
        return existing
          ? current.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
          : [...current, { ...item, qty: 1 }];
      });
    });
    connection.subscribe('order:placed', ({ payload }) => {
      setLines([]);
      setNote(`Order placed: ${payload.count} ${payload.count === 1 ? 'item' : 'items'}, €${payload.total}. Cart emptied.`);
    });

    // Answer questions from other apps, e.g. the checkout asking for the total.
    connection.respond('cart:get-summary', () => summarize(linesRef.current));

    setBus(connection);
    return () => {
      connection.disconnect();
    };
  }, []);

  // Tell everyone whenever the cart changes (not on first render: nothing changed yet).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bus?.publish('cart:updated', summarize(lines));
  }, [lines]);

  const clear = () => setLines([]);
  // A direct message: only the checkout app receives it, the catalog never sees it.
  const proceed = () => {
    bus?.publish('checkout:start', summarize(lines), { to: 'js-mfe' });
    setNote('Sent your cart to checkout only.');
  };

  const { count, total } = summarize(lines);

  return (
    <div style={styles.root}>
      {lines.length === 0 ? (
        <p style={styles.empty}>Your cart is empty. Add something from the catalog.</p>
      ) : (
        <ul style={styles.list}>
          {lines.map((l) => (
            <li key={l.sku} style={styles.line}>
              <span style={styles.qty}>{l.qty}×</span>
              <span style={{ flex: 1 }}>{l.name}</span>
              <span style={styles.muted}>€{l.qty * l.price}</span>
            </li>
          ))}
        </ul>
      )}
      <div style={styles.footer}>
        <span>
          <strong>{count}</strong> {count === 1 ? 'item' : 'items'} · <strong>€{total}</strong>
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button style={styles.button} onClick={clear} disabled={!lines.length}>
            Clear
          </button>
          <button style={styles.primary} onClick={proceed} disabled={!lines.length}>
            Checkout →
          </button>
        </span>
      </div>
      {note && <p style={styles.note}>{note}</p>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: { font: '15px/1.5 var(--font-sans, Inter, system-ui, sans-serif)', color: 'var(--text, #171a20)' },
  empty: { margin: 0, padding: '18px 12px', textAlign: 'center', color: 'var(--text-secondary, #5a6578)', fontSize: 14, borderRadius: 8, border: '1px dashed var(--border, #e5e7eb)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  line: { display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--surface, #f7f8fa)' },
  qty: { color: '#6741d9', fontWeight: 700, minWidth: 24 },
  muted: { color: 'var(--text-secondary, #5a6578)', fontVariantNumeric: 'tabular-nums' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  button: { font: 'inherit', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 9999, cursor: 'pointer', color: 'var(--text-secondary, #5a6578)', background: '#fff', border: '1px solid var(--border, #e5e7eb)' },
  note: { margin: '12px 0 0', fontSize: 14, color: 'var(--text-secondary, #5a6578)' },
  primary: { font: 'inherit', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 9999, cursor: 'pointer', color: '#fff', background: '#6741d9', border: 0 },
};

class ReactMfeElement extends HTMLElement {
  root?: Root;
  container?: HTMLElement;

  connectedCallback() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.attachShadow({ mode: 'open' }).appendChild(this.container);
    }
    this.root = createRoot(this.container);
    this.root.render(<App />);
  }

  disconnectedCallback() {
    this.root?.unmount();
  }
}

if (!customElements.get('react-mfe')) {
  customElements.define('react-mfe', ReactMfeElement);
}

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
  const [announcement, setAnnouncement] = useState<{ text: string; direct: boolean } | null>(null);
  // The responder reads the latest cart without re-registering on every change.
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    const connection = connect({ id: 'react-mfe', name: 'Shopping cart', version: '1.0.0' });

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
    let announceTimer: ReturnType<typeof setTimeout> | undefined;
    connection.subscribe('portal:announcement', (msg) => {
      setAnnouncement({ text: (msg.payload as { text: string }).text, direct: msg.to === 'react-mfe' });
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => setAnnouncement(null), 6000);
    });

    // Answer questions from other apps, e.g. the checkout asking for the total.
    connection.respond('cart:get-summary', () => summarize(linesRef.current));

    setBus(connection);
    return () => {
      clearTimeout(announceTimer);
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
      <style>{'@keyframes announce-in { from { opacity: 0; transform: translateY(-4px); } }'}</style>
      {announcement && (
        <div style={styles.announce} role="status">
          <span style={styles.from}>📣 From the shell portal{announcement.direct ? ' · only to you' : ''}</span>
          {announcement.text}
        </div>
      )}
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
  root: { font: '14px/1.45 Inter, system-ui, sans-serif', color: '#e9eef5' },
  empty: { margin: 0, padding: '18px 12px', textAlign: 'center', color: '#94a3b6', fontSize: 13, borderRadius: 12, border: '1px dashed rgba(255,255,255,0.14)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  line: { display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' },
  qty: { color: '#61dafb', fontWeight: 700, minWidth: 24 },
  muted: { color: '#94a3b6', fontVariantNumeric: 'tabular-nums' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  button: { font: 'inherit', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', color: '#e9eef5', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' },
  note: { margin: '12px 0 0', fontSize: 13, color: '#94a3b6' },
  primary: { font: 'inherit', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', color: '#0a0f16', background: '#61dafb', border: 0 },
  announce: { display: 'flex', flexDirection: 'column', gap: 2, margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, fontSize: 13, background: 'rgba(182,243,107,0.08)', border: '1px solid rgba(182,243,107,0.3)', animation: 'announce-in 250ms ease-out' },
  from: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b6f36b' },
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

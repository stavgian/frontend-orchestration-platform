import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

// The only thing this app shares with the others: the published message library.
import { Connection, connect } from '@stavgian/mfe-communication';

type Context = { contextType: string; contextId: string; routeId: string; correlationId?: string };
type Doc = { name: string; kind: 'contract' | 'evidence' | 'correspondence' };

// The messages this app understands. Other apps declare their own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'context:changed': Context;
    'document:uploaded': { contextId: string; text?: string } & Doc;
  }
  interface RequestMap {
    'context:get': { request: void; response: Context | null };
  }
}

// Fictional documents, keyed by the context id the shell announces.
const INITIAL: Record<string, Doc[]> = {
  'CASE-2026-1082': [
    { name: 'Supply agreement 2024.pdf', kind: 'contract' },
    { name: 'Delivery log Q3.xlsx', kind: 'evidence' },
  ],
  'CASE-2026-1083': [
    { name: 'Employment contract.pdf', kind: 'contract' },
    { name: 'Termination letter.pdf', kind: 'correspondence' },
  ],
  'CASE-2026-1084': [{ name: 'Share purchase draft v3.docx', kind: 'contract' }],
  'CASE-2026-1085': [{ name: 'Trademark registration.pdf', kind: 'evidence' }, { name: 'Cease-and-desist letter.pdf', kind: 'correspondence' }],
  'CASE-2026-1086': [{ name: 'Authority information request.pdf', kind: 'correspondence' }],
};
// What the "Upload" button adds, in turn.
const SAMPLE_UPLOADS: Doc[] = [
  { name: 'Witness statement.pdf', kind: 'evidence' },
  { name: 'Email thread export.eml', kind: 'correspondence' },
  { name: 'Amendment no. 2.pdf', kind: 'contract' },
];

const App: React.FC = () => {
  const [bus, setBus] = useState<Connection | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  // Local state: documents added during this session, per context id.
  const [added, setAdded] = useState<Record<string, Doc[]>>({});

  useEffect(() => {
    const connection = connect({
      id: 'react-mfe',
      name: 'Documents',
      version: '1.0.0',
      meta: { framework: `React ${React.version}`, element: 'React root in a custom element' },
    });
    // Follow the portal's active context; ask once in case it was announced before this app loaded.
    connection.subscribe('context:changed', ({ payload }) => setCtx(payload));
    connection.request('context:get', undefined, { to: 'portal' }).then((c) => c && setCtx(c), () => undefined);
    setBus(connection);
    return () => connection.disconnect();
  }, []);

  if (!ctx) return <p style={styles.empty}>Waiting for a context from the portal…</p>;

  const mine = added[ctx.contextId] ?? [];
  const docs = [...(INITIAL[ctx.contextId] ?? []), ...mine];

  const upload = () => {
    const doc = SAMPLE_UPLOADS[mine.length % SAMPLE_UPLOADS.length];
    setAdded({ ...added, [ctx.contextId]: [...mine, doc] });
    // An event: whoever cares (compliance, risk, client relations) reacts.
    bus?.publish('document:uploaded', { contextId: ctx.contextId, ...doc, text: `Added "${doc.name}"` });
  };

  return (
    <div style={styles.root}>
      <p style={styles.ctx}>Context <code>{ctx.contextId}</code> · {docs.length} documents</p>
      <ul style={styles.list}>
        {docs.map((d, i) => (
          <li key={`${d.name}-${i}`} style={styles.line}>
            <span style={{ flex: 1 }}>{d.name}</span>
            <span style={styles.kind}>{d.kind}</span>
          </li>
        ))}
      </ul>
      <button style={styles.primary} onClick={upload}>Upload document</button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: { font: '15px/1.5 var(--font-sans, Inter, system-ui, sans-serif)', color: 'var(--text, #171a20)' },
  ctx: { margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary, #5a6578)' },
  empty: { margin: 0, padding: '18px 12px', textAlign: 'center', color: 'var(--text-secondary, #5a6578)', fontSize: 14, borderRadius: 8, border: '2px dashed var(--border, #e5e7eb)' },
  list: { listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 6 },
  line: { display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--surface, #f7f8fa)', fontSize: 14 },
  kind: { color: '#6741d9', fontSize: 12, fontWeight: 600 },
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

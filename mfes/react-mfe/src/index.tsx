import React, { useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

type Customer = { customerId: string; name: string };

const EVENT_NAMES = {
  customerSelected: 'customerSelected',
} as const;

const requiredFields: Record<string, string[]> = {
  [EVENT_NAMES.customerSelected]: ['customerId', 'name'],
};

function validate(eventName: string, payload: Record<string, unknown>) {
  const missing = requiredFields[eventName]?.filter(
    (key) => typeof payload[key] !== 'string' || !payload[key]
  );
  if (missing?.length) {
    throw new Error(
      `Invalid payload for ${eventName}: missing string fields ${missing.join(',')}`
    );
  }
}

function publishCustomerSelected(payload: Customer) {
  validate(EVENT_NAMES.customerSelected, payload);
  window.dispatchEvent(
    new CustomEvent<Customer>(EVENT_NAMES.customerSelected, { detail: payload })
  );
}

const App: React.FC = () => {
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [last, setLast] = useState<Customer | null>(null);

  const disabled = !customerId || !name;

  const handleSelect = () => {
    const payload = {
      customerId: customerId.trim(),
      name: name.trim(),
      source: 'react-mfe',
      emittedAt: new Date().toISOString(),
    };
    publishCustomerSelected(payload);
    setLast(payload);
  };

  return (
    <div style={styles.card}>
      <p style={styles.title}>React MFE</p>
      <p style={styles.subtitle}>
        Emits <code>customerSelected</code> via window CustomEvent
      </p>

      <div style={styles.field}>
        <label style={styles.label}>Customer ID</label>
        <input
          style={styles.input}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="123"
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Name</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada Lovelace"
        />
      </div>

      <button style={styles.button(disabled)} disabled={disabled} onClick={handleSelect}>
        Select customer
      </button>

      {last && (
        <div style={styles.lastBox}>
          <div style={styles.lastTitle}>Last emitted</div>
          <div>ID: {last.customerId}</div>
          <div>Name: {last.name}</div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, any> = {
  card: {
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#f6f8fb',
    background: 'linear-gradient(180deg, #101827, #0b1220)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
    width: '100%',
    boxSizing: 'border-box',
  },
  title: { margin: '0 0 6px', fontSize: 16, fontWeight: 700 },
  subtitle: { margin: '0 0 14px', color: '#9fb1c9', fontSize: 13 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  label: { fontSize: 12, color: '#b7c6da' },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#f6f8fb',
  },
  button: (disabled: boolean) => ({
    marginTop: 4,
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 700,
    color: '#0b1220',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: 'linear-gradient(90deg, #6bdcff, #9b8cff)',
  }),
  lastBox: {
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    border: '1px dashed rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#dce7f5',
    fontSize: 13,
  },
  lastTitle: { fontWeight: 700, marginBottom: 4 },
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

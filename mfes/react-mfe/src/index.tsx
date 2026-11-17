import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

// The only thing this app shares with the others: the published message library.
import { Connection, PeerInfo, connect } from '@stavgian/mfe-communication';

// The messages this app sends. Other apps declare their own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'chat:hello': { text: string };
  }
}

type Heard = { text: string; from: string; type: string };

const App: React.FC = () => {
  const [bus, setBus] = useState<Connection | null>(null);
  const [lastHeard, setLastHeard] = useState<Heard | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  // Connect on mount; disconnect() on unmount announces we left and removes every subscription.
  useEffect(() => {
    const connection = connect({ id: 'react-mfe', name: 'React app', version: '1.0.0' });
    connection.subscribe('*', (msg) => {
      const text = (msg.payload as { text?: unknown } | undefined)?.text;
      if (typeof text === 'string') setLastHeard({ text, from: msg.source, type: msg.type });
    });
    connection.onPeersChange(setPeers);
    setBus(connection);
    return () => connection.disconnect();
  }, []);

  const handleHi = () => {
    bus?.publish('chat:hello', { text: 'Hi from React MFE — saying hello to everyone!' });
  };

  return (
    <div style={styles.card}>
      <p style={styles.title}>React MFE</p>
      <p style={styles.subtitle}>Says hi and listens to every message.</p>

      <button style={styles.secondaryButton} onClick={handleHi}>
        Say hi to everyone
      </button>

      {lastHeard && (
        <div style={styles.lastBox}>
          <div style={styles.lastTitle}>Last heard</div>
          <div>{lastHeard.text}</div>
          <div style={{ color: '#9fb1c9', fontSize: 12 }}>
            from {lastHeard.from} · {lastHeard.type}
          </div>
        </div>
      )}
      <div style={styles.lastBox}>Connected with: {peers.map((p) => p.id).join(', ') || 'nobody yet'}</div>
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
  button: {
    marginTop: 4,
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 700,
    color: '#0b1220',
    cursor: 'pointer',
    background: 'linear-gradient(90deg, #6bdcff, #9b8cff)',
  },
  lastBox: {
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    background: 'transparent',
    color: '#9fb1c9',
    fontSize: 12,
  },
  lastTitle: { fontWeight: 700, marginBottom: 4 },
  secondaryButton: {
    marginTop: 12,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(90deg, #6bdcff, #9b8cff)',
    color: '#0b1220',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 24px rgba(107, 220, 255, 0.12)',
  },
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

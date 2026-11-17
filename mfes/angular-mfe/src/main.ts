import 'zone.js';
// Ensure the JIT compiler is available when running the bundle outside Angular CLI.
import '@angular/compiler';
import { CommonModule } from '@angular/common';
import {
  ApplicationRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
// The only thing this app shares with the others: the published message library.
import { Connection, Message, PeerInfo, connect } from '@stavgian/mfe-communication';

// The messages this app sends. Other apps declare their own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'chat:hello': { text: string };
  }
}

@Component({
  selector: 'angular-mfe-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <p class="title">Angular MFE</p>
      <p class="subtitle">Says hi and listens to every message.</p>

      <button class="btn ghost" (click)="sayHi()">Say hi to everyone</button>
      <div class="note" *ngIf="last">Last heard: {{ last.text }} ({{ last.from }} · {{ last.type }})</div>
      <div class="note">Connected with: {{ peerNames || 'nobody yet' }}</div>
    </div>
  `,
  styles: [
    `:host { display:block; font-family: 'Inter', system-ui, sans-serif; color:#f6f8fb; }
     .card { background: linear-gradient(180deg, #101827, #0b1220); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; box-shadow:0 12px 30px rgba(0,0,0,0.25); }
     .title { margin:0 0 6px; font-weight:700; font-size:16px; }
     .subtitle { margin:0 0 12px; color:#9fb1c9; font-size:13px; }
     .btn { margin-top:12px; padding:10px 14px; border:none; border-radius:10px; font-weight:700; color:#0b1220; background:linear-gradient(90deg, #6bdcff, #9b8cff); cursor:pointer; }
     .note { margin-top:10px; color:#9fb1c9; font-size:12px; }
    `,
  ],
})
class AngularMfeComponent implements OnInit, OnDestroy {
  private bus?: Connection;
  last?: { text: string; from: string; type: string };
  peerNames = '';

  ngOnInit(): void {
    this.bus = connect({ id: 'angular-mfe', name: 'Angular app', version: '1.0.0' });
    this.bus.subscribe('*', (msg: Message) => {
      const text = (msg.payload as { text?: unknown } | undefined)?.text;
      if (typeof text === 'string') this.last = { text, from: msg.source, type: msg.type };
    });
    this.bus.onPeersChange((peers: PeerInfo[]) => {
      this.peerNames = peers.map((p) => p.id).join(', ');
    });
  }

  ngOnDestroy(): void {
    this.bus?.disconnect();
  }

  sayHi() {
    this.bus?.publish('chat:hello', { text: 'Hi from Angular MFE — waving at everyone!' });
  }
}

async function defineAngularElement() {
  if (customElements.get('angular-mfe')) return;
  const app = await createApplication({ providers: [] });
  const element = createCustomElement(AngularMfeComponent, {
    injector: app.injector,
  });
  customElements.define('angular-mfe', element);
}

async function bootstrap() {
  await defineAngularElement();
}

// Expose Module Federation-like container expected by the portal loader
const moduleMap: Record<string, any> = {
  './bootstrap': { default: bootstrap },
};

const container = {
  __initialized: false,
  async init(_shareScope?: unknown) {
    if (this.__initialized) return;
    this.__initialized = true;
  },
  async get(request: string) {
    if (!moduleMap[request]) {
      throw new Error(`Module ${request} not found in angular-mfe remote`);
    }
    return () => moduleMap[request];
  },
};

// Attach to window under the conventional remote name
if (!(globalThis as any).angularMfe) {
  (globalThis as any).angularMfe = container;
}

// Auto-bootstrap when loaded directly (useful for local testing outside portal)
void bootstrap();

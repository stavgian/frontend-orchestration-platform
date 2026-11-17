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
import { Connection, connect } from '@stavgian/mfe-communication';

// The messages this app sends. Other apps declare their own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'cart:item-added': { sku: string; name: string; price: number };
  }
}

const PRODUCTS = [
  { sku: 'mug', name: 'Coffee mug', emoji: '☕', price: 12 },
  { sku: 'tee', name: 'T-shirt', emoji: '👕', price: 25 },
  { sku: 'cap', name: 'Cap', emoji: '🧢', price: 18 },
];

@Component({
  selector: 'angular-mfe-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="announce" *ngIf="announcement" role="status">
      <span class="from">📣 From the portal</span>{{ announcement }}
    </div>
    <p class="intro">Pick a product. The catalog announces it; whoever cares (the cart) reacts.</p>
    <ul class="products">
      <li *ngFor="let p of products">
        <span class="emoji" aria-hidden="true">{{ p.emoji }}</span>
        <span class="name">{{ p.name }}</span>
        <span class="price">€{{ p.price }}</span>
        <button type="button" (click)="add(p)" [class.done]="justAdded === p.sku">
          {{ justAdded === p.sku ? 'Added ✓' : 'Add to cart' }}
        </button>
      </li>
    </ul>
  `,
  styles: [
    `:host { display:block; font: 14px/1.45 Inter, system-ui, sans-serif; color:#e9eef5; }
     .intro { margin:0 0 12px; color:#94a3b6; font-size:13px; }
     .products { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
     li { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,0.04); }
     .emoji { font-size:20px; }
     .name { flex:1; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
     .price { color:#94a3b6; font-variant-numeric:tabular-nums; }
     button { font:inherit; font-size:13px; font-weight:600; padding:6px 10px; border-radius:999px; cursor:pointer; border:0; color:#0a0f16; background:#ff6b8b; min-width:96px; flex:none; transition:background 150ms; }
     button:hover { background:#ff8aa3; }
     button.done { background:#4ade80; }
     .announce { display:flex; flex-direction:column; gap:2px; margin:0 0 12px; padding:10px 12px; border-radius:12px; font-size:13px; background:rgba(182,243,107,0.08); border:1px solid rgba(182,243,107,0.3); animation:announce-in 250ms ease-out; }
     .from { font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#b6f36b; }
     @keyframes announce-in { from { opacity:0; transform:translateY(-4px); } }
    `,
  ],
})
class AngularMfeComponent implements OnInit, OnDestroy {
  private bus?: Connection;
  private timer?: ReturnType<typeof setTimeout>;
  private announceTimer?: ReturnType<typeof setTimeout>;
  readonly products = PRODUCTS;
  justAdded?: string;
  announcement?: string;

  ngOnInit(): void {
    this.bus = connect({ id: 'angular-mfe', name: 'Product catalog', version: '1.0.0' });
    this.bus.subscribe('portal:announcement', (msg) => {
      this.announcement = (msg.payload as { text: string }).text;
      clearTimeout(this.announceTimer);
      this.announceTimer = setTimeout(() => (this.announcement = undefined), 6000);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    clearTimeout(this.announceTimer);
    this.bus?.disconnect();
  }

  add(product: (typeof PRODUCTS)[number]) {
    this.bus?.publish('cart:item-added', { sku: product.sku, name: product.name, price: product.price });
    this.justAdded = product.sku;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.justAdded = undefined), 1200);
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

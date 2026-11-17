// Ensure the JIT compiler is available when running the bundle outside Angular CLI.
import '@angular/compiler';
import {
  ApplicationRef,
  Component,
  OnDestroy,
  OnInit,
  VERSION,
  provideZonelessChangeDetection,
  signal,
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
  { sku: 'mug', name: 'Coffee mug', price: 12 },
  { sku: 'tee', name: 'T-shirt', price: 25 },
  { sku: 'cap', name: 'Cap', price: 18 },
];

@Component({
  selector: 'angular-mfe-view',
  template: `
    @if (announcement(); as a) {
      <div class="announce" role="status">
        <span class="from">From the shell portal{{ a.direct ? ' · only to you' : '' }}</span>{{ a.text }}
      </div>
    }
    <p class="intro">Pick a product. The catalog announces it; whoever cares (the cart) reacts.</p>
    <ul class="products">
      @for (p of products; track p.sku) {
      <li>
        <span class="name">{{ p.name }}</span>
        <span class="price">€{{ p.price }}</span>
        <button type="button" (click)="add(p)" [class.done]="justAdded() === p.sku">
          {{ justAdded() === p.sku ? 'Added ✓' : 'Add to cart' }}
        </button>
      </li>
      }
    </ul>
  `,
  styles: [
    `:host { display:block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color:var(--text, #171a20); }
     .intro { margin:0 0 12px; color:var(--text-secondary, #5a6578); font-size:14px; }
     .products { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
     li { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; background:var(--surface, #f7f8fa); }
     .name { flex:1; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
     .price { color:var(--text-secondary, #5a6578); font-variant-numeric:tabular-nums; }
     button { font:inherit; font-size:13px; font-weight:600; padding:6px 12px; border-radius:9999px; cursor:pointer; border:0; color:#fff; background:#c2255c; min-width:100px; flex:none; transition:background-color 150ms; }
     button:hover { background:#a61e4d; }
     button:focus-visible { outline:2px solid #0495d4; outline-offset:3px; }
     button.done { background:var(--ok, #15803d); }
     .announce { display:flex; flex-direction:column; gap:2px; margin:0 0 12px; padding:10px 12px; border-radius:8px; font-size:14px; background:rgba(4,149,212,0.07); border:1px solid rgba(4,149,212,0.3); animation:announce-in 250ms ease-out; }
     .from { font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent, #006ca0); }
     @keyframes announce-in { from { opacity:0; transform:translateY(-4px); } }
    `,
  ],
})
class AngularMfeComponent implements OnInit, OnDestroy {
  private bus?: Connection;
  private timer?: ReturnType<typeof setTimeout>;
  private announceTimer?: ReturnType<typeof setTimeout>;
  readonly products = PRODUCTS;
  // Signals drive change detection, so the app needs no zone.js.
  readonly justAdded = signal<string | undefined>(undefined);
  readonly announcement = signal<{ text: string; direct: boolean } | undefined>(undefined);

  ngOnInit(): void {
    this.bus = connect({
      id: 'angular-mfe',
      name: 'Product catalog',
      version: '1.0.0',
      // Read at runtime, so the shell shows the version this bundle really ships.
      meta: { framework: `Angular ${VERSION.full}`, element: 'Angular Elements' },
    });
    this.bus.subscribe('portal:announcement', (msg) => {
      this.announcement.set({ text: (msg.payload as { text: string }).text, direct: msg.to === 'angular-mfe' });
      clearTimeout(this.announceTimer);
      this.announceTimer = setTimeout(() => this.announcement.set(undefined), 6000);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    clearTimeout(this.announceTimer);
    this.bus?.disconnect();
  }

  add(product: (typeof PRODUCTS)[number]) {
    this.bus?.publish('cart:item-added', { sku: product.sku, name: product.name, price: product.price });
    this.justAdded.set(product.sku);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.justAdded.set(undefined), 1200);
  }
}

async function defineAngularElement() {
  if (customElements.get('angular-mfe')) return;
  const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
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

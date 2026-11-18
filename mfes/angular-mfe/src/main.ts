import {
  Component,
  OnDestroy,
  OnInit,
  VERSION,
  ViewEncapsulation,
  computed,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
// The only thing this app shares with the others: the published message library.
import { Connection, connect } from '@stavgian/mfe-communication';

type Context = { contextType: string; contextId: string; routeId: string; correlationId?: string };
type Risk = { score: number; level: string };
type Check = { check: string; result: 'pass' | 'review' };

// The messages this app understands. Other apps declare their own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'context:changed': Context;
    'compliance:check:completed': { contextId: string; check: string; result: 'pass' | 'review' };
    'risk:assessment:updated': { contextId: string } & Risk;
  }
  interface RequestMap {
    'context:get': { request: void; response: Context | null };
    'risk:get-score': { request: { contextId: string }; response: Risk };
  }
}

// Fictional overview data, keyed by the context id the shell announces.
const OVERVIEW: Record<string, { stage: string; next: string; due: string; tasks: number }> = {
  'CASE-2026-1082': { stage: 'Pleadings exchanged', next: 'Mediation session', due: '2026-12-04', tasks: 3 },
  'CASE-2026-1083': { stage: 'Response brief drafted', next: 'Partner review', due: '2026-11-27', tasks: 5 },
  'CASE-2026-1084': { stage: 'Due diligence', next: 'IP review sign-off', due: '2027-01-15', tasks: 8 },
  'CASE-2026-1085': { stage: 'Claim filed', next: 'Preliminary injunction hearing', due: '2026-12-15', tasks: 4 },
  'CASE-2026-1086': { stage: 'Information request received', next: 'Response to authority', due: '2026-12-01', tasks: 6 },
};

@Component({
  selector: 'angular-mfe-view',
  // Own shadow root, like the other apps: the portal's CSS can't reach in and this app's CSS can't leak out.
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    @if (ctx(); as c) {
      @if (overview(); as o) {
        <p class="ctx">Context <code>{{ c.contextId }}</code></p>
        <dl>
          <div><dt>Stage</dt><dd>{{ o.stage }}</dd></div>
          <div><dt>Next step</dt><dd>{{ o.next }}</dd></div>
          <div><dt>Due</dt><dd>{{ o.due }}</dd></div>
          <div><dt>Open tasks</dt><dd>{{ o.tasks }}</dd></div>
        </dl>
        <ul class="signals">
          <li>
            <span>Compliance</span>
            @if (compliance(); as k) {
              <strong [class.warn]="k.result === 'review'">{{ k.check }}: {{ k.result }}</strong>
            } @else { <em>no check yet</em> }
          </li>
          <li>
            <span>Risk</span>
            @if (risk(); as r) { <strong>{{ r.level }} ({{ r.score }})</strong> } @else { <em>unknown</em> }
            <button type="button" (click)="askRisk()">Ask Risk</button>
          </li>
        </ul>
      } @else {
        <p class="empty">No overview for {{ c.contextId }}.</p>
      }
    } @else {
      <p class="empty">Waiting for a context from the portal…</p>
    }
  `,
  styles: [
    `:host { display:block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color:var(--text, #171a20); }
     .ctx { margin:0 0 10px; color:var(--text-secondary, #5a6578); font-size:13px; }
     code { font-family: var(--font-mono, monospace); }
     dl { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:0 0 12px; }
     dl div { padding:8px 12px; border-radius:8px; background:var(--surface, #f7f8fa); }
     dt { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--text-secondary, #5a6578); }
     dd { margin:2px 0 0; font-weight:600; }
     .signals { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
     .signals li { display:flex; align-items:center; gap:8px; font-size:14px; }
     .signals span { width:84px; color:var(--text-secondary, #5a6578); }
     .signals em { color:var(--text-secondary, #5a6578); }
     .warn { color:#a16207; }
     button { margin-left:auto; font:inherit; font-size:12px; font-weight:600; padding:4px 12px; border-radius:9999px; cursor:pointer; border:0; color:#fff; background:#c2255c; }
     button:focus-visible { outline:2px solid #0495d4; outline-offset:3px; }
     .empty { margin:0; padding:18px 12px; text-align:center; color:var(--text-secondary, #5a6578); font-size:14px; border-radius:8px; border:2px dashed var(--border, #e5e7eb); }
    `,
  ],
})
class AngularMfeComponent implements OnInit, OnDestroy {
  private bus?: Connection;
  readonly ctx = signal<Context | null>(null);
  // Local state, kept per context id so switching back shows what this app already learned.
  private readonly checks = signal<Record<string, Check>>({});
  private readonly risks = signal<Record<string, Risk>>({});
  readonly overview = computed(() => OVERVIEW[this.ctx()?.contextId ?? '']);
  readonly compliance = computed(() => this.checks()[this.ctx()?.contextId ?? '']);
  readonly risk = computed(() => this.risks()[this.ctx()?.contextId ?? '']);

  ngOnInit(): void {
    const bus = (this.bus = connect({
      id: 'angular-mfe',
      name: 'Legal',
      version: '1.0.0',
      // Read at runtime, so the shell shows the version this bundle really ships.
      meta: { framework: `Angular ${VERSION.full}`, element: 'Angular Elements' },
    }));

    // Follow the portal's active context; ask once in case it was announced before this app loaded.
    bus.subscribe('context:changed', ({ payload }) => this.setContext(payload));
    bus.request('context:get', undefined, { to: 'portal' }).then((c) => c && this.setContext(c), () => undefined);

    // Risk may come online after this app: ask again when it appears.
    bus.onPeersChange((peers) => {
      if (peers.some((p) => p.id === 'lit-mfe') && !this.risk()) this.askRisk();
    });

    // React to other departments' events, without knowing who sent them.
    bus.subscribe('compliance:check:completed', ({ payload: p }) =>
      this.checks.update((m) => ({ ...m, [p.contextId]: { check: p.check, result: p.result } }))
    );
    bus.subscribe('risk:assessment:updated', ({ payload: p }) =>
      this.risks.update((m) => ({ ...m, [p.contextId]: { score: p.score, level: p.level } }))
    );
  }

  ngOnDestroy(): void {
    this.bus?.disconnect();
  }

  private setContext(c: Context): void {
    this.ctx.set(c);
    if (!this.risks()[c.contextId]) this.askRisk();
  }

  /** Request/response: Risk owns the score, Legal asks for it. */
  askRisk(): void {
    const id = this.ctx()?.contextId;
    if (!id) return;
    this.bus
      ?.request('risk:get-score', { contextId: id }, { to: 'lit-mfe', timeout: 2000 })
      .then((r) => this.risks.update((m) => ({ ...m, [id]: r })))
      .catch(() => undefined); // Risk may not be online yet; its next update arrives as an event.
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

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

// Event contract (mirrors shared-contract but kept local to avoid compile-time coupling)
const EVENT_NAMES = {
  statusMessage: 'statusMessage',
} as const;

type StatusMessagePayload = { text: string; source?: string; emittedAt?: string };
type EventPayloadMap = {
  [EVENT_NAMES.statusMessage]: StatusMessagePayload;
};

function validate<K extends keyof EventPayloadMap>(
  eventName: K,
  payload: EventPayloadMap[K]
) {
  const required = {
    [EVENT_NAMES.statusMessage]: ['text'],
  } as const;

  const missing = required[eventName].filter(
    (key) => typeof payload[key as keyof typeof payload] !== 'string' || !payload[key as keyof typeof payload]
  );

  if (missing.length) {
    throw new Error(
      `Invalid payload for ${eventName}: missing string fields ${missing.join(',')}`
    );
  }
}

function publish<K extends keyof EventPayloadMap>(
  eventName: K,
  payload: EventPayloadMap[K]
) {
  validate(eventName, payload);
  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
}

function subscribe<K extends keyof EventPayloadMap>(
  eventName: K,
  handler: (payload: EventPayloadMap[K]) => void
): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<EventPayloadMap[K]>;
    try {
      validate(eventName, custom.detail);
      handler(custom.detail);
    } catch (err) {
      console.warn(err);
    }
  };

  window.addEventListener(eventName, listener as EventListener);
  return () => window.removeEventListener(eventName, listener as EventListener);
}

@Component({
  selector: 'angular-mfe-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <p class="title">Angular MFE</p>
      <p class="subtitle">Says hi and listens to status messages.</p>

      <button class="btn ghost" (click)="sayHi()">Say hi to everyone</button>
      <div class="note" *ngIf="lastStatus">Last heard: {{ lastStatus?.text }} ({{ lastStatus?.source || 'unknown' }})</div>
    </div>
  `,
  styles: [
    `:host { display:block; font-family: 'Inter', system-ui, sans-serif; color:#f6f8fb; }
     .card { background: linear-gradient(180deg, #101827, #0b1220); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; box-shadow:0 12px 30px rgba(0,0,0,0.25); }
     .title { margin:0 0 6px; font-weight:700; font-size:16px; }
     .subtitle { margin:0 0 12px; color:#9fb1c9; font-size:13px; }
     .panel { border-radius:10px; border:1px dashed rgba(255,255,255,0.14); padding:10px; background:rgba(255,255,255,0.04); display:flex; flex-direction:column; gap:6px; }
     .panel.muted { color:#9fb1c9; }
     .label { font-size:12px; color:#b7c6da; }
     .input { padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); color:#f6f8fb; }
     .hint { font-size:12px; color:#b7c6da; }
     .btn { margin-top:12px; padding:10px 14px; border:none; border-radius:10px; font-weight:700; color:#0b1220; background:linear-gradient(90deg, #6bdcff, #9b8cff); cursor:pointer; }
     .btn:disabled { opacity:0.5; cursor:not-allowed; }
     .note { margin-top:10px; color:#9fb1c9; font-size:12px; }
    `,
  ],
})
class AngularMfeComponent implements OnInit, OnDestroy {
  statusMessage = '';
  private unsubscribeStatus?: () => void;
  lastStatus?: StatusMessagePayload;

  ngOnInit(): void {
    this.unsubscribeStatus = subscribe(EVENT_NAMES.statusMessage, (msg) => {
      this.lastStatus = msg;
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeStatus?.();
  }

  sayHi() {
    publish(EVENT_NAMES.statusMessage, {
      text: 'Hi from Angular MFE — waving at everyone!',
      source: 'angular-mfe',
      emittedAt: new Date().toISOString(),
    });
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

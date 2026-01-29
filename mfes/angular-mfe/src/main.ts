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
import { FormsModule } from '@angular/forms';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';

// Event contract (mirrors shared-contract but kept local to avoid compile-time coupling)
const EVENT_NAMES = {
  customerSelected: 'customerSelected',
  ticketCreated: 'ticketCreated',
} as const;

type CustomerSelectedPayload = { customerId: string; name: string };
type TicketCreatedPayload = { ticketId: string; customerId: string };
type EventPayloadMap = {
  [EVENT_NAMES.customerSelected]: CustomerSelectedPayload;
  [EVENT_NAMES.ticketCreated]: TicketCreatedPayload;
};

function validate<K extends keyof EventPayloadMap>(
  eventName: K,
  payload: EventPayloadMap[K]
) {
  const required = {
    [EVENT_NAMES.customerSelected]: ['customerId', 'name'],
    [EVENT_NAMES.ticketCreated]: ['ticketId', 'customerId'],
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <p class="title">Angular MFE</p>
      <p class="subtitle">Listens to <code>customerSelected</code> and can publish <code>ticketCreated</code>.</p>

      <div class="panel" *ngIf="customer; else manual">
        <div><strong>ID:</strong> {{ customer?.customerId }}</div>
        <div><strong>Name:</strong> {{ customer?.name }}</div>
        <div class="hint">Using selected customer event</div>
      </div>
      <ng-template #manual>
        <div class="panel muted">
          <div class="hint">No event yet — enter a customer to publish a ticket</div>
          <label class="label">Customer ID</label>
          <input class="input" [(ngModel)]="manualCustomerId" placeholder="123" />
          <label class="label">Name</label>
          <input class="input" [(ngModel)]="manualName" placeholder="Ada Lovelace" />
        </div>
      </ng-template>

      <button class="btn" [disabled]="!canPublish" (click)="createTicket()">
        Create ticket
      </button>

      <div class="note" *ngIf="ticketMessage">{{ ticketMessage }}</div>
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
     .note { margin-top:10px; color:#b7c6da; font-size:12px; }
    `,
  ],
})
class AngularMfeComponent implements OnInit, OnDestroy {
  customer: CustomerSelectedPayload | null = null;
  manualCustomerId = '';
  manualName = '';
  ticketMessage = '';
  private unsubscribe?: () => void;

  ngOnInit(): void {
    this.unsubscribe = subscribe(EVENT_NAMES.customerSelected, (payload) => {
      this.customer = payload;
      this.manualCustomerId = payload.customerId;
      this.manualName = payload.name;
      this.ticketMessage = '';
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  createTicket() {
    const customerToUse =
      this.customer ??
      ({
        customerId: this.manualCustomerId.trim(),
        name: this.manualName.trim(),
      } satisfies CustomerSelectedPayload);

    if (!customerToUse.customerId || !customerToUse.name) {
      this.ticketMessage = 'Enter a customer first.';
      return;
    }

    const ticketId = `AT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    publish(EVENT_NAMES.ticketCreated, {
      ticketId,
      customerId: customerToUse.customerId,
      source: 'angular-mfe',
      emittedAt: new Date().toISOString(),
    });
    this.ticketMessage = `Published ticketCreated (${ticketId})`;
  }

  get canPublish(): boolean {
    const c =
      this.customer ??
      ({
        customerId: this.manualCustomerId.trim(),
        name: this.manualName.trim(),
      } satisfies CustomerSelectedPayload);
    return !!c.customerId && !!c.name;
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

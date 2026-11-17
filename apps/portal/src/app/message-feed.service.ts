import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Message, connect } from '@stavgian/mfe-communication';
import { PORTAL_ID, Participant, participantFor } from './participants';

// The messages the portal sends. Each app declares its own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'portal:announcement': { text: string };
  }
}

export interface FeedMessage {
  /** Envelope id from the library. */
  id: string;
  /** An app message, or a presence change (someone connected or left). */
  kind: 'message' | 'joined' | 'left';
  type: string;
  /** `payload.text` when the message has one. */
  text?: string;
  sender: Participant;
  receivedAt: Date;
  envelope: Message;
}

const MAX_MESSAGES = 50;
const MAX_TOASTS = 3;
const TOAST_MS = 4500;

/** The portal's single connection to the shared message channel. */
@Injectable({ providedIn: 'root' })
export class MessageFeedService implements OnDestroy {
  private readonly bus = connect({ id: PORTAL_ID, name: 'Portal', version: '1.0.0' });
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  /** Everything the portal heard, newest first. */
  readonly messages = signal<FeedMessage[]>([]);
  readonly toasts = signal<FeedMessage[]>([]);
  /** How many app messages arrived so far (presence changes excluded). */
  readonly messageCount = signal(0);
  /** Newest app message (presence changes excluded). */
  readonly latest = computed(() => this.messages().find((m) => m.kind === 'message'));
  /** Ids of apps currently connected to the channel. */
  readonly connectedIds = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.bus.subscribe('*', (message) => this.add(message));
    this.bus.onPeersChange((peers) => this.connectedIds.set(new Set(peers.map((p) => p.id))));
  }

  sendFromPortal(text: string): void {
    this.bus.publish('portal:announcement', { text });
  }

  clear(): void {
    this.messages.set([]);
  }

  dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  ngOnDestroy(): void {
    this.bus.disconnect();
    this.timers.forEach(clearTimeout);
  }

  private add(envelope: Message): void {
    const kind = kindOf(envelope);
    if (!kind) return;

    const text = (envelope.payload as { text?: unknown } | null | undefined)?.text;
    const entry: FeedMessage = {
      id: envelope.id,
      kind,
      type: envelope.type,
      text: typeof text === 'string' ? text : undefined,
      sender: participantFor(envelope.source),
      receivedAt: new Date(),
      envelope,
    };

    this.messages.update((list) => [entry, ...list].slice(0, MAX_MESSAGES));
    if (kind === 'message') {
      this.messageCount.update((n) => n + 1);
      this.showToast(entry);
    }
  }

  private showToast(entry: FeedMessage): void {
    this.toasts.update((list) => [entry, ...list].slice(0, MAX_TOASTS));
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.dismissToast(entry.id);
    }, TOAST_MS);
    this.timers.add(timer);
  }
}

/** Which feed entry a message becomes. `system:present` replies only feed the peer list. */
function kindOf(message: Message): FeedMessage['kind'] | undefined {
  if (message.type === 'system:ready') return 'joined';
  if (message.type === 'system:left') return 'left';
  if (message.type.startsWith('system:')) return undefined;
  return 'message';
}

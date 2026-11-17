import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Message, PeerInfo, ReplyPayload, connect } from '@stavgian/mfe-communication';
import { Subject } from 'rxjs';
import { PORTAL_ID, Participant, participantFor } from './participants';

// The messages the portal sends. Each app declares its own; nothing is shared but the names.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'portal:announcement': { text: string };
  }
}

export type FeedKind = 'event' | 'request' | 'reply' | 'joined' | 'left';

export interface FeedMessage {
  /** Envelope id from the library. */
  id: string;
  kind: FeedKind;
  type: string;
  /** One-line, human-readable description of the payload. */
  summary: string;
  sender: Participant;
  /** Set when the message was addressed to one app. */
  target?: Participant;
  /** Replies: whether the request succeeded, what it asked, and how long it took. */
  ok?: boolean;
  requestType?: string;
  latencyMs?: number;
  receivedAt: Date;
  envelope: Message;
}

const MAX_MESSAGES = 200;
const MAX_TOASTS = 3;
const TOAST_MS = 4500;

/** The portal's single connection to the shared message channel. */
@Injectable({ providedIn: 'root' })
export class MessageFeedService implements OnDestroy {
  private readonly bus = connect({ id: PORTAL_ID, name: 'Portal', version: '1.0.0' });
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  /** Request id → when and what was asked, to label replies. */
  private readonly requests = new Map<string, { type: string; at: number }>();

  /** Everything the portal heard, oldest first (a log). */
  readonly messages = signal<FeedMessage[]>([]);
  readonly toasts = signal<FeedMessage[]>([]);
  /** How many app messages arrived so far (presence changes excluded). */
  readonly messageCount = signal(0);
  /** Every event, request and reply as it arrives. Unlike `latest`, none are skipped when several arrive at once. */
  readonly arrivals = new Subject<FeedMessage>();
  /** Newest event, request or reply (presence changes excluded). */
  readonly latest = signal<FeedMessage | undefined>(undefined);
  /** Ids of apps currently connected to the channel. */
  /** Apps currently connected, with what they told the channel about themselves. */
  readonly peers = signal<PeerInfo[]>([]);
  readonly connectedIds = computed<ReadonlySet<string>>(() => new Set(this.peers().map((p) => p.id)));
  /** Framework each app reports at runtime, e.g. "Angular 18.2.14". The shell is never told at build time. */
  readonly frameworks = computed(() => new Map(this.peers().map((p) => [p.id, p.meta?.['framework']])));
  /** Last ping round trip per app id, in ms, or 'timeout'. */
  readonly pings = signal<ReadonlyMap<string, number | 'timeout'>>(new Map());
  readonly connectedCount = computed(() => this.connectedIds().size);

  constructor() {
    // The portal watches all traffic, including messages addressed to one app.
    this.bus.subscribe('*', (message) => this.add(message), { observeAll: true });
    this.bus.onPeersChange((peers) => this.peers.set(peers));
  }

  /** To everyone, or with `to` to one app only. */
  announce(text: string, to?: string): void {
    this.bus.publish('portal:announcement', { text }, { to });
  }

  /** Request/response health check: asks every connected app to answer. */
  async pingAll(): Promise<void> {
    const results = await Promise.all(
      this.bus.peers().map(async (peer): Promise<[string, number | 'timeout']> => {
        try {
          return [peer.id, await this.bus.ping(peer.id, { timeout: 2000 })];
        } catch {
          return [peer.id, 'timeout'];
        }
      })
    );
    this.pings.set(new Map(results));
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

    const entry: FeedMessage = {
      id: envelope.id,
      kind,
      type: envelope.type,
      // Presence speaks for itself ("Checkout connected"); its payload is only shown in the details.
      summary: kind === 'joined' || kind === 'left' ? '' : summarize(envelope.payload),
      sender: participantFor(envelope.source),
      target: envelope.to ? participantFor(envelope.to) : undefined,
      receivedAt: new Date(),
      envelope,
    };

    if (kind === 'request') this.requests.set(envelope.id, { type: envelope.type, at: performance.now() });
    if (kind === 'reply') {
      const reply = envelope.payload as ReplyPayload;
      const request = envelope.inReplyTo ? this.requests.get(envelope.inReplyTo) : undefined;
      this.requests.delete(envelope.inReplyTo ?? '');
      entry.ok = reply.ok;
      entry.summary = !reply.ok ? reply.error : request?.type === 'system:ping' ? '' : summarize(reply.value);
      entry.requestType = request?.type;
      entry.latencyMs = request ? Math.round(performance.now() - request.at) : undefined;
    }

    this.messages.update((list) => [...list, entry].slice(-MAX_MESSAGES));
    if (kind === 'joined' || kind === 'left') return;

    this.latest.set(entry);
    this.arrivals.next(entry);
    this.messageCount.update((n) => n + 1);
    if (kind === 'event') this.showToast(entry);
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

/** Whether `appId` receives `message`: its target if it was addressed, otherwise everyone but the sender. */
export function isRecipient(message: FeedMessage | undefined, appId: string): boolean {
  if (!message || message.sender.id === appId) return false;
  return message.target ? message.target.id === appId : true;
}

/** Which feed entry a message becomes. `system:present` replies only feed the peer list. */
function kindOf(message: Message): FeedKind | undefined {
  if (message.type === 'system:ready') return 'joined';
  if (message.type === 'system:left') return 'left';
  if (message.type === 'system:reply') return 'reply';
  if (message.expectsReply) return 'request';
  if (message.type.startsWith('system:')) return undefined;
  return 'event';
}

/** Short, readable payload text: `text` if there is one, otherwise compact JSON. */
function summarize(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  const text = (payload as { text?: unknown }).text;
  if (typeof text === 'string') return text;
  const json = JSON.stringify(payload);
  return json === '{}' ? '' : json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

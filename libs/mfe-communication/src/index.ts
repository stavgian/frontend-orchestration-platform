/**
 * Framework-agnostic messaging between microfrontends on the same page.
 *
 * Every message travels as one browser-native `CustomEvent` on `window`, carrying a
 * small envelope (inspired by CloudEvents). Each connection keeps only its own state,
 * so apps bundling different copies or versions of this library still talk to each
 * other as long as they speak the same `specversion`.
 *
 * Messages are visible to every script on the page. Use this for coordination, not secrets.
 */

export const SPEC_VERSION = '1';

/** Name of the DOM event that carries every message. */
export const DOM_EVENT = 'mfe-communication:message';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Events your apps broadcast. The library ships it empty: declare your own with
 * TypeScript declaration merging to get typed payloads.
 *
 * @example
 * declare module '@stavgian/mfe-communication' {
 *   interface MessageMap {
 *     'cart:item-added': { sku: string; qty: number };
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MessageMap {}

/**
 * Questions your apps ask each other with `request()`, and their answers.
 *
 * @example
 * declare module '@stavgian/mfe-communication' {
 *   interface RequestMap {
 *     'cart:get-summary': { request: void; response: { count: number; total: number } };
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RequestMap {}

/** Who is on the channel. Sent with presence messages. */
export interface PeerInfo {
  id: string;
  name?: string;
  version?: string;
}

/** Payload of presence messages. */
export interface PresencePayload extends PeerInfo {
  /**
   * Unique per connection. When an app remounts, the old and new connections share an
   * `id`; this tells them apart so a late `system:left` from the old one is ignored.
   */
  instance: string;
}

/** Payload of `system:reply`: the answer to a request, or why it failed. */
export type ReplyPayload = { ok: true; value: unknown } | { ok: false; error: string };

/** Messages the library sends for you. The `system:` prefix is reserved. */
export interface SystemMessageMap {
  /** A peer just connected and is listening. */
  'system:ready': PresencePayload;
  /** Reply to `system:ready`: "I was already here". Lets newcomers discover existing peers. */
  'system:present': PresencePayload;
  /** A peer disconnected. */
  'system:left': PresencePayload;
  /** The answer to a request. Its `inReplyTo` is the request's id. */
  'system:reply': ReplyPayload;
}

/** Requests the library answers for you. */
export interface SystemRequestMap {
  /** Every connection answers with its own info. Used by `ping()`. */
  'system:ping': { request: void; response: PeerInfo };
}

type KnownMessages = MessageMap & SystemMessageMap;
type KnownRequests = RequestMap & SystemRequestMap;

/** Payload type for a message type: typed if declared, otherwise `unknown`. */
export type PayloadOf<T extends string> = T extends keyof KnownMessages
  ? KnownMessages[T]
  : T extends keyof KnownRequests
    ? KnownRequests[T]['request']
    : unknown;

/** What `request(type)` sends: typed if declared in `RequestMap`, otherwise `unknown`. */
export type RequestOf<T extends string> = T extends keyof KnownRequests ? KnownRequests[T]['request'] : unknown;

/** What `request(type)` resolves with: typed if declared in `RequestMap`, otherwise `unknown`. */
export type ResponseOf<T extends string> = T extends keyof KnownRequests ? KnownRequests[T]['response'] : unknown;

export interface Message<T extends string = string> {
  specversion: typeof SPEC_VERSION;
  /** Unique per message. */
  id: string;
  /** What happened, e.g. `cart:item-added`. Use `namespace:name`. */
  type: T;
  /** Id of the sending app. */
  source: string;
  /** ISO 8601 time the message was sent. */
  time: string;
  payload: PayloadOf<T>;
  /** Set when the message is meant for one app. Every app can still see it. */
  to?: string;
  /** Set on requests sent with `request()`. */
  expectsReply?: true;
  /** Set on `system:reply`: the id of the request being answered. */
  inReplyTo?: string;
}

/** Exact type (`cart:item-added`), namespace wildcard (`cart:*`) or everything (`*`). */
export type MessagePattern = string;

type HandlerFor<P extends string> = P extends `${string}*` ? (message: Message) => void : (message: Message<P>) => void;

export interface RequestOptions {
  /** Ask one app only. Without it, the first app to answer wins. */
  to?: string;
  /** Milliseconds to wait for an answer. Defaults to 5000. */
  timeout?: number;
}

/** Why a request failed. */
export class RequestError extends Error {
  constructor(
    message: string,
    /** `timeout`: nobody answered in time. `rejected`: the responder threw. `disconnected`: this connection closed first. */
    readonly code: 'timeout' | 'rejected' | 'disconnected'
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

/**
 * Minimal Standard Schema interface (https://standardschema.dev), implemented by Zod,
 * Valibot, ArkType and others. Lets you validate payloads without this library
 * depending on any validator.
 */
export interface StandardSchemaV1<Output = unknown> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<{ readonly message: string }> }
      | Promise<unknown>;
  };
}

export type Schemas = { [T in keyof MessageMap]?: StandardSchemaV1<MessageMap[T]> } & Record<string, StandardSchemaV1 | undefined>;

export interface ConnectOptions extends PeerInfo {
  /** Optional payload validators per message or request type, checked on send and on receive. */
  schemas?: Schemas;
}

export interface Connection {
  readonly self: PeerInfo;
  /** Sends an event to everyone, including this connection's own subscribers. Returns the sent envelope. */
  publish<T extends string>(type: T, payload: PayloadOf<T>): Message<T>;
  /** Listens for messages matching a pattern. Returns a function that stops listening. */
  subscribe<P extends MessagePattern>(pattern: P, handler: HandlerFor<P>): () => void;
  /**
   * Asks a question and resolves with the first answer. Rejects with a `RequestError`
   * if nobody answers in time, the responder throws, or this connection disconnects.
   */
  request<T extends string>(type: T, payload: RequestOf<T>, options?: RequestOptions): Promise<ResponseOf<T>>;
  /**
   * Answers requests of `type` (sync or async). Throwing rejects the caller's promise with
   * the error's message. One responder per type per connection. Returns a function that stops answering.
   */
  respond<T extends string>(
    type: T,
    handler: (payload: RequestOf<T>, request: Message<T>) => ResponseOf<T> | Promise<ResponseOf<T>>
  ): () => void;
  /** Checks that a peer is alive. Resolves with the round trip in milliseconds. */
  ping(peerId: string, options?: Omit<RequestOptions, 'to'>): Promise<number>;
  /** Peers currently connected, not including this one. */
  peers(): PeerInfo[];
  /**
   * Calls `handler` right away with the current peers, then again whenever a peer connects
   * or leaves. Returns a function that stops listening.
   */
  onPeersChange(handler: (peers: PeerInfo[]) => void): () => void;
  /** Announces `system:left`, rejects pending requests and removes every subscription and responder. */
  disconnect(): void;
}

type Envelope = Pick<Message, 'to' | 'expectsReply' | 'inReplyTo'>;
type Pending = { resolve: (value: unknown) => void; reject: (error: RequestError) => void; timer: ReturnType<typeof setTimeout> };

/**
 * Joins the channel as `options.id`, announces `system:ready`, and discovers peers that
 * were already connected.
 */
export function connect(options: ConnectOptions): Connection {
  if (!options?.id || typeof options.id !== 'string') {
    throw new Error('connect() needs an id, e.g. connect({ id: "react-mfe" })');
  }

  const self: PeerInfo = pickPeer(options);
  const schemas = options.schemas ?? {};
  const target: EventTarget = window;
  const presence: PresencePayload = { ...self, instance: createId() };
  const subscriptions = new Set<{ pattern: string; handler: (message: Message) => void }>();
  const responders = new Map<string, (payload: unknown, request: Message) => unknown>();
  const pending = new Map<string, Pending>();
  const peers = new Map<string, { peer: PeerInfo; instance?: string }>();
  const peerHandlers = new Set<(peers: PeerInfo[]) => void>();
  let connected = true;

  const send = (type: string, payload: unknown, extra: Envelope = {}): Message => {
    const message: Message = {
      specversion: SPEC_VERSION,
      id: createId(),
      type,
      source: self.id,
      time: new Date().toISOString(),
      payload,
      ...extra,
    };
    target.dispatchEvent(new CustomEvent(DOM_EVENT, { detail: message }));
    return message;
  };

  const settle = (reply: Message) => {
    const waiting = reply.inReplyTo ? pending.get(reply.inReplyTo) : undefined;
    if (!waiting) return; // not ours, or another responder already answered
    pending.delete(reply.inReplyTo!);
    clearTimeout(waiting.timer);
    const result = reply.payload as ReplyPayload;
    if (result?.ok) waiting.resolve(result.value);
    else waiting.reject(new RequestError(String(result?.error ?? 'Request failed'), 'rejected'));
  };

  const answer = (request: Message) => {
    const handler = request.type === 'system:ping' ? () => self : responders.get(request.type);
    if (!handler) return;
    // Always answer asynchronously, so the requester is registered before the reply arrives.
    Promise.resolve()
      .then(() => handler(request.payload, request))
      .then(
        (value): ReplyPayload => ({ ok: true, value }),
        (err): ReplyPayload => ({ ok: false, error: err instanceof Error ? err.message : String(err) })
      )
      .then((reply) => {
        if (connected) send('system:reply', reply, { to: request.source, inReplyTo: request.id });
      });
  };

  // One DOM listener per connection: check each message once, then route it.
  const onDomEvent: EventListener = (event) => {
    const message = (event as CustomEvent<unknown>).detail;
    if (!isMessage(message)) {
      console.warn('[mfe-communication] Ignored a message with an invalid envelope', message);
      return;
    }
    const problem = validate(schemas, message.type, message.payload);
    if (problem) {
      console.warn(`[mfe-communication] Ignored "${message.type}" from ${message.source}: ${problem}`);
      return;
    }

    const forMe = !message.to || message.to === self.id;
    if (message.type === 'system:reply' && message.to === self.id) settle(message);
    if (message.expectsReply && forMe && message.source !== self.id) answer(message);

    for (const sub of [...subscriptions]) {
      if (!matches(sub.pattern, message.type)) continue;
      try {
        sub.handler(message);
      } catch (err) {
        // One failing handler must not stop the others.
        console.error(`[mfe-communication] A "${sub.pattern}" handler in ${self.id} threw`, err);
      }
    }
  };
  target.addEventListener(DOM_EVENT, onDomEvent);

  const listen = (pattern: string, handler: (message: Message) => void): (() => void) => {
    const sub = { pattern, handler };
    subscriptions.add(sub);
    return () => subscriptions.delete(sub);
  };

  const peerList = () => [...peers.values()].map((entry) => entry.peer);
  const notifyPeers = () => {
    const list = peerList();
    peerHandlers.forEach((handler) => handler(list));
  };

  // Presence: track who is connected, and answer newcomers so they discover us.
  listen('system:*', (message) => {
    if (message.source === self.id) return;
    if (!['system:ready', 'system:present', 'system:left'].includes(message.type)) return;
    const payload = message.payload as Partial<PresencePayload>;
    const peer = pickPeer(payload as PeerInfo);
    const instance = typeof payload?.instance === 'string' ? payload.instance : undefined;
    if (message.type === 'system:left') {
      // Ignore a goodbye from an older instance of a peer that has since reconnected.
      if (peers.get(peer.id)?.instance === instance && peers.delete(peer.id)) notifyPeers();
      return;
    }
    peers.set(peer.id, { peer, instance });
    notifyPeers();
    if (message.type === 'system:ready') send('system:present', presence);
  });

  send('system:ready', presence);

  const assertConnected = () => {
    if (!connected) throw new Error(`[mfe-communication] "${self.id}" is disconnected`);
  };

  const assertType = (type: string) => {
    if (typeof type !== 'string' || !type) throw new Error('[mfe-communication] Message type must be a non-empty string');
    if (type.startsWith('system:')) throw new Error(`[mfe-communication] "${type}" is reserved: the system: prefix belongs to the library`);
    if (type.includes('*')) throw new Error(`[mfe-communication] "${type}" is not a valid message type: * is only for subscribing`);
  };

  const assertSendable = (type: string, payload: unknown) => {
    assertType(type);
    const problem = validate(schemas, type, payload);
    if (problem) throw new Error(`[mfe-communication] Invalid payload for "${type}": ${problem}`);
  };

  const ask = (type: string, payload: unknown, { to, timeout = DEFAULT_TIMEOUT_MS }: RequestOptions = {}) =>
    new Promise<unknown>((resolve, reject) => {
      const request = send(type, payload, { expectsReply: true, ...(to ? { to } : {}) });
      const timer = setTimeout(() => {
        pending.delete(request.id);
        const who = to ? `"${to}"` : 'No app';
        reject(new RequestError(`${who} answered "${type}" within ${timeout} ms`, 'timeout'));
      }, timeout);
      pending.set(request.id, { resolve, reject, timer });
    });

  return {
    self,
    publish(type, payload) {
      assertConnected();
      assertSendable(type, payload);
      return send(type, payload) as Message<typeof type>;
    },
    subscribe(pattern, handler) {
      assertConnected();
      return listen(pattern, handler as (message: Message) => void);
    },
    request(type, payload, requestOptions) {
      try {
        assertConnected();
        assertSendable(type, payload);
      } catch (err) {
        return Promise.reject(err);
      }
      return ask(type, payload, requestOptions) as Promise<ResponseOf<typeof type>>;
    },
    respond(type, handler) {
      assertConnected();
      assertType(type);
      if (responders.has(type)) throw new Error(`[mfe-communication] "${self.id}" already responds to "${type}"`);
      responders.set(type, handler as (payload: unknown, request: Message) => unknown);
      return () => responders.delete(type);
    },
    async ping(peerId, pingOptions) {
      assertConnected();
      const started = now();
      await ask('system:ping', undefined, { ...pingOptions, to: peerId });
      return Math.round((now() - started) * 10) / 10;
    },
    peers: peerList,
    onPeersChange(handler) {
      assertConnected();
      peerHandlers.add(handler);
      handler(peerList());
      return () => peerHandlers.delete(handler);
    },
    disconnect() {
      if (!connected) return;
      connected = false;
      // Stop listening first so our own subscribers don't hear our goodbye.
      target.removeEventListener(DOM_EVENT, onDomEvent);
      subscriptions.clear();
      responders.clear();
      peerHandlers.clear();
      peers.clear();
      pending.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(new RequestError(`"${self.id}" disconnected before an answer arrived`, 'disconnected'));
      });
      pending.clear();
      send('system:left', presence);
    },
  };
}

function matches(pattern: string, type: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  const optionalStrings = ['to', 'inReplyTo'].every((key) => m[key] === undefined || typeof m[key] === 'string');
  return (
    m['specversion'] === SPEC_VERSION &&
    ['id', 'type', 'source', 'time'].every((key) => typeof m[key] === 'string' && m[key] !== '') &&
    optionalStrings &&
    (m['expectsReply'] === undefined || m['expectsReply'] === true)
  );
}

/** Returns a description of what's wrong, or undefined if the payload is valid. */
function validate(schemas: Schemas, type: string, payload: unknown): string | undefined {
  const schema = schemas[type];
  if (!schema) return undefined;
  const result = schema['~standard'].validate(payload);
  if (result instanceof Promise) return 'async schemas are not supported';
  const issues = (result as { issues?: ReadonlyArray<{ message: string }> }).issues;
  return issues?.length ? issues.map((issue) => issue.message).join('; ') : undefined;
}

function pickPeer(value: PeerInfo): PeerInfo {
  const peer: PeerInfo = { id: String(value?.id ?? '') };
  if (typeof value?.name === 'string') peer.name = value.name;
  if (typeof value?.version === 'string') peer.version = value.version;
  return peer;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

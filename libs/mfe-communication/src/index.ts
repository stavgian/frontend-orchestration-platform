/**
 * Framework-agnostic messaging between microfrontends on the same page.
 *
 * Every message travels as one browser-native `CustomEvent` on `window`, carrying a
 * small envelope (inspired by CloudEvents). Each connection keeps only its own state,
 * so apps bundling different copies or versions of this library still talk to each
 * other as long as they speak the same `specversion`.
 */

export const SPEC_VERSION = '1';

/** Name of the DOM event that carries every message. */
export const DOM_EVENT = 'mfe-communication:message';

/**
 * Messages your apps exchange. The library ships it empty: declare your own with
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

/** Messages the library sends for you. The `system:` prefix is reserved. */
export interface SystemMessageMap {
  /** A peer just connected and is listening. */
  'system:ready': PresencePayload;
  /** Reply to `system:ready`: "I was already here". Lets newcomers discover existing peers. */
  'system:present': PresencePayload;
  /** A peer disconnected. */
  'system:left': PresencePayload;
}

type KnownMessages = MessageMap & SystemMessageMap;

/** Payload type for a message type: typed if declared in `MessageMap`, otherwise `unknown`. */
export type PayloadOf<T extends string> = T extends keyof KnownMessages ? KnownMessages[T] : unknown;

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
}

/** Exact type (`cart:item-added`), namespace wildcard (`cart:*`) or everything (`*`). */
export type MessagePattern = string;

type HandlerFor<P extends string> = P extends `${string}*` ? (message: Message) => void : (message: Message<P>) => void;

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
  /** Optional payload validators per message type, checked on publish and on receive. */
  schemas?: Schemas;
}

export interface Connection {
  readonly self: PeerInfo;
  /** Sends a message to everyone, including this connection's own subscribers. Returns the sent envelope. */
  publish<T extends string>(type: T, payload: PayloadOf<T>): Message<T>;
  /** Listens for messages matching a pattern. Returns a function that stops listening. */
  subscribe<P extends MessagePattern>(pattern: P, handler: HandlerFor<P>): () => void;
  /** Peers currently connected, not including this one. */
  peers(): PeerInfo[];
  /**
   * Calls `handler` right away with the current peers, then again whenever a peer connects
   * or leaves. Returns a function that stops listening.
   */
  onPeersChange(handler: (peers: PeerInfo[]) => void): () => void;
  /** Announces `system:left` and removes every subscription made through this connection. */
  disconnect(): void;
}

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
  const peers = new Map<string, { peer: PeerInfo; instance?: string }>();
  const peerHandlers = new Set<(peers: PeerInfo[]) => void>();
  let connected = true;

  const send = (type: string, payload: unknown): Message => {
    const message: Message = {
      specversion: SPEC_VERSION,
      id: createId(),
      type,
      source: self.id,
      time: new Date().toISOString(),
      payload,
    };
    target.dispatchEvent(new CustomEvent(DOM_EVENT, { detail: message }));
    return message;
  };

  // One DOM listener per connection: check each message once, then fan out to subscriptions.
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

  return {
    self,
    publish(type, payload) {
      assertConnected();
      if (typeof type !== 'string' || !type) throw new Error('[mfe-communication] Message type must be a non-empty string');
      if (type.startsWith('system:')) throw new Error(`[mfe-communication] "${type}" is reserved: the system: prefix belongs to the library`);
      if (type.includes('*')) throw new Error(`[mfe-communication] "${type}" is not a valid message type: * is only for subscribing`);
      const problem = validate(schemas, type, payload);
      if (problem) throw new Error(`[mfe-communication] Invalid payload for "${type}": ${problem}`);
      return send(type, payload) as Message<typeof type>;
    },
    subscribe(pattern, handler) {
      assertConnected();
      return listen(pattern, handler as (message: Message) => void);
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
      peerHandlers.clear();
      peers.clear();
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
  return (
    m['specversion'] === SPEC_VERSION &&
    ['id', 'type', 'source', 'time'].every((key) => typeof m[key] === 'string' && m[key] !== '')
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

function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

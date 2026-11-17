/**
 * Typed, framework-agnostic messaging between microfrontends.
 *
 * Messages travel as browser-native `CustomEvent`s on `window`. The library keeps no
 * state of its own, so apps bundling different versions of it still hear each other
 * as long as the payload format stays compatible.
 */

export const EVENT_NAMES = {
  statusMessage: 'statusMessage',
} as const;

export interface StatusMessagePayload {
  text: string;
  /** Id of the app that sent the message, e.g. "react-mfe". */
  source?: string;
  /** ISO 8601 timestamp of when the message was sent. */
  emittedAt?: string;
}

export type EventPayloadMap = {
  [EVENT_NAMES.statusMessage]: StatusMessagePayload;
};

export type EventName = keyof EventPayloadMap;
export type EventHandler<K extends EventName> = (payload: EventPayloadMap[K]) => void;

const requiredStringFields: { [K in EventName]: readonly (keyof EventPayloadMap[K])[] } = {
  [EVENT_NAMES.statusMessage]: ['text'],
};

// Resolved on each call so importing the module never touches `window` (safe for SSR and tests).
const channel = (): EventTarget => window;

function assertValidPayload<K extends EventName>(
  eventName: K,
  payload: unknown
): asserts payload is EventPayloadMap[K] {
  const required = requiredStringFields[eventName] as readonly string[] | undefined;
  if (!required) {
    throw new Error(`Unknown event "${String(eventName)}"`);
  }
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`Invalid payload for ${eventName}: expected an object`);
  }

  const record = payload as Record<string, unknown>;
  const missing = required.filter((key) => typeof record[key] !== 'string' || !record[key]);
  if (missing.length) {
    throw new Error(
      `Invalid payload for ${eventName}: missing string fields ${missing.join(', ')}`
    );
  }
}

/** Broadcasts a message to every subscriber on the page. Throws if the payload is invalid. */
export function publish<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void {
  assertValidPayload(eventName, payload);
  channel().dispatchEvent(new CustomEvent(eventName, { detail: payload }));
}

/**
 * Listens for a message type. Invalid payloads are skipped with a console warning.
 * Returns a function that stops listening.
 */
export function subscribe<K extends EventName>(eventName: K, handler: EventHandler<K>): () => void {
  const listener = (event: Event) => {
    const detail: unknown = (event as CustomEvent).detail;
    try {
      assertValidPayload(eventName, detail);
    } catch (err) {
      console.warn(err);
      return;
    }
    handler(detail);
  };

  const target = channel();
  target.addEventListener(eventName, listener);
  return () => target.removeEventListener(eventName, listener);
}

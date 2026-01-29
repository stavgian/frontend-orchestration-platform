import { EVENT_NAMES, EventPayloadMap } from "@frontend/shared-contract";

type EventName = keyof EventPayloadMap;
type Handler<K extends EventName> = (payload: EventPayloadMap[K]) => void;

const target: Window = window;

const requiredStringFields: {
  [K in EventName]: (keyof EventPayloadMap[K])[];
} = {
  [EVENT_NAMES.customerSelected]: ["customerId", "name"],
  [EVENT_NAMES.ticketCreated]: ["ticketId", "customerId"],
};

function validatePayload<K extends EventName>(
  eventName: K,
  payload: EventPayloadMap[K]
): void {
  const missing = requiredStringFields[eventName].filter(
    (key) => typeof payload[key] !== "string" || !payload[key]
  );

  if (missing.length) {
    throw new Error(
      `Invalid payload for ${eventName}: missing string fields ${missing.join(
        ", "
      )}`
    );
  }
}

export function publish<K extends EventName>(
  eventName: K,
  payload: EventPayloadMap[K]
): void {
  validatePayload(eventName, payload);
  const event = new CustomEvent(eventName, { detail: payload });
  target.dispatchEvent(event);
}

export function subscribe<K extends EventName>(
  eventName: K,
  handler: Handler<K>
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<EventPayloadMap[K]>;
    try {
      validatePayload(eventName, customEvent.detail);
      handler(customEvent.detail);
    } catch (err) {
      console.warn(err);
    }
  };

  target.addEventListener(eventName, listener as EventListener);

  return () => target.removeEventListener(eventName, listener as EventListener);
}

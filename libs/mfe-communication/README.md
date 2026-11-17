# @stavgian/mfe-communication

Framework-agnostic messaging between microfrontends on the same page.

Apps built with Angular, React, plain JavaScript or anything else can send each other messages and know who else is connected, without importing each other's code. Messages are browser-native `CustomEvent`s on `window`. There are no runtime dependencies and no shared instance to set up.

```bash
npm install @stavgian/mfe-communication
```

## Quick start

```ts
import { connect } from '@stavgian/mfe-communication';

// Join the channel. This announces "system:ready" and discovers who's already here.
const bus = connect({ id: 'cart-app', name: 'Cart', version: '1.4.0' });

// Send to everyone. The library adds id, source, time and specversion.
bus.publish('cart:item-added', { sku: 'A1', qty: 1 });

// Listen to one type, a namespace, or everything.
bus.subscribe('cart:item-added', (msg) => console.log(msg.payload.sku));
bus.subscribe('cart:*', (msg) => console.log(msg.type));
bus.subscribe('*', (msg) => console.log(`${msg.source} sent ${msg.type}`));

// Know who's connected. Called right away, then on every change.
bus.onPeersChange((peers) => console.log(peers.map((p) => p.id)));

// On unmount: announces "system:left" and removes every subscription.
bus.disconnect();
```

## Messages are an envelope

Every message has the same shape, inspired by [CloudEvents](https://cloudevents.io):

```json
{
  "specversion": "1",
  "id": "4f0c…",
  "type": "cart:item-added",
  "source": "cart-app",
  "time": "2026-11-17T10:04:27.000Z",
  "payload": { "sku": "A1", "qty": 1 }
}
```

Name types `namespace:name`, for example `cart:item-added` or `user:signed-in`, so `cart:*` subscriptions stay meaningful.

## Your apps define the message types

The library doesn't know your messages. Declare the ones an app uses with TypeScript declaration merging, and publishing or subscribing to them becomes fully typed:

```ts
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    'cart:item-added': { sku: string; qty: number };
  }
}

bus.publish('cart:item-added', { sku: 'A1' }); // ✗ type error: qty is missing
```

Types you haven't declared still work. Their payload is just `unknown`.

### Optional runtime validation

Pass any [Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType and others) per message type. The library doesn't depend on any of them.

```ts
import { z } from 'zod';

const bus = connect({
  id: 'cart-app',
  schemas: { 'cart:item-added': z.object({ sku: z.string(), qty: z.number().int().positive() }) },
});
```

- Publishing an invalid payload throws, so the mistake shows up where it was made.
- Receiving an invalid payload skips that message for this app and logs a warning.

## Presence: who's connected

`connect()` and `disconnect()` send these system messages for you. The `system:` prefix is reserved.

| Message | Meaning |
| --- | --- |
| `system:ready` | An app just connected and is listening. |
| `system:present` | Reply to `system:ready`: "I was already here". This is how newcomers discover existing apps. |
| `system:left` | An app disconnected. |

Each connection also carries a unique `instance` id. When an app remounts (Angular Elements, React StrictMode, route changes), a late `system:left` from the old instance doesn't remove the new one.

## API

| | |
| --- | --- |
| `connect({ id, name?, version?, schemas? })` | Joins the channel and returns a `Connection`. |
| `connection.publish(type, payload)` | Sends to everyone, including this app's own subscribers. Returns the envelope. |
| `connection.subscribe(pattern, handler)` | `'type'`, `'namespace:*'` or `'*'`. Returns an unsubscribe function. |
| `connection.peers()` | Apps currently connected, not including this one. |
| `connection.onPeersChange(handler)` | Called now and on every change. Returns an unsubscribe function. |
| `connection.disconnect()` | Announces `system:left` and removes every subscription. |

Safety:
- Invalid envelopes are ignored with a warning.
- A handler that throws doesn't stop the other handlers.
- Importing the library never touches `window`, so it's safe for server-side rendering.

## Versioning

Each connection keeps only its own state. So apps bundling different copies or versions of this library still talk to each other, as long as they share the same `specversion`. The wire format follows semver:

- **Patch:** fixes.
- **Minor:** new features that old versions can ignore.
- **Major:** a new `specversion` or other changes to the envelope.

## Source

Part of [frontend-orchestration-platform](https://github.com/stavgian/frontend-orchestration-platform), a demo of a portal composing independently deployed microfrontends at runtime.

## License

MIT

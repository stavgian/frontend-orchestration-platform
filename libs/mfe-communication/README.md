# @stavgian/mfe-communication

Typed, framework-agnostic messaging between microfrontends.

Apps built with Angular, React, plain JavaScript or anything else can talk to each other on the same page, without importing each other's code. Messages are browser-native `CustomEvent`s on `window`, so there is no shared instance to set up and no runtime dependencies.

```bash
npm install @stavgian/mfe-communication
```

## Usage

```ts
import { EVENT_NAMES, publish, subscribe } from '@stavgian/mfe-communication';

// Listen. Returns a function that stops listening.
const stop = subscribe(EVENT_NAMES.statusMessage, (msg) => {
  console.log(`${msg.source} says: ${msg.text}`);
});

// Speak to everyone on the page.
publish(EVENT_NAMES.statusMessage, {
  text: 'Hi everyone!',
  source: 'react-mfe',
  emittedAt: new Date().toISOString(),
});

stop();
```

## Messages

| Event | Payload | Required |
| --- | --- | --- |
| `statusMessage` | `{ text: string; source?: string; emittedAt?: string }` | `text` |

- `publish` throws if a payload is missing a required field, so mistakes show up where they are made.
- `subscribe` skips invalid messages (for example ones sent by code that doesn't use this library) and logs a warning.

## Why it's safe for independent apps

The library holds no state. Each app can bundle its own copy, at its own version, and still hear every other app, as long as the payload format is compatible. That's why the payload format is the public API and follows semver:

- **Patch:** fixes that don't change the format.
- **Minor:** new events or new optional fields.
- **Major:** renamed or removed fields, or new required fields.

## Source

Part of [frontend-orchestration-platform](https://github.com/stavgian/frontend-orchestration-platform), a demo of a portal composing independently deployed microfrontends at runtime.

## License

MIT

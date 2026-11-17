# Changelog

## 2.0.0 (2026-11-17)

A new API. Version 1.0.0 was an early draft with standalone `publish()` and `subscribe()` functions; 2.0.0 replaces it.

### Breaking changes

- `publish()` and `subscribe()` are no longer exported on their own. Call `connect({ id })` and use the returned connection.
- Messages travel in an envelope `{ specversion, id, type, source, time, payload }` on a single DOM event, `mfe-communication:message`. Apps on 1.0.0 cannot talk to apps on 2.0.0.
- The built-in event names (`EVENT_NAMES`) are gone. Apps declare their own message types with TypeScript declaration merging (`MessageMap`, `RequestMap`).

### Features

- **Events:** `publish()` and `subscribe()` on a connection. Subscriptions take an exact type, a namespace (`cart:*`) or everything (`*`).
- **Direct messages:** `publish(type, payload, { to })` reaches a single app. Observers can still see them with `subscribe('*', handler, { observeAll: true })`.
- **Requests:** `request()` and `respond()`, with timeouts and typed `RequestError` codes.
- **Presence:** `system:ready`, `system:present` and `system:left`, with `peers()`, `onPeersChange()` and `ping()`. Every connection has its own instance id, so a late goodbye from an old instance cannot remove a new one.
- **Peer details:** `connect({ name, version, meta })`. `meta` is free-form text that other apps see, for example `{ framework: 'Vue 3.5.45' }`.
- **Validation:** optional Standard Schema validators per message type.
- A failing handler does not stop the others.

## 1.0.0 (2026-11-17)

Initial draft: typed `publish()` and `subscribe()` over browser `CustomEvent`s.

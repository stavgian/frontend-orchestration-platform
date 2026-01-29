# Frontend Orchestration Platform

A framework-agnostic application shell that orchestrates independently deployed microfrontends at runtime.

Microfrontends are discovered via a JSON manifest, loaded dynamically by URL, mounted through custom elements, and coordinated using browser-native, typed event contracts. The shell has no compile-time knowledge of individual MFEs and treats them as black boxes.

## What this project demonstrates

- Runtime discovery and loading of microfrontends via a manifest
- Application shell pattern for composing distributed frontends
- Custom elements as a framework-agnostic integration boundary
- Typed, event-based cross-microfrontend communication
- Independent build and serve of MFEs within an Nx workspace
- Enforced boundaries between shell and microfrontends

## High-level architecture

- Shell
  - Loads a runtime manifest
  - Builds navigation dynamically
  - Loads and mounts MFEs by URL and custom element name
  - Does not import or reference MFE code at build time

- Microfrontends (MFEs)
  - Independently buildable and servable
  - Expose a custom element as their public API
  - Communicate only via shared event contracts

- Shared libraries
  - shared-contract: manifest schema, event names, payload types
  - shared-event-bus: publish / subscribe abstraction over browser-native events

## Runtime manifest

The shell reads a JSON manifest at runtime that describes available MFEs.

Example:

```json
{
  "version": "1.0",
  "mfes": [
    {
      "id": "mfe-a",
      "displayName": "Customer Search",
      "remoteEntry": "http://localhost:4201/remoteEntry.js",
      "module": "./bootstrap",
      "customElement": "customer-search",
      "route": "/search",
      "capabilities": ["publish:customerSelected"]
    },
    {
      "id": "mfe-b",
      "displayName": "Customer Actions",
      "remoteEntry": "http://localhost:4202/remoteEntry.js",
      "module": "./bootstrap",
      "customElement": "customer-actions",
      "route": "/actions",
      "capabilities": ["subscribe:customerSelected", "publish:ticketCreated"]
    }
  ]
}
```

The shell uses this information to load and render MFEs without compile-time coupling.

## Cross-microfrontend communication

Communication is based on browser-native CustomEvents.

- Event names and payloads are defined in shared-contract
- MFEs publish and subscribe via shared-event-bus
- No direct imports between MFEs
- The shell can observe events without participating in business logic

Example flow:
1. MFE A publishes customerSelected
2. MFE B reacts and updates its state
3. MFE B publishes ticketCreated
4. Shell logs the event

## Repository structure

```
apps/
  portal/
  shell/
  mfe-a/
  mfe-b/

libs/
  shared-contract/
  shared-event-bus/
```

## Running locally

Start each application independently:

```bash
nx serve mfe-a
nx serve mfe-b
nx serve shell
nx serve portal
```

The shell loads MFEs at runtime using the manifest configuration.  
The Angular portal reads its runtime manifest from `apps/portal/src/assets/manifest.dev.json`; update those URLs to point at your running MFEs (`angular-mfe`, `react-mfe`, `js-mfe`).

## Design principles

- No compile-time coupling between shell and MFEs
- Browser-native primitives over framework-specific APIs
- Explicit contracts over implicit integration
- Runtime composition over build-time wiring
- Replaceable implementation details

## License

MIT
  

## JS MFE (plain JS)

Run the lightweight dev server (serves the built single file):

```bash
npm run serve:js-mfe
```

It listens on http://localhost:4303/js-mfe.js and is referenced by the portal manifest (`apps/portal/src/assets/manifest.dev.json`).

## React MFE (custom element)

Build and serve the React custom-element bundle:

```bash
npm run build:react-mfe   # produces mfes/react-mfe/dist/react-mfe.js
npm run serve:react-mfe   # builds then serves on http://localhost:4302/dist/react-mfe.js
```

The portal manifest (`apps/portal/src/assets/manifest.dev.json`) points to http://localhost:4302/react-mfe.js.

## Angular MFE (custom element via Module Federation)

Build and serve the Angular custom-element remote:

```bash
npm run build:angular-mfe   # outputs mfes/angular-mfe/dist/remoteEntry.js
npm run serve:angular-mfe   # builds then serves on http://localhost:4301/dist/remoteEntry.js
```

The portal manifest (`apps/portal/src/assets/manifest.dev.json`) points to http://localhost:4301/remoteEntry.js with `remoteName: angularMfe`, `exposedModule: ./bootstrap`, `customElement: angular-mfe`.

## Run everything at once

From the repo root:
```bash
npm run serve:all
```
This runs Angular MFE (4301), React MFE (4302), JS MFE (4303), and the portal (default config, daemon disabled) in parallel with prefixed logs.

# Frontend Orchestration Platform

A framework-agnostic portal that orchestrates independently deployed microfrontends at runtime.

Microfrontends are discovered via a JSON manifest, loaded dynamically by URL, mounted through custom elements, and coordinated using browser-native, typed event contracts. The shell has no compile-time knowledge of individual MFEs and treats them as black boxes.

## What this project demonstrates

- Runtime discovery and loading of microfrontends via a manifest
- Portal pattern for composing distributed frontends (implemented via the Angular portal)
- Custom elements as a framework-agnostic integration boundary
- Typed, event-based cross-microfrontend communication
- Independent build and serve of MFEs within an Nx workspace
- Enforced boundaries between shell and microfrontends

## High-level architecture

- Portal
  - Loads a runtime manifest
  - Builds navigation dynamically
  - Loads and mounts MFEs by URL and custom element name
  - Does not import or reference MFE code at build time

- Microfrontends (MFEs)
  - Independently buildable and servable
  - Expose a custom element as their public API
  - Communicate only via shared event contracts
  - Current MFEs: Angular (module federation), React (script), JS (script)

- Shared libraries
  - shared-contract: manifest schema, event names, payload types
  - shared-event-bus: publish / subscribe abstraction over browser-native events

## Runtime manifest

The portal reads a JSON manifest at runtime that describes available MFEs.

Current dev manifest (`apps/portal/src/assets/manifest.dev.json`):
- Angular MFE (module federation): http://localhost:4301/remoteEntry.js
- React MFE (script): http://localhost:4302/react-mfe.js
- JS MFE (script): http://localhost:4303/js-mfe.js

The portal uses this information to load and render MFEs without compile-time coupling.

## Cross-microfrontend communication

Communication is based on browser-native `CustomEvent`s published on `window`.

- Single event: `statusMessage` → `{ text: string; source?: string; emittedAt?: string }`
- MFEs publish/subscribe via the lightweight `shared-event-bus`.
- The portal listens and logs every status with its source and emitted time; the dashboard header also shows the last heard message.

## Repository structure

```
apps/
  portal/

libs/
  shared-contract/
  shared-event-bus/

mfes/
  angular-mfe/
  react-mfe/
  js-mfe/
```

## Running locally

### One command (recommended)
```bash
npm run serve:all
```
Starts Angular MFE (4301), React MFE (4302), JS MFE (4303), and the portal with prefixed logs.

### Manual start (individual terminals)
```bash
npm run serve:angular-mfe   # 4301 -> remoteEntry.js
npm run serve:react-mfe     # 4302 -> react-mfe.js
npm run serve:js-mfe        # 4303 -> js-mfe.js
NX_DAEMON=false npm run serve:portal
```

The portal manifest (`apps/portal/src/assets/manifest.dev.json`) points to those URLs. Adjust the URLs there if you change ports.

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

Listens on http://localhost:4303/js-mfe.js (portal manifest points here).

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
Runs Angular MFE (4301), React MFE (4302), JS MFE (4303), and the portal (default config, daemon disabled) in parallel with prefixed logs.

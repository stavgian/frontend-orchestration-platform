# Frontend Orchestration Platform

A framework-agnostic portal that orchestrates independently deployed microfrontends at runtime.

Microfrontends are discovered via a JSON manifest, loaded dynamically by URL, mounted through custom elements, and coordinated using browser-native, typed event contracts. The shell has no compile-time knowledge of individual MFEs and treats them as black boxes.

![Preview](./preview.png)

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
  - Loads and mounts every MFE on one page, by URL and custom element name, and draws the frame around each one
  - If an app fails to load (for example, its server is down), its frame says so and offers **Try again**, which fetches the app again; the other apps keep working
  - A single app can also be opened on its own at `/mfe/<id>`
  - Does not import or reference MFE code at build time

- Microfrontends (MFEs)
  - Independently buildable and servable, each with its own `package.json`
  - Expose a custom element as their public API
  - Communicate only through the published `@stavgian/mfe-communication` package
  - Render only their own content; the portal draws the frame around each one
  - Current MFEs, together forming a small shop:
    - **Product catalog** (Angular 22, zoneless with signals, Angular Elements): loaded as a Module Federation–style remote container
    - **Shopping cart** (React 19, a React root inside a custom element): loaded with a script tag
    - **Checkout** (plain JavaScript, a native Web Component): loaded with a script tag
    - **Shipping** (Vue 3.5, `defineCustomElement`): loaded with a script tag; listens to the cart and shows progress towards free shipping
  - Each app reports its framework and version at runtime (presence `meta`, e.g. `Angular 22.2.6`); the shell shows it in the app's "Built with" footer without knowing it at build time
  - Each app also reports how it becomes a web component, so the demo shows four techniques side by side: Angular Elements, a React root inside a custom element, Vue's `defineCustomElement`, and a native Web Component

- Shared library
  - [`@stavgian/mfe-communication`](libs/mfe-communication) (published to npm): events, requests with answers, and presence over browser-native events. The only code the portal and the MFEs share.
  - The manifest format lives in the portal ([`manifest.ts`](apps/portal/src/app/manifest.ts)), because only the portal reads it.

## Runtime manifest

The portal reads a JSON manifest at runtime that describes available MFEs.

Current dev manifest (`apps/portal/src/assets/manifest.dev.json`):
- Angular MFE (Module Federation–style remote): http://localhost:4301/remoteEntry.js
- React MFE (script): http://localhost:4302/react-mfe.js
- JS MFE (script): http://localhost:4303/js-mfe.js
- Vue MFE (script): http://localhost:4304/vue-mfe.js

The portal uses this information to load and render MFEs without compile-time coupling.

## Cross-microfrontend communication

Communication is based on browser-native `CustomEvent`s published on `window`, wrapped by the [`@stavgian/mfe-communication`](libs/mfe-communication) package.

The demo shop uses all three patterns:

| Pattern | In the demo |
| --- | --- |
| **Event**: "something happened" | The catalog publishes `cart:item-added`; the cart adds the item and publishes `cart:updated` with its new total, which checkout shows live. Checkout publishes `order:placed`; the cart empties. |
| **Request**: "I need an answer" | On "Place order", checkout confirms the total with the cart itself: `request('cart:get-summary', …, { to: 'react-mfe' })`. The cart answers with `respond()`. |
| **Direct message**: "just for you" | "Checkout →" in the cart sends `checkout:start` only to checkout (`publish(…, { to: 'js-mfe' })`); the catalog never receives it. The shell portal can also send its announcement to one app only. |
| **Presence**: "who's here?" | When the cart comes online, checkout asks it once for its current total. Events only report changes, so this covers apps that load late. Checkout only allows ordering while the cart is connected. The portal's "Ping all apps" checks every app and shows its response time. |

How it works:
- Each app calls `connect({ id })`, which announces it on the channel (`system:ready`) and discovers apps already connected (`system:present`). `disconnect()` announces `system:left`.
- Every message is an envelope `{ specversion, id, type, source, time, payload }`. Apps choose their own types and declare the payloads they use with TypeScript declaration merging. No shared types package is needed.
- Subscriptions take an exact type, a namespace (`cart:*`) or everything (`*`).
- The portal and every MFE depend on the package by version (`^2.0.0`), never on each other's code. Each connection keeps only its own state, so apps on different library versions still talk as long as they share the same `specversion`.

On one page, the shell portal shows everything live:
- the manifest it loaded the apps from: which apps, how each one is loaded, and from where
- which apps are connected (floating in the top corner) and, in each app's footer, what it is built with
- a channel diagram showing who sent, who was asked, and who answered
- a full-height message log sidebar you can toggle and filter
- toasts while the log is closed

It can also send announcements itself.

See the [package README](libs/mfe-communication/README.md) for the full API.

### How the pieces depend on each other

```
@stavgian/mfe-communication  (npm, semver)
   ▲        ▲          ▲          ▲         ▲
portal  angular-mfe  react-mfe  js-mfe  vue-mfe    ← each pins its own version range
```

In this repo, npm workspaces link the local library source to each app, as long as the library's version satisfies that app's range. An app can stay on `^2` while the library moves to `3.x`, in which case it installs `2.x` from npm instead.

## Adding an app

An app is anything that registers a custom element and talks through `@stavgian/mfe-communication`. To add one, for example a second Angular app on another Angular version:

1. Create `mfes/<name>/` with its own `package.json`. Its dependencies are its own, so a second Angular app can pin a different major version than the first; npm installs it inside that workspace.
2. Build it into a single script that defines the custom element (see the existing `build.mjs` files).
3. Call `connect({ id, name, meta: { framework: …, element: … } })` and use events, requests or presence like the others.
4. Add an entry to `apps/portal/src/assets/manifest.dev.json` and `manifest.prod.json`. The shell needs nothing else: it reads the manifest at runtime.
5. Optionally, give it a friendly name and colour in `apps/portal/src/app/participants.ts`. Without one it uses the manifest's `displayName`.

Two Angular versions already share this page: the shell portal runs Angular 18 with zone.js, and `angular-mfe` runs Angular 22 without zone.js (zoneless change detection with signals). Each brings its own runtime inside its own bundle, so neither upgrade blocks the other.

## Repository structure

```
apps/
  portal/

libs/
  mfe-communication/   ← published to npm as @stavgian/mfe-communication

mfes/
  angular-mfe/
  react-mfe/
  js-mfe/
  vue-mfe/
```

## The apps

Each app builds and serves on its own.

### JS MFE (native Web Component)

Plain JavaScript, no framework. A tiny esbuild step bundles `@stavgian/mfe-communication` into a single file:

```bash
npm run build:js-mfe   # produces mfes/js-mfe/dist/js-mfe.js
npm run serve:js-mfe   # builds then serves on http://localhost:4303/js-mfe.js
```

The portal manifest points to http://localhost:4303/js-mfe.js.

### React MFE (React root in a custom element)

React 19. A small `HTMLElement` class creates a React root when the element is attached and unmounts it when the element is removed.

Build and serve it:

```bash
npm run build:react-mfe   # produces mfes/react-mfe/dist/react-mfe.js
npm run serve:react-mfe   # builds then serves on http://localhost:4302/react-mfe.js
```

The portal manifest (`apps/portal/src/assets/manifest.dev.json`) points to http://localhost:4302/react-mfe.js.

### Angular MFE (Angular Elements, Module Federation–style remote)

Angular 22, zoneless, with signals. esbuild bundles it into `remoteEntry.js`, which registers a small container on `window.angularMfe`; the portal calls its `./bootstrap` module, which defines the custom element with Angular Elements. It is the same shape as a Module Federation remote, without webpack.

Build and serve it:

```bash
npm run build:angular-mfe   # outputs mfes/angular-mfe/dist/remoteEntry.js
npm run serve:angular-mfe   # builds then serves on http://localhost:4301/remoteEntry.js
```

The portal manifest (`apps/portal/src/assets/manifest.dev.json`) points to http://localhost:4301/remoteEntry.js with `remoteName: angularMfe`, `exposedModule: ./bootstrap`, `customElement: angular-mfe`.

### Vue MFE (`defineCustomElement`)

Vue 3.5, written with render functions, turned into a custom element by Vue's `defineCustomElement`:

```bash
npm run build:vue-mfe   # produces mfes/vue-mfe/dist/vue-mfe.js
npm run serve:vue-mfe   # builds then serves on http://localhost:4304/vue-mfe.js
```

## Releasing `@stavgian/mfe-communication`

Releases are made from this repo. A pushed tag triggers [`.github/workflows/publish-mfe-communication.yml`](.github/workflows/publish-mfe-communication.yml), which builds, tests and publishes with npm trusted publishing (no npm token stored, provenance attached).

```bash
npx nx release minor --skip-publish   # or patch / major: bumps version, writes CHANGELOG, commits, tags mfe-communication@x.y.z
git push --follow-tags                # the tag starts the publish workflow
```

Pick the bump by what changed in the payload format: patch for fixes, minor for new events or optional fields, major for renamed/removed fields or new required fields.

Run the library's tests locally with `npm run test:mfe-communication`.

## Running locally

### One command (recommended)
```bash
npm run serve:all
```
Starts Angular MFE (4301), React MFE (4302), JS MFE (4303), Vue MFE (4304), and the portal with prefixed logs.

### Manual start (individual terminals)
```bash
npm run serve:angular-mfe   # 4301 -> remoteEntry.js
npm run serve:react-mfe     # 4302 -> react-mfe.js
npm run serve:js-mfe        # 4303 -> js-mfe.js
npm run serve:vue-mfe       # 4304 -> vue-mfe.js
NX_DAEMON=false npm run serve:portal
```

The portal manifest (`apps/portal/src/assets/manifest.dev.json`) points to those URLs. Adjust the URLs there if you change ports.

`serve:all` stops every server when one of them stops. To see the "Could not load this app" state and **Try again**, start the servers individually, leave one out, then start it and press **Try again**.

## Deploying to GitHub Pages

This repo builds a single Pages artifact with separate URLs for the portal and each MFE.

- Portal: `/REPOSITORY_NAME/`
- Angular MFE: `/REPOSITORY_NAME/angular-mfe/`
- React MFE: `/REPOSITORY_NAME/react-mfe/`
- JS MFE: `/REPOSITORY_NAME/js-mfe/`
- Vue MFE: `/REPOSITORY_NAME/vue-mfe/`

Each MFE folder also has a standalone page that runs the app on its own.

Build the Pages artifact locally:

```bash
npm run build:github-pages
```

The generated output is written to `dist/github-pages`.

Notes:
- The portal production build uses `apps/portal/src/assets/manifest.prod.json`, which points to the deployed MFE folders with relative URLs.
- The build script automatically sets the Angular portal base href to the repository name when running in GitHub Actions.
- The repository includes `.npmrc` with `legacy-peer-deps=true` because the current Nx/Angular toolchain and pinned `esbuild` version do not install cleanly with strict peer resolution.
- If you want to override the deployment base path manually, set `PAGES_BASE_PATH` before running the build.

Examples:

```bash
PAGES_BASE_PATH=my-repo npm run build:github-pages
PAGES_BASE_PATH=/ npm run build:github-pages
```

The workflow in `.github/workflows/deploy-pages.yml` publishes `dist/github-pages` to GitHub Pages on pushes to `main`.

## Deploying to Cloudflare (not active yet)

GitHub Pages is the live deployment. Cloudflare is prepared for later and is not connected right now.

The same static build also runs on Cloudflare, served from the site root. [`wrangler.jsonc`](wrangler.jsonc) tells Cloudflare where the built files are and sends unknown paths (deep links like `/mfe/react-mfe`) to the shell portal.

In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**, pick this repo, and set:

| Setting | Value |
| --- | --- |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npx wrangler deploy` (the default) |
| Worker name | `frontend-orchestration-platform` (must match `name` in `wrangler.jsonc`) |

`build:cloudflare` builds with `PAGES_BASE_PATH=/`. The GitHub Pages build instead uses `/<repository-name>/`, which would break every asset URL on Cloudflare.

To check a build locally the way Cloudflare serves it:

```bash
npm run build:cloudflare
npx wrangler deploy --dry-run   # validates the config and files, uploads nothing
npx wrangler dev                # serves it locally
```

## Design principles

- No compile-time coupling between shell and MFEs
- Browser-native primitives over framework-specific APIs
- Explicit contracts over implicit integration
- Runtime composition over build-time wiring
- Replaceable implementation details

## License

MIT. See [LICENSE](LICENSE).

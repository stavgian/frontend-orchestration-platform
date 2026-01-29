import { EVENT_NAMES, Manifest, MfeDefinition } from "@frontend/shared-contract";
import { subscribe } from "@frontend/shared-event-bus";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Shell root missing");
}

const outlet = document.createElement("div");
outlet.className = "outlet";

const logList = document.createElement("ul");
logList.className = "log";

const loadedRemotes = new Map<string, Promise<void>>();
let manifestCache: Manifest | null = null;

bootstrap().catch((err) => {
  console.error(err);
  appRoot.innerHTML = `<p>Failed to bootstrap shell: ${err.message}</p>`;
});

async function bootstrap() {
  const header = document.createElement("header");
  header.innerHTML = `<h1 class="brand">Frontend Orchestration Shell</h1>`;
  appRoot.appendChild(header);

  const nav = document.createElement("nav");
  const navTitle = document.createElement("h2");
  navTitle.textContent = "Microfrontends";
  nav.appendChild(navTitle);
  const navList = document.createElement("ul");
  navList.className = "nav-list";
  nav.appendChild(navList);

  const main = document.createElement("main");
  main.appendChild(outlet);

  const footer = document.createElement("aside");
  const logTitle = document.createElement("p");
  logTitle.className = "log-title";
  logTitle.textContent = "Event log (window CustomEvents)";
  footer.appendChild(logTitle);
  footer.appendChild(logList);

  appRoot.append(nav, main, footer);

  manifestCache = await loadManifest();
  buildNav(navList, manifestCache);

  wireEventObservers();
  handleInitialRoute();
  window.addEventListener("hashchange", handleRouteChange);
}

async function loadManifest(): Promise<Manifest> {
  const response = await fetch("/assets/mfe-manifest.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load manifest (${response.status})`);
  }
  const data = (await response.json()) as Manifest;
  return data;
}

function buildNav(navList: HTMLUListElement, manifest: Manifest) {
  navList.innerHTML = "";
  manifest.mfes.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "nav-item";
    item.dataset.route = normalizeRoute(entry.route);
    item.innerHTML = `
      <p class="nav-title">${entry.displayName}</p>
      <p class="nav-meta">${entry.customElement} · ${entry.remoteEntry}</p>
    `;
    item.addEventListener("click", () => navigateTo(entry.route));
    navList.appendChild(item);
  });
}

function normalizeRoute(route: string): string {
  if (route.startsWith("#")) return route.slice(1);
  return route.startsWith("/") ? route : `/${route}`;
}

function currentRoute(): string {
  const hash = window.location.hash || "";
  if (!hash) return "";
  return normalizeRoute(hash.replace(/^#/, ""));
}

function handleInitialRoute() {
  const route = currentRoute();
  if (route && manifestCache) {
    const entry = manifestCache.mfes.find(
      (mfe) => normalizeRoute(mfe.route) === route
    );
    if (entry) {
      void renderMfe(entry);
      highlightNav(route);
      return;
    }
  }

  // default to first entry
  const first = manifestCache?.mfes[0];
  if (first) {
    navigateTo(first.route);
  }
}

function handleRouteChange() {
  const route = currentRoute();
  if (!manifestCache) return;
  const entry = manifestCache.mfes.find(
    (mfe) => normalizeRoute(mfe.route) === route
  );
  if (entry) {
    highlightNav(route);
    void renderMfe(entry);
  }
}

function navigateTo(route: string) {
  const normalized = normalizeRoute(route);
  if (currentRoute() === normalized) {
    handleRouteChange();
    return;
  }
  window.location.hash = normalized;
}

function highlightNav(route: string) {
  const normalized = normalizeRoute(route);
  document
    .querySelectorAll<HTMLLIElement>(".nav-item")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.route === normalized)
    );
}

async function renderMfe(entry: MfeDefinition) {
  const placeholder = document.createElement("p");
  placeholder.textContent = `Loading ${entry.displayName}…`;
  outlet.replaceChildren(placeholder);

  try {
    await ensureRemoteLoaded(entry);
    await waitForCustomElement(entry.customElement);
    const element = document.createElement(entry.customElement);
    outlet.replaceChildren(element);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to mount microfrontend";
    const error = document.createElement("p");
    error.textContent = message;
    outlet.replaceChildren(error);
    console.error(err);
  }
}

async function ensureRemoteLoaded(entry: MfeDefinition): Promise<void> {
  if (loadedRemotes.has(entry.id)) {
    return loadedRemotes.get(entry.id)!;
  }

  const loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-remote="${entry.id}"]`
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = entry.remoteEntry;
    script.dataset.remote = entry.id;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load remote ${entry.displayName}`));
    document.head.appendChild(script);
  });

  loadedRemotes.set(entry.id, loading);
  return loading;
}

async function waitForCustomElement(
  tagName: string,
  timeoutMs = 5000
): Promise<void> {
  if (customElements.get(tagName)) return;
  let resolved = false;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (resolved) return;
      reject(new Error(`Custom element ${tagName} not registered in time`));
    }, timeoutMs);

    const check = () => {
      if (customElements.get(tagName)) {
        resolved = true;
        window.clearTimeout(timer);
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

function wireEventObservers() {
  subscribe(EVENT_NAMES.customerSelected, (payload) => {
    addLog(`customerSelected → ${payload.customerId} (${payload.name})`);
  });

  subscribe(EVENT_NAMES.ticketCreated, (payload) => {
    addLog(`ticketCreated → ${payload.ticketId} (customer ${payload.customerId})`);
  });
}

function addLog(message: string) {
  const item = document.createElement("li");
  item.className = "log-entry";
  const now = new Date().toLocaleTimeString();
  item.innerHTML = `<strong>${now}</strong> · ${message}`;
  logList.prepend(item);
  // keep last 12 entries
  const entries = logList.querySelectorAll(".log-entry");
  if (entries.length > 12) {
    const last = logList.lastElementChild;
    if (last) last.remove();
  }
}

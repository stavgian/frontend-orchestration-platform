import { Injectable } from '@angular/core';
import { Manifest, MfeDefinition } from '@frontend/shared-contract';

@Injectable({ providedIn: 'root' })
export class MfeLoaderService {
  private manifestPromise?: Promise<Manifest>;
  private scriptCache = new Map<string, Promise<void>>();

  getManifest(url = '/assets/manifest.dev.json'): Promise<Manifest> {
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load manifest (${response.status})`);
        }
        return (await response.json()) as Manifest;
      });
    }

    return this.manifestPromise;
  }

  async loadMfe(definition: MfeDefinition): Promise<void> {
    const additionalScripts = definition.scripts ?? [];
    for (const script of additionalScripts) {
      await this.loadScript(script);
    }

    if (definition.type === 'module-federation') {
      if (!definition.remoteEntry) {
        throw new Error(`remoteEntry is required for ${definition.id}`);
      }

      await this.loadScript(definition.remoteEntry);
      await this.initModuleFederation(definition);
    } else if (definition.remoteEntry) {
      // allow loading a module script for non-module federation MFEs
      await this.loadScript(definition.remoteEntry, 'module');
    }

    await this.waitForCustomElement(definition.customElement);
  }

  private loadScript(
    url: string,
    type: 'module' | 'text/javascript' = 'text/javascript'
  ): Promise<void> {
    if (this.scriptCache.has(url)) {
      return this.scriptCache.get(url)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.type = type;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script ${url}`));
      document.head.appendChild(script);
    });

    this.scriptCache.set(url, promise);
    return promise;
  }

  private async initModuleFederation(definition: MfeDefinition): Promise<void> {
    if (!definition.remoteName || !definition.exposedModule) {
      return;
    }

    const container = await this.waitForRemoteContainer(
      definition.remoteName,
      definition.remoteEntry
    );

    if (!(container as any).__initialized) {
      const initSharing = (window as any).__webpack_init_sharing__;
      if (typeof initSharing === 'function') {
        await initSharing('default');
      }

      const shareScopes = (window as any).__webpack_share_scopes__;
      if (shareScopes?.default && typeof container.init === 'function') {
        await container.init(shareScopes.default);
      }

      (container as any).__initialized = true;
    }

    if (typeof container.get === 'function') {
      const factory = await container.get(definition.exposedModule);
      if (typeof factory === 'function') {
        const module = factory();
        if (typeof module?.default === 'function') {
          module.default();
        }
      }
    }
  }

  private waitForCustomElement(tagName: string, timeoutMs = 8000): Promise<void> {
    if (customElements.get(tagName)) {
      return Promise.resolve();
    }

    let timer: ReturnType<typeof setTimeout>;

    return new Promise<void>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Custom element ${tagName} not defined in time`)),
        timeoutMs
      );

      customElements
        .whenDefined(tagName)
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private waitForRemoteContainer(
    remoteName: string,
    remoteEntry?: string,
    timeoutMs = 4000
  ): Promise<any> {
    const existing = (window as any)[remoteName];
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const started = performance.now();

      const check = () => {
        const found = (window as any)[remoteName];
        if (found) {
          resolve(found);
          return;
        }
        if (performance.now() - started > timeoutMs) {
          reject(
            new Error(
              `Remote container ${remoteName} not found after loading ${remoteEntry ?? ""}`
            )
          );
          return;
        }
        requestAnimationFrame(check);
      };

      check();
    });
  }
}

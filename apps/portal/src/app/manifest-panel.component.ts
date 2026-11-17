import { JsonPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { Manifest, MfeDefinition } from './manifest';
import { participantForMfe } from './participants';

/**
 * Shows the manifest the shell portal read at startup: the only place it learns which apps
 * exist and how to load them. Nothing about the apps is built into the shell.
 */
@Component({
  selector: 'app-manifest-panel',
  standalone: true,
  imports: [JsonPipe],
  template: `
    <details class="panel manifest">
      <summary>
        <span class="icon" aria-hidden="true">{{ '{ }' }}</span>
        <span class="titles">
          <strong>Manifest</strong>
          <span class="sub">
            Read at startup from <code>{{ fileName() }}</code> (v{{ manifest().version }}). This file, not the code, tells the shell which apps exist.
          </span>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </summary>

      <div class="body">
        <table>
          <thead>
            <tr><th>App</th><th>Loaded as</th><th>From</th><th>Custom element</th></tr>
          </thead>
          <tbody>
            @for (mfe of manifest().mfes; track mfe.id) {
              @let who = participant(mfe);
              <tr [style.--c]="who.color">
                <td><span class="dot" aria-hidden="true"></span>{{ who.name }}</td>
                <td>{{ mfe.type === 'module-federation' ? 'Module Federation remote' : 'Script' }}</td>
                <td><code class="url">{{ entryOf(mfe) }}</code></td>
                <td><code>&lt;{{ mfe.customElement }}&gt;</code></td>
              </tr>
            }
          </tbody>
        </table>
        <details class="raw">
          <summary>Raw JSON · <a [href]="url()" target="_blank" rel="noopener">open file</a></summary>
          <pre>{{ manifest() | json }}</pre>
        </details>
      </div>
    </details>
  `,
  styles: `
    .manifest { padding: 0; }
    summary { list-style: none; cursor: pointer; }
    summary::-webkit-details-marker { display: none; }
    .manifest > summary { display: flex; align-items: center; gap: 12px; padding: 14px 20px; }
    .icon {
      flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
      font: 600 13px var(--font-mono); color: var(--portal);
      background: color-mix(in srgb, var(--portal) 10%, transparent);
    }
    .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    strong { font: 600 15px var(--font-display); }
    .sub { color: var(--subtle); font-size: 13px; }
    .chevron { color: var(--subtle); font-size: 20px; transition: rotate 150ms; }
    .manifest[open] > summary .chevron { rotate: 90deg; }
    code { font: 12px var(--font-mono); color: var(--text); }
    .body { padding: 0 20px 16px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-weight: 500; color: var(--subtle); padding: 6px 10px 6px 0; border-bottom: 1px solid var(--border); }
    td { padding: 8px 10px 8px 0; border-bottom: 1px solid var(--border); white-space: nowrap; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); margin-right: 8px; }
    .url { color: var(--subtle); }
    .raw { margin-top: 12px; font-size: 13px; color: var(--subtle); }
    .raw a { color: var(--accent); }
  `,
})
export class ManifestPanelComponent {
  readonly manifest = input.required<Manifest>();
  readonly url = input.required<string>();

  readonly fileName = () => this.url().split('/').pop() ?? this.url();
  readonly participant = participantForMfe;
  entryOf(mfe: MfeDefinition): string {
    return mfe.remoteEntry ?? mfe.scripts?.[0] ?? '—';
  }
}

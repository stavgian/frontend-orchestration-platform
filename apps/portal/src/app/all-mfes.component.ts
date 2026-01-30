import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { EVENT_NAMES, Manifest, MfeDefinition, StatusMessagePayload } from '@frontend/shared-contract';
import { subscribe } from '@frontend/shared-event-bus';
import { MfeHostComponent } from './mfe-host.component';
import { MfeLoaderService } from './mfe-loader.service';

@Component({
  selector: 'app-all-mfes',
  standalone: true,
  imports: [CommonModule, MfeHostComponent],
  template: `
    <div class="all-wrapper">
      <div class="all-header">
        <div class="title">Dashboards</div>
        <div class="subtitle" *ngIf="manifestVersion">Manifest v{{ manifestVersion }}</div>
        <div class="error" *ngIf="error">{{ error }}</div>
        <div class="last-status" *ngIf="lastStatus">
          Last heard: {{ lastStatus.text }} <span class="from">({{ lastStatus.source || 'unknown' }})</span>
        </div>
      </div>
      <div class="all-grid">
        <section *ngFor="let mfe of mfes" class="card">
          <header>
            <div class="name">{{ mfe.displayName }}</div>
            <div class="meta">/{{ mfe.route || mfe.id }} · {{ mfe.customElement }}</div>
          </header>
          <app-mfe-host [definition]="mfe"></app-mfe-host>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .all-wrapper { display:flex; flex-direction:column; gap:16px; }
      .all-header { display:flex; gap:12px; align-items:center; }
      .title { font-size:20px; font-weight:700; }
      .subtitle { color:#9fb1c9; font-size:12px; }
      .last-status { color:#9fb1c9; font-size:12px; }
      .last-status .from { color:#6bdcff; }
      .error { color:#ff9cb3; font-size:12px; }
      .all-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px,1fr)); gap:16px; }
      .card { background: var(--panel, #0f1621); border:1px solid var(--border, rgba(255,255,255,0.08)); border-radius:12px; padding:12px; box-shadow: var(--shadow, 0 10px 40px rgba(0,0,0,0.35)); }
      header { margin-bottom:8px; }
      .name { font-weight:700; }
      .meta { color:#9fb1c9; font-size:12px; }
    `,
  ],
})
export class AllMfesComponent implements OnInit {
  mfes: MfeDefinition[] = [];
  manifestVersion?: Manifest['version'];
  error?: string;
  lastStatus?: StatusMessagePayload;
  private unsubscribeStatus?: () => void;

  constructor(private readonly loader: MfeLoaderService) {}

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await this.loader.getManifest();
      this.mfes = manifest.mfes;
      this.manifestVersion = manifest.version;
    } catch (err) {
      this.error = (err as Error)?.message ?? 'Unable to load manifest';
    }

    this.unsubscribeStatus = subscribe(EVENT_NAMES.statusMessage, (msg) => {
      this.lastStatus = msg;
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeStatus?.();
  }
}

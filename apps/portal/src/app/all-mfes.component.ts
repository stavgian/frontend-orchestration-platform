import { Component, OnInit, inject } from '@angular/core';
import { MfeDefinition } from './manifest';
import { MfeHostComponent } from './mfe-host.component';
import { MfeLoaderService } from './mfe-loader.service';
import { Participant, participantForMfe } from './participants';

@Component({
  selector: 'app-all-mfes',
  standalone: true,
  imports: [MfeHostComponent],
  template: `
    @if (error) {
      <div class="panel error">{{ error }}</div>
    }
    <div class="grid">
      @for (item of items; track item.mfe.id) {
        <section class="panel card" [style.--c]="item.who.color">
          <header>
            <div class="avatar" aria-hidden="true">{{ item.who.initials }}</div>
            <div>
              <h3>{{ item.who.name }}</h3>
              <p>{{ item.who.tech }}</p>
            </div>
          </header>
          <app-mfe-host [definition]="item.mfe" />
        </section>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
    .card { padding: 18px; border-top: 3px solid var(--c); }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 50%;
      display: grid; place-items: center; background: var(--c);
      font: 700 12px var(--font-display); color: #0a0f16;
    }
    h3 { margin: 0; font: 600 16px/1.2 var(--font-display); }
    p { margin: 2px 0 0; color: var(--subtle); font-size: 13px; }
    .error { padding: 16px; margin-bottom: 16px; color: var(--danger); }
  `,
})
export class AllMfesComponent implements OnInit {
  private readonly loader = inject(MfeLoaderService);

  items: { mfe: MfeDefinition; who: Participant }[] = [];
  error?: string;

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await this.loader.getManifest();
      this.items = manifest.mfes.map((mfe) => ({ mfe, who: participantForMfe(mfe) }));
    } catch (err) {
      this.error = (err as Error)?.message ?? 'Unable to load manifest';
    }
  }
}

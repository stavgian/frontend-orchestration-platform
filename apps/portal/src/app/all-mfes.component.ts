import { Component, OnInit, inject } from '@angular/core';
import { MfeDefinition } from './manifest';
import { MessageFeedService } from './message-feed.service';
import { MfeHostComponent } from './mfe-host.component';
import { MfeLoaderService } from './mfe-loader.service';
import { Participant, participantForMfe } from './participants';

/** One frame per app: the portal owns the frame, each app renders only its own content inside. */
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
        @let online = feed.connectedIds().has(item.mfe.id);
        <section class="panel card" [style.--c]="item.who.color" [attr.aria-label]="item.who.name">
          <header>
            <div class="avatar" aria-hidden="true">{{ item.who.initials }}</div>
            <div class="titles">
              <h3>{{ item.who.name }}</h3>
              <p>
                <span class="live" [class.off]="!online" aria-hidden="true"></span>
                {{ online ? 'Connected' : 'Not connected' }} · {{ item.who.tech }}
              </p>
            </div>
          </header>
          <app-mfe-host [definition]="item.mfe" />
        </section>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: start; }
    .card { padding: 18px; border-top: 3px solid var(--c); }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 50%;
      display: grid; place-items: center; background: var(--c);
      font: 700 12px var(--font-display); color: #0a0f16;
    }
    h3 { margin: 0; font: 600 16px/1.2 var(--font-display); }
    p { margin: 3px 0 0; color: var(--subtle); font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .live { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; }
    .live.off { background: transparent; box-shadow: none; border: 1.5px solid var(--subtle); }
    .error { padding: 16px; margin-bottom: 16px; color: var(--danger); }
  `,
})
export class AllMfesComponent implements OnInit {
  private readonly loader = inject(MfeLoaderService);
  readonly feed = inject(MessageFeedService);

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

import { Component, ElementRef, OnInit, inject, viewChildren, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MfeDefinition } from './manifest';
import { FeedMessage, MessageFeedService, isRecipient } from './message-feed.service';
import { MfeHostComponent } from './mfe-host.component';
import { MfeLoaderService } from './mfe-loader.service';
import { Participant, participantForMfe } from './participants';

/**
 * One frame per app: the portal owns the frame, each app renders only its own content inside.
 * Frames light up when their app sends or receives, so traffic is visible on the real apps.
 */
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
        <section #card class="panel card" [attr.data-app]="item.mfe.id" [style.--c]="item.who.color" [attr.aria-label]="item.who.name">
          <header>
            <div class="avatar" aria-hidden="true">{{ item.who.initials }}</div>
            <div class="titles">
              <h3>{{ item.who.name }}</h3>
              <p>
                <span class="live" [class.off]="!online" aria-hidden="true"></span>
                {{ online ? 'Connected' : 'Not connected' }}
              </p>
            </div>
            <span class="activity" aria-hidden="true"></span>
          </header>
          <app-mfe-host [definition]="item.mfe" />
          <!-- Framework and web-component technique come from the app itself at runtime (presence metadata), not from the shell. -->
          <footer class="built">
            <span><span class="label">Built with</span> <strong>{{ feed.frameworks().get(item.mfe.id) ?? item.who.tech }}</strong></span>
            @if (feed.elements().get(item.mfe.id); as element) {
              <span><span class="label">As</span> <strong>{{ element }}</strong></span>
            }
          </footer>
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: start; }
    .card { position: relative; padding: 20px; }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .titles { flex: 1; min-width: 0; }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 50%;
      display: grid; place-items: center; background: var(--c);
      font: 700 12px var(--font-sans); color: var(--on-color);
    }
    h3 { margin: 0; font: 600 17px/1.3 var(--font-sans); letter-spacing: -0.01em; }
    p { margin: 3px 0 0; color: var(--subtle); font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .activity {
      position: absolute; top: 14px; right: 14px; pointer-events: none;
      padding: 2px 8px; border-radius: 99px; font: 600 11px var(--font-mono); white-space: nowrap;
      color: var(--on-color); background: var(--pulse, var(--c)); opacity: 0;
    }
    .built {
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px;
      margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border);
      font-size: 13px; color: var(--text-secondary);
    }
    .label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 4px; }
    .built strong { color: var(--text); font-weight: 600; }
    .error { padding: 16px; margin-bottom: 16px; color: var(--danger); }
  `,
})
export class AllMfesComponent implements OnInit {
  private readonly loader = inject(MfeLoaderService);
  readonly feed = inject(MessageFeedService);
  private readonly cards = viewChildren<ElementRef<HTMLElement>>('card');

  items: { mfe: MfeDefinition; who: Participant }[] = [];
  error?: string;

  constructor() {
    // Every message, even several in the same instant (e.g. three apps answering a ping round).
    this.feed.arrivals
      .pipe(takeUntilDestroyed())
      .subscribe((message) => this.cards().forEach((card) => this.highlight(card.nativeElement, message)));
  }

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await this.loader.getManifest();
      this.items = manifest.mfes.map((mfe) => ({ mfe, who: participantForMfe(mfe) }));
    } catch (err) {
      this.error = (err as Error)?.message ?? 'Unable to load manifest';
    }
  }

  /** Glows the frame in the sender's colour and shows what happened, using the Web Animations API. */
  private highlight(card: HTMLElement, message: FeedMessage): void {
    const appId = card.dataset['app'] ?? '';
    const sent = message.sender.id === appId;
    if (!sent && !isRecipient(message, appId)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const color = message.sender.color;
    const label = card.querySelector<HTMLElement>('.activity');
    if (label) {
      label.textContent = sent
        ? message.kind === 'request' ? 'Asked' : message.kind === 'reply' ? 'Answered' : 'Sent'
        : 'Received';
      label.style.setProperty('--pulse', color);
      label.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1800 });
    }
    card.animate(
      [
        { boxShadow: `0 0 0 2px ${color}, 0 0 28px ${color}66` },
        { boxShadow: `0 0 0 1px ${color}00, 0 0 0 ${color}00` },
      ],
      { duration: sent ? 1200 : 1000, delay: sent ? 0 : 350, easing: 'ease-out' }
    );
  }
}

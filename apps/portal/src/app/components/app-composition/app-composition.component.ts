import { Component, ElementRef, OnInit, computed, inject, signal, viewChildren, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../icon/icon.component';
import { ContextService } from '../../core/context/context.service';
import { MfeDefinition } from '../../core/manifest/manifest';
import { FeedMessage, MessageFeedService, isRecipient } from '../../core/messaging/message-feed.service';
import { MfeHostComponent } from '../mfe-host/mfe-host.component';
import { MfeLoaderService } from '../../core/mfe-loader/mfe-loader.service';
import { Participant, participantForMfe } from '../../core/participants/participants';
import { ScenarioApp } from '../../core/scenario/scenario';
import { ScenarioService } from '../../core/scenario/scenario.service';

interface Slot {
  mfe: MfeDefinition;
  who: Participant;
  app: ScenarioApp;
}

/**
 * One frame per app that is compatible with the active context type: the portal owns the frame,
 * each app renders only its own content inside. Frames light up when their app sends or receives.
 * Switching between contexts of the same type keeps every app mounted; they follow the context over the channel.
 */
@Component({
  selector: 'app-composition',
  standalone: true,
  imports: [MfeHostComponent, IconComponent],
  template: `
    @if (error()) {
      <div class="panel error">{{ error() }}</div>
    }
    <div class="grid">
      @for (item of slots(); track item.mfe.id) {
        @let online = feed.connectedIds().has(item.mfe.id);
        <section #card class="panel card" [attr.data-app]="item.mfe.id" [style.--c]="item.who.color" [attr.aria-label]="item.who.name">
          <header>
            <div class="ico-tile" aria-hidden="true">@if (item.who.icon) { <app-icon [name]="item.who.icon" /> } @else { {{ item.who.initials }} }</div>
            <div class="titles">
              <h3>{{ item.who.name }}</h3>
              <p class="dept">{{ item.app.department }} · {{ item.app.responsibility }}</p>
            </div>
            <span class="chip" [class.off]="!online">
              <span class="live" [class.off]="!online" aria-hidden="true"></span>
              {{ online ? 'Connected' : 'Not connected' }}
            </span>
            <span class="activity" aria-hidden="true"></span>
          </header>
          <app-mfe-host [definition]="item.mfe" />
          <!-- The framework and its version come from the app itself at runtime (presence metadata). -->
          <footer class="built">
            @if (feed.frameworks().get(item.mfe.id); as framework) {
              <span>
                <span class="label">Built with</span>
                @if (item.who.logo; as logo) { <img class="logo" [src]="logo" alt="" /> }
                <strong>{{ framework }}</strong>
              </span>
            }
          </footer>
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: stretch; }
    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    .card { position: relative; display: flex; flex-direction: column; padding: 20px; border-top: 3px solid var(--c); }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .titles { flex: 1; min-width: 0; }
    h3 { margin: 0; font: 600 17px/1.3 var(--font-sans); letter-spacing: -0.01em; }
    p { margin: 3px 0 0; color: var(--subtle); font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .dept { display: block; }
    .chip { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, white); }
    .chip.off { color: var(--subtle); background: var(--surface); }
    .activity {
      position: absolute; top: 46px; right: 14px; pointer-events: none;
      padding: 2px 8px; border-radius: 99px; font: 600 11px var(--font-mono); white-space: nowrap;
      color: var(--on-color); background: var(--pulse, var(--c)); opacity: 0;
    }
    app-mfe-host { flex: 1; }
    .built {
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px;
      margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border);
      font-size: 13px; color: var(--text-secondary);
    }
    .label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 4px; }
    .built strong { color: var(--text); font-weight: 600; }
    .logo { width: 14px; height: 14px; margin-right: 4px; vertical-align: -2px; }
    .error { padding: 16px; margin-bottom: 16px; color: var(--danger); }
  `,
})
export class AppCompositionComponent implements OnInit {
  private readonly loader = inject(MfeLoaderService);
  private readonly context = inject(ContextService);
  private readonly scenario = inject(ScenarioService).scenario;
  private readonly contextType = computed(() => this.context.active()?.contextType);
  readonly feed = inject(MessageFeedService);
  private readonly cards = viewChildren<ElementRef<HTMLElement>>('card');
  private readonly manifestMfes = signal<MfeDefinition[]>([]);

  readonly error = signal<string | undefined>(undefined);
  /** Apps the scenario lists for this context type, joined with how the manifest says to load them. */
  readonly slots = computed<Slot[]>(() => {
    const type = this.contextType();
    const mfes = this.manifestMfes();
    return (this.scenario()?.apps ?? [])
      .filter((app) => type && app.contextTypes.includes(type))
      .flatMap((app) => {
        const mfe = mfes.find((m) => m.id === app.id);
        return mfe ? [{ mfe, app, who: participantForMfe(mfe) }] : [];
      });
  });

  constructor() {
    // Every message, even several in the same instant.
    this.feed.arrivals
      .pipe(takeUntilDestroyed())
      .subscribe((message) => this.cards().forEach((card) => this.highlight(card.nativeElement, message)));
  }

  async ngOnInit(): Promise<void> {
    try {
      this.manifestMfes.set((await this.loader.getManifest()).mfes);
    } catch (err) {
      this.error.set((err as Error)?.message ?? 'Unable to load manifest');
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

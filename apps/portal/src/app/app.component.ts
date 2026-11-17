import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Manifest, MfeDefinition } from './manifest';
import { manifestUrl } from './manifest-url';
import { ManifestPanelComponent } from './manifest-panel.component';
import { MessageChannelComponent } from './message-channel.component';
import { MessageFeedService } from './message-feed.service';
import { MessageLogComponent } from './message-log.component';
import { MfeLoaderService } from './mfe-loader.service';
import { ToastStackComponent } from './toast-stack.component';
import { version } from '../../package.json';

const LOG_PREF_KEY = 'portal.message-log';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ManifestPanelComponent,
    MessageChannelComponent,
    MessageLogComponent,
    ToastStackComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly loader = inject(MfeLoaderService);
  private readonly router = inject(Router);
  readonly feed = inject(MessageFeedService);

  readonly year = new Date().getFullYear();
  /** The portal's own release version, bumped by `nx release` (tag portal@x.y.z). */
  readonly version = version;
  readonly manifestUrl = manifestUrl;
  manifest?: Manifest;
  mfes: MfeDefinition[] = [];
  loadingManifest = true;
  manifestError?: string;

  readonly logOpen = signal(initialLogOpen());
  /** Messages that arrived while the log was closed. */
  private readonly seenCount = signal(0);
  readonly unread = computed(() =>
    this.logOpen() ? 0 : this.feed.messageCount() - this.seenCount()
  );

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await this.loader.getManifest();
      this.manifest = manifest;
      this.mfes = manifest.mfes;
      this.redirectUnknownMfeRoute();
    } catch (err) {
      this.manifestError = (err as Error)?.message ?? 'Unable to load manifest';
    } finally {
      this.loadingManifest = false;
    }
  }

  toggleLog(open = !this.logOpen()): void {
    if (!open) this.seenCount.set(this.feed.messageCount());
    this.logOpen.set(open);
    try {
      localStorage.setItem(LOG_PREF_KEY, open ? 'open' : 'closed');
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }

  private redirectUnknownMfeRoute(): void {
    if (!this.router.url.startsWith('/mfe/')) return;

    const id = this.router.routerState.snapshot.root.firstChild?.params['id'];
    const known = this.mfes.some((mfe) => mfe.id === id || mfe.route === id);
    const first = this.mfes[0];
    if (!known && first) {
      this.router.navigate(['mfe', first.route ?? first.id]);
    }
  }
}

/** Remembered choice, or open by default when there's room beside the apps. */
function initialLogOpen(): boolean {
  try {
    const saved = localStorage.getItem(LOG_PREF_KEY);
    if (saved) return saved === 'open';
  } catch {
    // Fall through to the default.
  }
  return typeof window !== 'undefined' && window.innerWidth >= 1200;
}

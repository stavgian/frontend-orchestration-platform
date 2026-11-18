import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { IconComponent } from './components/icon/icon.component';
import { ContextService } from './core/context/context.service';
import { ScenarioService } from './core/scenario/scenario.service';
import { Manifest, MfeDefinition } from './core/manifest/manifest';
import { manifestUrl } from './core/manifest/manifest-url';
import { ManifestPanelComponent } from './components/manifest-panel/manifest-panel.component';
import { LogPanelService } from './core/messaging/log-panel.service';
import { MessageFeedService } from './core/messaging/message-feed.service';
import { MessageLogComponent } from './components/message-log/message-log.component';
import { MfeLoaderService } from './core/mfe-loader/mfe-loader.service';
import { ProjectLinksComponent } from './components/project-links/project-links.component';
import { ToastStackComponent } from './components/toast-stack/toast-stack.component';
import { version } from '../../package.json';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    RouterOutlet,
    IconComponent,
    ManifestPanelComponent,
    MessageLogComponent,
    ProjectLinksComponent,
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
  readonly scenarioService = inject(ScenarioService);
  readonly scenario = this.scenarioService.scenario;
  /** The hero introduces the platform on the landing page only. */
  readonly onLanding = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0] === '/')
    ),
    { initialValue: true }
  );

  constructor() {
    // Starts answering `context:get` before any app has loaded.
    inject(ContextService);
  }

  namesOf(appIds: string[]): string {
    return appIds.map((id) => this.nameOf(id)).join(', ');
  }

  nameOf(appId: string): string {
    return this.mfes.find((m) => m.id === appId)?.display.name ?? appId;
  }

  readonly year = new Date().getFullYear();
  /** The shell portal's own release version, bumped by `nx release` (tag portal@x.y.z). */
  readonly version = version;
  readonly manifestUrl = manifestUrl;
  manifest?: Manifest;
  mfes: MfeDefinition[] = [];
  loadingManifest = true;
  manifestError?: string;

  readonly log = inject(LogPanelService);

  async ngOnInit(): Promise<void> {
    try {
      const [manifest] = await Promise.all([this.loader.getManifest(), this.scenarioService.load()]);
      this.manifest = manifest;
      this.mfes = manifest.mfes;
    } catch (err) {
      this.manifestError = (err as Error)?.message ?? 'Unable to load manifest';
    } finally {
      this.loadingManifest = false;
    }
  }
}

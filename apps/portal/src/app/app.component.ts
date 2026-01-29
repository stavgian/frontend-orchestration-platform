import { CommonModule, DatePipe, JsonPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  EVENT_NAMES,
  EventPayloadMap,
  Manifest,
  MfeDefinition,
} from '@frontend/shared-contract';
import { subscribe } from '@frontend/shared-event-bus';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { MfeLoaderService } from './mfe-loader.service';

type EventLogEntry = {
  name: keyof EventPayloadMap;
  payload: EventPayloadMap[keyof EventPayloadMap];
  timestamp: number;
  source?: string;
  emittedAt?: string;
};

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    JsonPipe,
    DatePipe,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  mfes: MfeDefinition[] = [];
  manifestVersion?: Manifest['version'];
  logs: EventLogEntry[] = [];
  loadingManifest = true;
  manifestError?: string;
  activeMfeId?: string;

  private eventUnsubscribers: Array<() => void> = [];
  private navSub?: Subscription;

  constructor(
    private readonly loader: MfeLoaderService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.navSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => (this.activeMfeId = this.currentRouteId()));

    try {
      const manifest = await this.loader.getManifest();
      this.mfes = manifest.mfes;
      this.manifestVersion = manifest.version;
      this.activeMfeId = this.currentRouteId();

      const isMfeRoute = this.router.url.startsWith('/mfe/');
      if (isMfeRoute && (!this.activeMfeId || !this.findMfe(this.activeMfeId))) {
        const first = manifest.mfes[0];
        if (first) {
          this.router.navigate(['mfe', first.route ?? first.id]);
        }
      }
    } catch (err) {
      this.manifestError = (err as Error)?.message ?? 'Unable to load manifest';
    } finally {
      this.loadingManifest = false;
    }

    this.setupEventLog();
  }

  ngOnDestroy(): void {
    this.eventUnsubscribers.forEach((fn) => fn());
    this.navSub?.unsubscribe();
  }

  navLink(mfe: MfeDefinition) {
    return ['/mfe', mfe.route ?? mfe.id];
  }

  trackById = (_: number, mfe: MfeDefinition) => mfe.id;

  private setupEventLog(): void {
    this.eventUnsubscribers.push(
      subscribe(EVENT_NAMES.customerSelected, (payload) =>
        this.addLog(EVENT_NAMES.customerSelected, payload)
      ),
      subscribe(EVENT_NAMES.ticketCreated, (payload) =>
        this.addLog(EVENT_NAMES.ticketCreated, payload)
      )
    );
  }

  private addLog(
    name: keyof EventPayloadMap,
    payload: EventPayloadMap[keyof EventPayloadMap]
  ): void {
    const entry: EventLogEntry = {
      name,
      payload,
      timestamp: Date.now(),
      source: (payload as any).source,
      emittedAt: (payload as any).emittedAt,
    };
    this.logs = [entry, ...this.logs].slice(0, 50);
  }

  private currentRouteId(): string | undefined {
    const child = this.router.routerState.snapshot.root.firstChild;
    return child?.params['id'];
  }

  private findMfe(id?: string): MfeDefinition | undefined {
    if (!id) return undefined;
    return this.mfes.find((mfe) => mfe.id === id || mfe.route === id);
  }
}

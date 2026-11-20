import { Component, OnDestroy, computed, effect, inject, untracked, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from, map } from 'rxjs';
import { ContextService } from '../../core/context/context.service';
import { ScenarioService } from '../../core/scenario/scenario.service';
import { IconComponent } from '../icon/icon.component';
import { AppCompositionComponent } from '../app-composition/app-composition.component';
import { MessageChannelComponent } from '../message-channel/message-channel.component';
import { MfeLoaderService } from '../../core/mfe-loader/mfe-loader.service';
import { MessageFeedService } from '../../core/messaging/message-feed.service';

/**
 * Generic detail page: `/:contextId` activates that context and composes the compatible apps around it.
 * The page stays mounted when the id changes, so already loaded apps just receive the new context.
 */
@Component({
  selector: 'app-context-page',
  standalone: true,
  imports: [RouterLink, IconComponent, AppCompositionComponent, MessageChannelComponent],
  templateUrl: './context-page.component.html',
  styleUrl: './context-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ContextPageComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly context = inject(ContextService);
  private readonly loader = inject(MfeLoaderService);
  readonly feed = inject(MessageFeedService);
  readonly scenario = inject(ScenarioService).scenario;
  private readonly contextId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('contextId'))));

  readonly record = computed(() => this.scenario()?.contexts.find((c) => c.id === this.contextId()));
  readonly siblings = computed(() => this.scenario()?.contexts ?? []);
  readonly manifest = toSignal(from(this.loader.getManifest()));
  readonly mfes = computed(() => this.manifest()?.mfes ?? []);
  /** True once every app on the page is connected to the channel. */
  readonly synced = computed(() => this.mfes().length > 0 && this.feed.connectedCount() >= this.mfes().length);

  constructor() {
    effect(() => {
      if (!this.scenario()) return;
      const record = this.record();
      if (!record) {
        void this.router.navigateByUrl('/');
        return;
      }
      untracked(() =>
        this.context.activate({
          contextType: record.contextType,
          contextId: record.id,
          routeId: `/${record.id}`,
          correlationId: crypto.randomUUID(),
        })
      );
    });
  }

  open(id: string): void {
    void this.router.navigate(['/', id]);
  }

  ngOnDestroy(): void {
    this.context.activate(null);
  }
}

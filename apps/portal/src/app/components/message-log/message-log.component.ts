import { DatePipe, JsonPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { FeedKind, MessageFeedService } from '../../core/messaging/message-feed.service';

type Filter = 'all' | 'events' | 'requests' | 'presence';

const FILTERS: { id: Filter; label: string; kinds: FeedKind[] }[] = [
  { id: 'all', label: 'All', kinds: ['event', 'request', 'reply', 'joined', 'left'] },
  { id: 'events', label: 'Events', kinds: ['event'] },
  { id: 'requests', label: 'Requests', kinds: ['request', 'reply'] },
  { id: 'presence', label: 'Presence', kinds: ['joined', 'left'] },
];

/** Full-height, terminal-style log of everything on the channel, newest at the bottom. */
@Component({
  selector: 'app-message-log',
  standalone: true,
  imports: [DatePipe, JsonPipe],
  templateUrl: './message-log.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './message-log.component.scss',
})
export class MessageLogComponent {
  readonly feed = inject(MessageFeedService);
  readonly closed = output<void>();
  readonly filters = FILTERS;
  readonly filter = signal<Filter>('all');
  readonly visible = computed(() => {
    const kinds = FILTERS.find((f) => f.id === this.filter())!.kinds;
    return this.feed.messages().filter((m) => kinds.includes(m.kind));
  });

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);
  /** Follow new entries unless the reader scrolled up to look at older ones. */
  private stickToBottom = true;

  constructor() {
    effect(() => {
      this.visible();
      if (!this.stickToBottom) return;
      afterNextRender(() => this.scrollToBottom(), { injector: this.injector });
    });
  }

  onScroll(): void {
    const el = this.list().nativeElement;
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  private scrollToBottom(): void {
    const el = this.list().nativeElement;
    el.scrollTop = el.scrollHeight;
  }
}

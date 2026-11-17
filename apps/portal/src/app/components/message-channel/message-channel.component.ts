import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MfeDefinition } from '../../core/manifest/manifest';
import {
  FeedMessage,
  MessageFeedService,
  isRecipient,
} from '../../core/messaging/message-feed.service';
import { PORTAL_ID, participantForMfe } from '../../core/participants/participants';

/**
 * The portal's message channel. The portal is drawn as the bus itself, the host every app
 * plugs into, and each message is animated as it travels.
 */
@Component({
  selector: 'app-message-channel',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './message-channel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './message-channel.component.scss',
})
export class MessageChannelComponent implements OnDestroy {
  private readonly feed = inject(MessageFeedService);

  readonly mfes = input<MfeDefinition[]>([]);
  readonly msg = this.feed.latest;
  readonly connectedIds = this.feed.connectedIds;
  readonly pings = this.feed.pings;
  readonly frameworks = this.feed.frameworks;
  readonly pinging = signal(false);
  /** Briefly true after a ping round, to show every app's answer at once. */
  readonly showPings = signal(false);
  private pingTimer?: ReturnType<typeof setTimeout>;
  /** The apps. The portal isn't a node: it is the bus they all plug into. */
  readonly nodes = computed(() => this.mfes().map(participantForMfe));
  readonly portalSending = computed(() => this.msg()?.sender.id === PORTAL_ID);
  readonly portalReceiving = computed(() => isRecipient(this.msg(), PORTAL_ID));

  /** Flips on every app message; the template swaps branches on it to replay the animations. */
  readonly replay = computed(() => this.feed.messageCount() % 2 === 1);

  /** Where an app sits on the bus, in %. The portal (not a node) is the middle of the bus. */
  private xOf(id: string | undefined): number {
    const nodes = this.nodes();
    const index = nodes.findIndex((n) => n.id === id);
    return index < 0 ? 50 : ((index + 0.5) / nodes.length) * 100;
  }

  readonly senderX = computed(() => this.xOf(this.msg()?.sender.id));

  /** How far the wave spreads: the whole bus for broadcasts, only sender → target for direct messages. */
  readonly waveSpan = computed(() => {
    const m = this.msg();
    if (!m?.target) return { from: 0, to: 100 };
    const [a, b] = [this.senderX(), this.xOf(m.target.id)].sort(
      (x, y) => x - y
    );
    return { from: a, to: b };
  });

  async ping(): Promise<void> {
    this.pinging.set(true);
    await this.feed.pingAll();
    this.pinging.set(false);
    this.showPings.set(true);
    clearTimeout(this.pingTimer);
    this.pingTimer = setTimeout(() => this.showPings.set(false), 3500);
  }

  ngOnDestroy(): void {
    clearTimeout(this.pingTimer);
  }

  /** Whether a node receives the latest message: its target if addressed, otherwise every connected app. */
  receives(
    m: FeedMessage | undefined,
    nodeId: string,
    online: boolean
  ): boolean {
    return online && isRecipient(m, nodeId);
  }

  senderLabel(m: FeedMessage): string {
    return m.kind === 'request'
      ? 'Asked'
      : m.kind === 'reply'
      ? 'Answered'
      : 'Sent';
  }

  verb(m: FeedMessage): string {
    return m.kind === 'request'
      ? 'asked'
      : m.kind === 'reply'
      ? 'answered'
      : 'sent';
  }
}

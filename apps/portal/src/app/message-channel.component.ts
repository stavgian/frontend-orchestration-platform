import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { MfeDefinition } from './manifest';
import { FeedMessage, MessageFeedService, isRecipient } from './message-feed.service';
import { PORTAL_ID, participantForMfe } from './participants';

const PORTAL_LINES = [
  'Hello from the portal 👋 — welcome, everyone!',
  'Portal here: all apps are loaded and listening.',
  'Quick check from the portal — can everyone hear me?',
];

/**
 * The portal's message channel. The portal is drawn as the bus itself, the host every app
 * plugs into, and each message is animated as it travels.
 */
@Component({
  selector: 'app-message-channel',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './message-channel.component.html',
  styleUrl: './message-channel.component.scss',
})
export class MessageChannelComponent implements OnDestroy {
  private readonly feed = inject(MessageFeedService);
  private sentCount = 0;

  readonly mfes = input<MfeDefinition[]>([]);
  readonly msg = this.feed.latest;
  readonly connectedIds = this.feed.connectedIds;
  readonly pings = this.feed.pings;
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

  readonly senderX = computed(() => {
    const nodes = this.nodes();
    const index = nodes.findIndex((n) => n.id === this.msg()?.sender.id);
    return index < 0 ? 50 : ((index + 0.5) / nodes.length) * 100; // the portal sends from the middle of the bus
  });

  announce(): void {
    this.feed.announce(PORTAL_LINES[this.sentCount++ % PORTAL_LINES.length]);
  }

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
  receives(m: FeedMessage | undefined, nodeId: string, online: boolean): boolean {
    return online && isRecipient(m, nodeId);
  }

  senderLabel(m: FeedMessage): string {
    return m.kind === 'request' ? 'Asked' : m.kind === 'reply' ? 'Answered' : 'Sent';
  }

  verb(m: FeedMessage): string {
    return m.kind === 'request' ? 'asked' : m.kind === 'reply' ? 'answered' : 'sent';
  }
}

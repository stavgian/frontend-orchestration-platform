import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MfeDefinition } from './manifest';
import { FeedMessage, MessageFeedService } from './message-feed.service';
import { PORTAL_ID, participantFor, participantForMfe } from './participants';

const PORTAL_LINES = [
  'Hello from the portal 👋 — welcome, everyone!',
  'Portal here: all apps are loaded and listening.',
  'Quick check from the portal — can everyone hear me?',
];

/** Visual "bus" showing who is on the channel and animating each message as it travels. */
@Component({
  selector: 'app-message-channel',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './message-channel.component.html',
  styleUrl: './message-channel.component.scss',
})
export class MessageChannelComponent {
  private readonly feed = inject(MessageFeedService);
  private sentCount = 0;

  readonly mfes = input<MfeDefinition[]>([]);
  readonly msg = this.feed.latest;
  readonly connectedIds = this.feed.connectedIds;
  readonly pings = this.feed.pings;
  readonly pinging = signal(false);
  readonly portalId = PORTAL_ID;
  readonly nodes = computed(() => [
    participantFor(PORTAL_ID),
    ...this.mfes().map(participantForMfe),
  ]);

  /** Flips on every app message; the template swaps branches on it to replay the animations. */
  readonly replay = computed(() => this.feed.messageCount() % 2 === 1);

  readonly senderX = computed(() => {
    const nodes = this.nodes();
    const index = nodes.findIndex((n) => n.id === this.msg()?.sender.id);
    return index < 0 ? 50 : ((index + 0.5) / nodes.length) * 100;
  });

  announce(): void {
    this.feed.announce(PORTAL_LINES[this.sentCount++ % PORTAL_LINES.length]);
  }

  async ping(): Promise<void> {
    this.pinging.set(true);
    await this.feed.pingAll();
    this.pinging.set(false);
  }

  /** Whether a node receives the latest message: its target if addressed, otherwise every connected app. */
  receives(m: FeedMessage | undefined, nodeId: string, online: boolean): boolean {
    if (!m || m.sender.id === nodeId || !online) return false;
    return m.target ? m.target.id === nodeId : true;
  }

  senderLabel(m: FeedMessage): string {
    return m.kind === 'request' ? 'Asked' : m.kind === 'reply' ? 'Answered' : 'Sent';
  }

  verb(m: FeedMessage): string {
    return m.kind === 'request' ? 'asked' : m.kind === 'reply' ? 'answered' : 'sent';
  }
}

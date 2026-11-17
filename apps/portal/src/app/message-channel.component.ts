import { Component, computed, inject, input } from '@angular/core';
import { MfeDefinition } from './manifest';
import { MessageFeedService } from './message-feed.service';
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
  templateUrl: './message-channel.component.html',
  styleUrl: './message-channel.component.scss',
})
export class MessageChannelComponent {
  private readonly feed = inject(MessageFeedService);
  private sentCount = 0;

  readonly mfes = input<MfeDefinition[]>([]);
  readonly msg = this.feed.latest;
  readonly nodes = computed(() => [
    participantFor(PORTAL_ID),
    ...this.mfes().map(participantForMfe),
  ]);

  /** Re-keys the diagram on every message so its CSS animations replay. */
  readonly renderKey = computed(() => [this.msg()?.id ?? 0]);

  readonly senderX = computed(() => {
    const nodes = this.nodes();
    const index = nodes.findIndex((n) => n.id === this.msg()?.sender.id);
    return index < 0 ? 50 : ((index + 0.5) / nodes.length) * 100;
  });

  send(): void {
    this.feed.sendFromPortal(PORTAL_LINES[this.sentCount++ % PORTAL_LINES.length]);
  }
}

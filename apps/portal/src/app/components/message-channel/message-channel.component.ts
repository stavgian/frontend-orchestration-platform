import { Component, OnDestroy, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { LogPanelService } from '../../core/messaging/log-panel.service';
import { MfeDefinition } from '../../core/manifest/manifest';
import { FeedMessage, MessageFeedService, isRecipient } from '../../core/messaging/message-feed.service';
import { participantForMfe } from '../../core/participants/participants';
import { IconComponent } from '../icon/icon.component';

/**
 * The shell's view of the message channel: which apps are connected and who just sent or received a message.
 * The full traffic, with payloads, is in the message log. The shell only observes; it never sends.
 */
@Component({
  selector: 'app-message-channel',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './message-channel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './message-channel.component.scss',
})
export class MessageChannelComponent implements OnDestroy {
  private readonly feed = inject(MessageFeedService);
  readonly log = inject(LogPanelService);
  readonly connectedCount = this.feed.connectedCount;

  readonly mfes = input<MfeDefinition[]>([]);
  readonly msg = this.feed.latest;
  readonly connectedIds = this.feed.connectedIds;
  readonly pings = this.feed.pings;
  readonly pinging = signal(false);
  /** Briefly true after a ping round, to show every app's answer at once. */
  readonly showPings = signal(false);
  private pingTimer?: ReturnType<typeof setTimeout>;

  readonly nodes = computed(() => this.mfes().map(participantForMfe));
  /** Changes with every message; the node row is rebuilt on it so the highlight animation replays. */
  readonly tick = computed(() => [this.feed.messageCount()]);

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

  /** Whether a connected app receives the latest message: its target if addressed, otherwise everyone else. */
  receives(m: FeedMessage | undefined, nodeId: string): boolean {
    return this.connectedIds().has(nodeId) && isRecipient(m, nodeId);
  }
}

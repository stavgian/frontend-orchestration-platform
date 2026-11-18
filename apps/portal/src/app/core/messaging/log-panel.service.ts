import { Injectable, computed, inject, signal } from '@angular/core';
import { MessageFeedService } from './message-feed.service';

const PREF_KEY = 'portal.message-log';

/** Open/closed state of the message log sidebar, shared by the shell and the channel's button. */
@Injectable({ providedIn: 'root' })
export class LogPanelService {
  private readonly feed = inject(MessageFeedService);
  readonly open = signal(remembered());
  /** Messages that arrived while the log was closed. */
  private readonly seen = signal(0);
  readonly unread = computed(() => (this.open() ? 0 : this.feed.messageCount() - this.seen()));

  toggle(open = !this.open()): void {
    if (!open) this.seen.set(this.feed.messageCount());
    this.open.set(open);
    try {
      localStorage.setItem(PREF_KEY, open ? 'open' : 'closed');
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }
}

/** The remembered choice; closed by default. */
function remembered(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'open';
  } catch {
    return false;
  }
}

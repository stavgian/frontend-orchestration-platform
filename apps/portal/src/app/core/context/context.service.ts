import { Injectable, inject, signal } from '@angular/core';
import { MessageFeedService } from '../messaging/message-feed.service';
import { PortalContext } from './portal-context';

/** Owns the active context. Navigation sets it; apps follow it through the channel and never change it. */
@Injectable({ providedIn: 'root' })
export class ContextService {
  private readonly feed = inject(MessageFeedService);
  readonly active = signal<PortalContext | null>(null);

  constructor() {
    // Apps that mount after a change (or while the page is still loading them) pull the current context.
    this.feed.connection.respond('context:get', () => this.active());
  }

  activate(context: PortalContext | null): void {
    const current = this.active();
    if (current?.contextType === context?.contextType && current?.contextId === context?.contextId) return;
    this.active.set(context);
    if (context) this.feed.connection.publish('context:changed', context);
  }
}

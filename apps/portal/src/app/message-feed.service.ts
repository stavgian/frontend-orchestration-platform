import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { EVENT_NAMES, StatusMessagePayload, publish, subscribe } from '@stavgian/mfe-communication';
import { PORTAL_ID, Participant, participantFor } from './participants';

export interface FeedMessage {
  id: number;
  text: string;
  sender: Participant;
  receivedAt: Date;
  payload: StatusMessagePayload;
}

const MAX_MESSAGES = 50;
const MAX_TOASTS = 3;
const TOAST_MS = 4500;

/** Single portal-side listener for the shared message channel. */
@Injectable({ providedIn: 'root' })
export class MessageFeedService implements OnDestroy {
  private nextId = 1;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  readonly messages = signal<FeedMessage[]>([]);
  readonly toasts = signal<FeedMessage[]>([]);
  readonly latest = computed<FeedMessage | undefined>(() => this.messages()[0]);

  private readonly unsubscribe = subscribe(EVENT_NAMES.statusMessage, (payload) =>
    this.add(payload)
  );

  sendFromPortal(text: string): void {
    publish(EVENT_NAMES.statusMessage, {
      text,
      source: PORTAL_ID,
      emittedAt: new Date().toISOString(),
    });
  }

  clear(): void {
    this.messages.set([]);
  }

  dismissToast(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  ngOnDestroy(): void {
    this.unsubscribe();
    this.timers.forEach(clearTimeout);
  }

  private add(payload: StatusMessagePayload): void {
    const message: FeedMessage = {
      id: this.nextId++,
      text: payload.text,
      sender: participantFor(payload.source),
      receivedAt: new Date(),
      payload,
    };

    this.messages.update((list) => [message, ...list].slice(0, MAX_MESSAGES));
    this.toasts.update((list) => [message, ...list].slice(0, MAX_TOASTS));

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.dismissToast(message.id);
    }, TOAST_MS);
    this.timers.add(timer);
  }
}

import { Component, inject } from '@angular/core';
import { MessageFeedService } from './message-feed.service';

/** Short-lived pop-ups for each new message on the channel. */
@Component({
  selector: 'app-toast-stack',
  standalone: true,
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (t of feed.toasts(); track t.id) {
        <div class="toast" [style.--c]="t.sender.color">
          <div class="avatar" aria-hidden="true">{{ t.sender.initials }}</div>
          <div class="body">
            <div class="who">{{ t.sender.name }} says</div>
            <div class="text">{{ t.text ?? 'Sent a ' + t.type + ' message' }}</div>
          </div>
          <button type="button" class="close" (click)="feed.dismissToast(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed; right: 20px; bottom: 20px; z-index: 50;
      display: flex; flex-direction: column-reverse; gap: 10px;
      width: min(360px, calc(100vw - 32px)); pointer-events: none;
    }
    .toast {
      pointer-events: auto; display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 12px 12px 14px; border-radius: 14px;
      background: var(--panel-raised); border: 1px solid var(--border-strong);
      border-left: 3px solid var(--c); box-shadow: var(--shadow);
      animation: slide 260ms ease-out;
    }
    .avatar {
      flex: none; width: 28px; height: 28px; border-radius: 50%;
      display: grid; place-items: center; background: var(--c);
      font: 700 10px var(--font-display); color: #0a0f16;
    }
    .body { flex: 1; min-width: 0; }
    .who { font-size: 12px; color: var(--subtle); }
    .text { font-size: 14px; margin-top: 2px; overflow-wrap: anywhere; }
    .close {
      flex: none; border: 0; background: none; color: var(--subtle);
      font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 6px;
    }
    .close:hover { color: var(--text); }
    @keyframes slide { from { opacity: 0; transform: translateY(10px); } }
    /* On wide screens the Conversation panel is always in view, so toasts would only duplicate it. */
    @media (min-width: 1101px) { .stack { display: none; } }
    @media (max-width: 600px) {
      .stack { right: 16px; bottom: 16px; }
      .toast:nth-child(n + 2) { display: none; }
    }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class ToastStackComponent {
  readonly feed = inject(MessageFeedService);
}

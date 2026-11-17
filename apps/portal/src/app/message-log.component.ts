import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MessageFeedService } from './message-feed.service';

/** Scrollable, chat-style history of everything said on the channel. */
@Component({
  selector: 'app-message-log',
  standalone: true,
  imports: [DatePipe, JsonPipe],
  templateUrl: './message-log.component.html',
  styleUrl: './message-log.component.scss',
})
export class MessageLogComponent {
  readonly feed = inject(MessageFeedService);
}

import { Observable, Subject, filter } from 'rxjs';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { TxServiceEvent } from './event.dto';
import {
  WebhookDispatcherService,
  WebhookResponse,
} from '../webhook/webhookDispatcher.service';

@Injectable()
export class EventsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventsService.name);
  private eventsSubject = new Subject<MessageEvent<TxServiceEvent>>();
  private readonly eventsLogEnabled: boolean;

  constructor(
    private readonly queueProvider: QueueProvider,
    private readonly webhookDispatcherService: WebhookDispatcherService,
    private readonly configService: ConfigService,
  ) {
    // Only an explicit `true` enables it; normalize so 'True'/'TRUE' count.
    this.eventsLogEnabled =
      this.configService
        .get<string>('EVENTS_LOG_ENABLED', 'true')
        .trim()
        .toLowerCase() === 'true';
  }

  onApplicationBootstrap() {
    return this.listenToEvents();
  }

  listenToEvents(): Promise<string> {
    return this.queueProvider.subscribeToEvents((msg: string) =>
      this.processEvent(msg),
    );
  }

  /**
   *
   * @param safe
   * @returns Events rx.js observable used by the Server Side Events endpoint
   */
  getEventsObservableForSafe(
    safe: string,
  ): Observable<MessageEvent<TxServiceEvent>> {
    return this.eventsSubject.pipe(filter((ev) => ev.data.address === safe));
  }

  /**
   * Push txServiceEvent to the events observable (used by the Server Side Events endpoint)
   * @param txServiceEvent
   * @returns Crafted MessageEvent from txServiceEvent
   */
  pushEventToEventsObservable(
    txServiceEvent: TxServiceEvent,
  ): MessageEvent<TxServiceEvent> {
    const messageEvent: MessageEvent<TxServiceEvent> = new MessageEvent(
      'message',
      {
        data: txServiceEvent,
      },
    );
    this.eventsSubject.next(messageEvent);
    return messageEvent;
  }

  /**
   *
   * Event must have at least a `chainId` and `type`
   * @param txServiceEvent
   * @returns
   */
  isEventValid(txServiceEvent: TxServiceEvent): boolean {
    return (
      typeof txServiceEvent.chainId === 'string' &&
      typeof txServiceEvent.type === 'string'
    );
  }

  processEvent(message: string): Promise<(WebhookResponse | undefined)[]> {
    let txServiceEvent: TxServiceEvent;
    try {
      txServiceEvent = JSON.parse(message);
      if (this.eventsLogEnabled) {
        this.logger.log({
          message: 'Processing event',
          messageContext: {
            event: txServiceEvent,
          },
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Cannot parse message as JSON',
        messageContext: {
          event: message,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return Promise.resolve([undefined]);
    }

    // Check message is valid
    if (!this.isEventValid(txServiceEvent)) {
      this.logger.error({
        message:
          "Unsupported message. A valid message should have at least 'chainId' and 'type'",
        messageContext: { event: message },
      });
      return Promise.resolve([undefined]);
    }

    this.pushEventToEventsObservable(txServiceEvent);
    return this.webhookDispatcherService.postEveryWebhook(txServiceEvent);
  }
}

import { Observable, Subject, filter } from 'rxjs';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { EnvironmentVariables } from '../../config/environment';
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
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.eventsLogEnabled = this.configService.get('EVENTS_LOG_ENABLED', {
      infer: true,
    });
  }

  onApplicationBootstrap() {
    return this.listenToEvents();
  }

  listenToEvents(): Promise<string> {
    return this.queueProvider.subscribeToEvents(
      (messageContent, publishedAtSeconds) =>
        this.processEvent(messageContent, publishedAtSeconds),
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

  private getMsSinceUnixSeconds(unixSeconds: unknown): number | undefined {
    if (typeof unixSeconds !== 'number') {
      return undefined;
    }
    return Date.now() - unixSeconds * 1000;
  }

  processEvent(
    message: string,
    publishedAtSeconds?: number,
  ): Promise<(WebhookResponse | undefined)[]> {
    let txServiceEvent: TxServiceEvent;
    try {
      txServiceEvent = JSON.parse(message);
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

    // The Datadog delivery lag SLO reads `deliveryLagMs` from this log line
    if (this.eventsLogEnabled) {
      this.logger.log({
        message: 'Processing event',
        messageContext: {
          event: txServiceEvent,
          deliveryLagMs: this.getMsSinceUnixSeconds(publishedAtSeconds),
          eventLagMs: this.getMsSinceUnixSeconds(txServiceEvent.timestamp),
        },
      });
    }

    this.pushEventToEventsObservable(txServiceEvent);
    return this.webhookDispatcherService.postEveryWebhook(txServiceEvent);
  }
}

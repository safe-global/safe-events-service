import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { WebhookService } from '../webhook/webhook.service';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { AxiosResponse } from 'axios';
import { TxServiceEvent } from './event.dto';

@Injectable()
export class EventsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly queueProvider: QueueProvider,

    private readonly webhookService: WebhookService,
  ) {}

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

  processEvent(message: string): Promise<(AxiosResponse | undefined)[]> {
    const txServiceEvent: TxServiceEvent = JSON.parse(message);

    // Check message is valid
    if (this.isEventValid(txServiceEvent)) {
      return this.webhookService.postEveryWebhook(txServiceEvent);
    }
    this.logger.error(
      'Unsupported message. A valid message should have at least `chainId` and `type`',
      message,
    );
    return Promise.resolve([undefined]);
  }
}

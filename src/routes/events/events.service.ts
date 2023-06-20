import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { WebhookService } from '../webhook/webhook.service';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { AxiosResponse } from 'axios';

@Injectable()
export class EventsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('EventsService');

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

  processEvent(message: string): Promise<(AxiosResponse | undefined)[]> {
    const parsedMessage: object = JSON.parse(message);
    return this.webhookService.postEveryWebhook(parsedMessage);
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger('WebhookService');
  private webhooksCache = 300_000; // 5 minutes

  constructor(
    @InjectRepository(Webhook)
    private WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  findAllActive(): Promise<Webhook[]> {
    return this.WebHooksRepository.findBy({ isActive: true });
  }

  async getCachedActiveWebhooks(): Promise<Webhook[]> {
    const key = 'webhooks';
    const value = await this.cacheManager.get<Webhook[] | null>('webhooks');
    if (value != null) {
      this.logger.debug('Webhooks cached');
      return value;
    } else {
      this.logger.debug('Webhooks not cached, fetching them');
      const webhooks = await this.findAllActive();
      this.cacheManager.set(key, webhooks, this.webhooksCache);
      return webhooks;
    }
  }

  async postEveryWebhook(parsedMessage: object): Promise<Response[]> {
    const webhooks: Webhook[] = await this.getCachedActiveWebhooks();
    const responses: Promise<Response>[] = webhooks.map((webhook: Webhook) => {
      this.logger.debug(
        `Sending ${JSON.stringify(parsedMessage)} to ${webhook.url}`,
      );
      return this.postWebhook(parsedMessage, webhook.url);
    });
    return Promise.all(responses);
  }

  postWebhook(parsedMessage: object, url: string): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      body: JSON.stringify(parsedMessage),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger('WebhookService');

  constructor(
    @InjectRepository(Webhook)
    private WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   *
   * @returns webhooks cache ttl from `WEBHOOKS_CACHE_TTL`, if not defined 300_000 ms (5 seconds)
   */
  getWebhooksCacheTTL(): number {
    return this.configService.get('WEBHOOKS_CACHE_TTL') ?? 300_000;
  }

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
      this.cacheManager.set(key, webhooks, this.getWebhooksCacheTTL());
      return webhooks;
    }
  }

  async postEveryWebhook(
    parsedMessage: object,
  ): Promise<(Response | undefined)[]> {
    const webhooks: Webhook[] = await this.getCachedActiveWebhooks();
    const responses: Promise<Response | undefined>[] = webhooks.map(
      (webhook: Webhook) => {
        this.logger.debug(
          `Sending ${JSON.stringify(parsedMessage)} to ${webhook.url}`,
        );
        return this.postWebhook(parsedMessage, webhook.url);
      },
    );
    return Promise.all(responses);
  }

  postWebhook(
    parsedMessage: object,
    url: string,
  ): Promise<Response | undefined> {
    try {
      return fetch(url, {
        method: 'POST',
        body: JSON.stringify(parsedMessage),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.warn(`Error POSTing evet to ${url}`, error);
      return Promise.resolve(undefined);
    }
  }
}

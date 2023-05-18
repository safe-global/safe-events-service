import { Inject, Injectable, Logger } from '@nestjs/common';
import {Cache} from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger('WebhookService');
  private webhooksCache = 300_000 // 5 minutes

  constructor(
    @InjectRepository(Webhook)
    private WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  findAll(): Promise<Webhook[]> {
    return this.WebHooksRepository.find();
  }

  findOne(id: number): Promise<Webhook | null> {
    return this.WebHooksRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.WebHooksRepository.delete(id);
  }

  async getCachedWebhooks(): Promise<Webhook[]> {
    const key = 'webhooks';
    const value = await this.cacheManager.get<Webhook [] | null>('webhooks');
    if (value != null) {
      this.logger.debug('Webhooks cached')
      return value;
    } else {
      this.logger.debug('Webhooks not cached, fetching them')
      let webhooks = await this.findAll();
      this.cacheManager.set(key, webhooks, this.webhooksCache);
      return webhooks;
    }
  }

  async postEveryWebhook(parsedMessage: object): Promise<Response[]> {
      // TODO Cache findAll
      const webhooks: Webhook[] = await this.getCachedWebhooks();
      const responses: Promise<Response>[] = webhooks.map((webhook: Webhook) => {
          this.logger.debug(`Sending ${JSON.stringify(parsedMessage)} to ${webhook.url}`);
          return this.postWebhook(parsedMessage, webhook.url);
      })
      return Promise.all(responses)
  }

  postWebhook(parsedMessage: object, url: string): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      body: JSON.stringify(parsedMessage),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
  }

}

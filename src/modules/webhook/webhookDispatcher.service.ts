import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook, WebhookWithStats } from './repositories/webhook.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, catchError, firstValueFrom } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { TxServiceEvent } from '../events/event.dto';
import { WebhookService } from './webhook.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private webhookMap: Map<string, WebhookWithStats> = new Map();
  private webhookFailureThreeshold: number;
  private checkWebhookHealthWindowTime: number;

  constructor(
    @InjectRepository(Webhook)
    private readonly WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly webhookService: WebhookService,
  ) {
    this.webhookFailureThreeshold = Number(
      this.configService.get('WEBHOOK_FAILURE_THREESHOLD', 100),
    );
    this.checkWebhookHealthWindowTime = Number(
      this.configService.get('WEBHOOK_HEALTH_MINUTES_WINDOW', 1),
    );
  }

  async onModuleInit() {
    this.logger.log({
      message: 'Loading webhooks list at startup',
    });
    await this.refreshWebhookMap();
  }

  /**
   *
   * @returns Database configuration cache, if not defined 300_000 ms (5 minutes)
   */
  getWebhooksCacheTTL(): number {
    return Number(this.configService.get('WEBHOOKS_CACHE_TTL', 300_000));
  }

  getAllActive(): Promise<Webhook[]> {
    return this.WebHooksRepository.findBy({ isActive: true });
  }

  async disableWebhook(id: string): Promise<void> {
    try {
      const result = await this.WebHooksRepository.update(
        { id },
        { isActive: false },
      );

      if (result.affected === 0) {
        this.logger.error(
          `Webhook with ID ${id} not found or already inactive.`,
        );
        return;
      }

      this.logger.log(`Webhook with ID ${id} has been disabled.`);
    } catch (error) {
      this.logger.error(
        `Failed to disable webhook with ID ${id}: ${error.message}`,
      );
      throw error; // Propagate the error
    }
  }

  getCachedActiveWebhooks(): WebhookWithStats[] {
    return Array.from(this.webhookMap.values());
  }

  async postEveryWebhook(
    parsedMessage: TxServiceEvent,
  ): Promise<(AxiosResponse | undefined)[]> {
    const webhooks: WebhookWithStats[] = this.getCachedActiveWebhooks();
    const responses: Promise<AxiosResponse | undefined>[] = webhooks
      .filter((webhook: WebhookWithStats) => {
        return webhook.isEventRelevant(parsedMessage);
      })
      .map((webhook: WebhookWithStats) => {
        this.logger.debug(
          `Sending ${JSON.stringify(parsedMessage)} to ${webhook.url}`,
        );
        return this.postWebhook(parsedMessage, webhook);
      });
    return Promise.all(responses);
  }

  parseResponseData(responseData: any): string {
    if (typeof responseData === 'string') {
      return responseData;
    }
    let dataStr: string;
    try {
      dataStr = JSON.stringify(responseData);
    } catch {
      dataStr = 'Cannot parse response data';
    }
    return dataStr;
  }

  postWebhook(
    parsedMessage: TxServiceEvent,
    webhook: WebhookWithStats,
  ): Promise<AxiosResponse | undefined> {
    const headers = webhook.authorization
      ? { Authorization: webhook.authorization }
      : {};
    const startTime = Date.now();
    return firstValueFrom(
      this.httpService.post(webhook.url, parsedMessage, { headers }).pipe(
        catchError((error: AxiosError) => {
          webhook.recordFailure();
          if (error.response !== undefined) {
            // Response received status code but status code not 2xx
            const responseData = this.parseResponseData(error.response.data);
            this.logger.error({
              message: 'Error sending event',
              messageContext: {
                event: parsedMessage,
                httpRequest: {
                  url: webhook.url,
                  startTime: startTime,
                },
                httpResponse: {
                  data: responseData,
                  statusCode: error.response.status,
                },
              },
            });
          } else if (error.request !== undefined) {
            // Request was made but response was not received
            this.logger.error({
              message: 'Error sending event',
              messageContext: {
                event: parsedMessage,
                httpRequest: {
                  url: webhook.url,
                  startTime: startTime,
                },
                httpResponse: null,
                httpRequestError: {
                  message: `Response not received. Error: ${error.message}`,
                },
              },
            });
          } else {
            // Cannot make request
            this.logger.error({
              message: 'Error sending event',
              messageContext: {
                event: parsedMessage,
                httpRequest: {
                  url: webhook.url,
                  startTime: startTime,
                },
                httpResponse: null,
                httpRequestError: {
                  message: error.message,
                },
              },
            });
          }
          return of(undefined);
        }),
      ),
    ).then((response: AxiosResponse | undefined) => {
      if (response) {
        webhook.recordSuccess();
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        const responseData = this.parseResponseData(response.data);
        this.logger.debug({
          message: 'Success sending event',
          messageContext: {
            event: parsedMessage,
            httpRequest: {
              url: webhook.url,
              startTime: startTime,
              endTime: endTime,
            },
            httpResponse: {
              data: responseData,
              statusCode: response.status,
              elapsedTimeMs: elapsedTime,
            },
          },
        });
      }
      return response;
    });
  }

  async checkWebhooksHealth() {
    this.logger.log('Starting check webhooks health');
    for (const [, webhook] of this.webhookMap) {
      this.logger.log('Checking webhooks');
      this.logger.log(webhook.getTimeFromLastCheck());
      if (webhook.getTimeFromLastCheck() >= this.checkWebhookHealthWindowTime) {
        this.logger.log(webhook.getTimeFromLastCheck());
        const failureRate = webhook.getFailureRate();
        this.logger.log('failureRate for ${webhook.id} ${failureRate}');
        if (failureRate > this.webhookFailureThreeshold) {
          await this.disableWebhook(webhook.id);
        }
        webhook.resetStats();
      }
    }
  }

  @Cron('* * * * *')
  async refreshWebhookMap() {
    try {
      // First check webhooks health
      await this.checkWebhooksHealth();
      const webhooksFromDb = await this.getAllActive();

      const newWebhookMap = new Map<string, WebhookWithStats>();
      this.logger.log({
        message: 'Loading webhooks list',
      });
      for (const dbWebhook of webhooksFromDb) {
        const id = dbWebhook.id.toString();
        if (this.webhookMap.has(id)) {
          const existingWebhook = this.webhookMap.get(id)!;
          Object.assign(existingWebhook, dbWebhook);
          newWebhookMap.set(id, existingWebhook);
        } else {
          const webhookWithStats = Object.assign(
            new WebhookWithStats(),
            dbWebhook,
          );
          newWebhookMap.set(id, webhookWithStats);
        }
      }
      this.webhookMap = newWebhookMap;
    } catch (error) {
      this.logger.error({
        message: 'Error updating the webhooks list',
        messageContext: {
          error: error,
        },
      });
    }
  }
}

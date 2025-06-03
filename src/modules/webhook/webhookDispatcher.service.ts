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
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private webhookMap: Map<string, WebhookWithStats> = new Map();

  constructor(
    @InjectRepository(Webhook)
    private readonly WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly webhookService: WebhookService,
  ) {}

  async onModuleInit() {
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

  getCachedActiveWebhooks(): WebhookWithStats[] {
    return Array.from(this.webhookMap.values());
  }

  async postEveryWebhook(
    parsedMessage: TxServiceEvent,
  ): Promise<(AxiosResponse | undefined)[]> {
    const webhooks: Webhook[] = this.getCachedActiveWebhooks();
    const responses: Promise<AxiosResponse | undefined>[] = webhooks
      .filter((webhook: Webhook) => {
        return webhook.isEventRelevant(parsedMessage);
      })
      .map((webhook: Webhook) => {
        this.logger.debug(
          `Sending ${JSON.stringify(parsedMessage)} to ${webhook.url}`,
        );
        return this.postWebhook(
          parsedMessage,
          webhook.url,
          webhook.authorization,
        );
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
    url: string,
    authorization: string,
  ): Promise<AxiosResponse | undefined> {
    const headers = authorization ? { Authorization: authorization } : {};
    const startTime = Date.now();
    return firstValueFrom(
      this.httpService.post(url, parsedMessage, { headers }).pipe(
        catchError((error: AxiosError) => {
          if (error.response !== undefined) {
            // Response received status code but status code not 2xx
            const responseData = this.parseResponseData(error.response.data);
            this.logger.error({
              message: 'Error sending event',
              messageContext: {
                event: parsedMessage,
                httpRequest: {
                  url: url,
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
                  url: url,
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
                  url: url,
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
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        const responseData = this.parseResponseData(response.data);
        this.logger.debug({
          message: 'Success sending event',
          messageContext: {
            event: parsedMessage,
            httpRequest: {
              url: url,
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

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshWebhookMap() {
    try {
      const webhooksFromDb = await this.getAllActive();

      const newWebhookMap = new Map<string, WebhookWithStats>();

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

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, catchError, firstValueFrom } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { TxServiceEvent } from '../events/event.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   *
   * @returns Database configuration cache, if not defined 300_000 ms (5 minutes)
   */
  getWebhooksCacheTTL(): number {
    return Number(this.configService.get('WEBHOOKS_CACHE_TTL', 300_000));
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
    parsedMessage: TxServiceEvent,
  ): Promise<(AxiosResponse | undefined)[]> {
    const webhooks: Webhook[] = await this.getCachedActiveWebhooks();
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
    } catch (_) {
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
}

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
  private webhookFailureThreshold: number;
  private checkWebhookHealthWindowTime: number;
  private autoDisableWebhook: boolean;

  constructor(
    @InjectRepository(Webhook)
    private readonly WebHooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly webhookService: WebhookService,
  ) {
    this.webhookFailureThreshold = Number(
      this.configService.get('WEBHOOK_FAILURE_THRESHOLD', 100),
    );
    this.checkWebhookHealthWindowTime = Number(
      this.configService.get('WEBHOOK_HEALTH_MINUTES_WINDOW', 1),
    );
    this.autoDisableWebhook =
      this.configService.get('WEBHOOK_AUTO_DISABLE') === 'true';
  }

  /**
   * Load at startup nestjs app
   */
  async onModuleInit() {
    this.logger.log({
      message: 'Loading webhooks list at startup',
    });
    await this.refreshWebhookMap();
  }

  /**
   * @returns Return active webhooks from database
   */
  getAllActive(): Promise<Webhook[]> {
    return this.WebHooksRepository.findBy({ isActive: true });
  }

  /**
   * Disable the webhook in database by the provided id
   * @param id webhook unique identifier
   * @returns true if was correctly disabled, false otherwise.
   */
  async disableWebhook(id: string): Promise<boolean> {
    try {
      const result = await this.WebHooksRepository.update(
        { id },
        { isActive: false },
      );

      if (result.affected === 0) {
        this.logger.error({
          message: `Webhook with ID ${id} not found or already inactive.`,
        });
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error({
        message: `Failed to disable webhook with ID ${id}: ${error.message}`,
      });
      return false;
    }
  }

  /**
   *
   * @returns a list of in memory stored webhooks
   */
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
          webhook.incrementFailure();
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
        webhook.incrementSuccess();
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

  /**
   * Evaluates the health of all webhooks by checking if any webhook has a consistently high failure rate.
   * If a webhook exceeds the defined failure threshold within the allowed time window,
   * it will be marked as disabled to prevent further issues.
   */
  async checkWebhooksHealth() {
    this.logger.debug('Starting check webhooks health');
    const activeWebhooks = this.getCachedActiveWebhooks();
    const healthChecks = activeWebhooks.map(async (webhook) => {
      if (
        webhook.getTimeDelayedFromStartTime() >=
        this.checkWebhookHealthWindowTime
      ) {
        const failureRate = webhook.getFailureRate();
        if (failureRate > this.webhookFailureThreshold) {
          if (this.autoDisableWebhook) {
            const wasDisabled = await this.disableWebhook(webhook.id);
            if (wasDisabled) {
              this.logger.warn({
                message: `Webhook disabled — ID: ${webhook.id}, URL: ${webhook.url}, failure rate exceeded threshold.`,
              });
            } else {
              this.logger.error({
                message: `Failed to disable webhook — ID: ${webhook.id}, URL: ${webhook.url}.`,
              });
            }
          } else {
            this.logger.warn({
              message: `Webhook exceeded failure threshold but was not disabled (autoDisableWebhook is OFF) — ID: ${webhook.id}, URL: ${webhook.url}.`,
            });
          }
        }
        webhook.resetStats();
      }
    });
    await Promise.all(healthChecks);
    this.logger.debug('Ending check webhooks health');
  }

  /**
   * Refreshes the internal map of active webhooks.
   * This method is crucial for ensuring that the webhook map is always in sync with the current state of the active webhooks
   * in the database, while maintaining webhook health stats and status.
   * @throws {Error} - Throws an error if there's an issue retrieving or processing the webhooks from the database.
   */
  @Cron('* * * * *') // Run every minute
  async refreshWebhookMap() {
    try {
      // First check webhooks health
      await this.checkWebhooksHealth();
      const webhooksFromDb = await this.getAllActive();

      const newWebhookMap = new Map<string, WebhookWithStats>();
      this.logger.debug({
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
    this.logger.debug({
      message: 'Ending loading webhooks list',
    });
  }
}

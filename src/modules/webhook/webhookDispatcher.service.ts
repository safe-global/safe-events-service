import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook, WebhookWithStats } from './repositories/webhook.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Dispatcher } from 'undici';
import { TxServiceEvent } from '../events/event.dto';
import { WebhookService } from './webhook.service';
import { Cron } from '@nestjs/schedule';

export const UNDICI_AGENT = Symbol('UNDICI_AGENT');

const JSON_CONTENT_TYPE = 'application/json';

const NO_RESPONSE_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'ECONNRESET',
  'ETIMEDOUT',
]);

export interface WebhookResponse {
  statusCode: number;
  data: string;
}

@Injectable()
export class WebhookDispatcherService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private webhookMap: Map<string, WebhookWithStats> = new Map();
  private webhookFailureThreshold: number;
  private webhookHealthMinutesWindow: number;
  private autoDisableWebhook: boolean;

  constructor(
    @InjectRepository(Webhook)
    private readonly webhooksRepository: Repository<Webhook>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    @Inject(UNDICI_AGENT) private readonly agent: Dispatcher,
    private readonly webhookService: WebhookService,
  ) {
    this.webhookFailureThreshold = this.configService.get<number>(
      'WEBHOOK_FAILURE_THRESHOLD',
      90,
    );
    this.webhookHealthMinutesWindow = this.configService.get<number>(
      'WEBHOOK_HEALTH_MINUTES_WINDOW',
      60,
    );
    // Disabled by default
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

  async onModuleDestroy() {
    await this.agent.close();
  }

  /**
   * @returns Return active webhooks from database
   */
  getAllActive(): Promise<Webhook[]> {
    return this.webhooksRepository.findBy({ isActive: true });
  }

  /**
   * Disable the webhook in database by the provided id
   * @param id webhook unique identifier
   * @returns true if was correctly disabled, false otherwise.
   */
  async disableWebhook(id: string): Promise<boolean> {
    try {
      const result = await this.webhooksRepository.update(
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
  ): Promise<(WebhookResponse | undefined)[]> {
    const responses = this.getCachedActiveWebhooks()
      .filter((webhook) => webhook.isEventRelevant(parsedMessage))
      .map((webhook) => {
        this.logger.debug(
          `Sending ${JSON.stringify(parsedMessage)} to ${webhook.url}`,
        );
        return this.postWebhook(parsedMessage, webhook);
      });
    return Promise.all(responses);
  }

  private logSendError(
    parsedMessage: TxServiceEvent,
    webhook: WebhookWithStats,
    startTime: number,
    httpResponse: { data: string; statusCode: number } | null,
    error?: Error & { code?: string },
  ): void {
    const httpRequestError = error
      ? {
          message:
            error.code != null && NO_RESPONSE_CODES.has(error.code)
              ? `Response not received. Error: ${error.message}`
              : error.message,
        }
      : undefined;

    this.logger.error({
      message: 'Error sending event',
      messageContext: {
        event: parsedMessage,
        httpRequest: { url: webhook.url, startTime },
        httpResponse,
        ...(httpRequestError ? { httpRequestError } : {}),
      },
    });
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

  private buildRequestHeaders(
    webhook: WebhookWithStats,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': JSON_CONTENT_TYPE,
      'x-delivery-id': crypto.randomUUID(),
    };

    if (webhook.authorization) {
      headers.authorization = webhook.authorization;
    }

    return headers;
  }

  private buildRequestOptions(
    parsedMessage: TxServiceEvent,
    webhook: WebhookWithStats,
  ) {
    const url = new URL(webhook.url);

    return {
      origin: url.origin,
      path: url.pathname + url.search,
      method: 'POST' as const,
      headers: this.buildRequestHeaders(webhook),
      body: JSON.stringify(parsedMessage),
    };
  }

  private logSendSuccess(
    parsedMessage: TxServiceEvent,
    webhook: WebhookWithStats,
    startTime: number,
    response: WebhookResponse,
  ): void {
    const endTime = Date.now();

    this.logger.debug({
      message: 'Success sending event',
      messageContext: {
        event: parsedMessage,
        httpRequest: {
          url: webhook.url,
          startTime,
          endTime,
        },
        httpResponse: {
          data: response.data,
          statusCode: response.statusCode,
          elapsedTimeMs: endTime - startTime,
        },
      },
    });
  }

  async postWebhook(
    parsedMessage: TxServiceEvent,
    webhook: WebhookWithStats,
  ): Promise<WebhookResponse | undefined> {
    const startTime = Date.now();

    try {
      const response = await this.agent.request(
        this.buildRequestOptions(parsedMessage, webhook),
      );
      const webhookResponse = {
        statusCode: response.statusCode,
        data: this.parseResponseData(await response.body.text()),
      };

      if (webhookResponse.statusCode >= 400) {
        webhook.incrementFailure();
        this.logSendError(parsedMessage, webhook, startTime, {
          data: webhookResponse.data,
          statusCode: webhookResponse.statusCode,
        });
        return undefined;
      }

      webhook.incrementSuccess();
      this.logSendSuccess(parsedMessage, webhook, startTime, webhookResponse);
      return webhookResponse;
    } catch (error: any) {
      webhook.incrementFailure();
      this.logSendError(parsedMessage, webhook, startTime, null, error);
      return undefined;
    }
  }

  /**
   * Evaluates the health of all webhooks by checking if any webhook has a consistently high failure rate.
   * If a webhook exceeds the defined failure threshold within the allowed time window,
   * it will be marked as disabled to prevent further issues.
   */
  async checkWebhooksHealth() {
    this.logger.debug('Starting to check webhooks health');
    const activeWebhooks = this.getCachedActiveWebhooks();
    const healthChecks = activeWebhooks.map(async (webhook) => {
      if (
        webhook.getMinutesFromStartTime() >= this.webhookHealthMinutesWindow
      ) {
        const failureRate = webhook.getFailureRate();
        if (failureRate > this.webhookFailureThreshold) {
          if (this.autoDisableWebhook) {
            const wasDisabled = await this.disableWebhook(webhook.id);
            if (wasDisabled) {
              this.logger.warn({
                message: 'Webhook disabled, failure rate exceeded threshold.',
                messageContext: {
                  webhook: {
                    id: webhook.id,
                    url: webhook.url,
                  },
                },
              });
            } else {
              this.logger.error({
                message: 'Failed to disable webhook',
                messageContext: {
                  webhook: {
                    id: webhook.id,
                    url: webhook.url,
                  },
                },
              });
            }
          } else {
            this.logger.warn({
              message:
                'Webhook exceeded failure threshold but was not disabled (autoDisableWebhook is OFF)',
              messageContext: {
                webhook: {
                  id: webhook.id,
                  url: webhook.url,
                },
              },
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

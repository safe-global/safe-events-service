import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './repositories/webhook.entity';
import { WebhookService } from './webhook.service';
import {
  WebhookDispatcherService,
  UNDICI_AGENT,
} from './webhookDispatcher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebhooksController } from './webhook.controller';
import { Agent, Dispatcher, RetryAgent } from 'undici';

const WEBHOOK_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const WEBHOOK_RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
];

function createWebhookAgent(configService: ConfigService): Dispatcher {
  const timeout = Number(configService.get('HTTP_TIMEOUT', 5_000));
  const maxRetries = Number(configService.get('HTTP_MAX_RETRIES', 2));

  return new RetryAgent(
    new Agent({
      connectTimeout: timeout,
      headersTimeout: timeout,
      bodyTimeout: timeout,
    }),
    {
      maxRetries,
      minTimeout: 1_000,
      maxTimeout: 5_000,
      timeoutFactor: 2,
      methods: ['POST'],
      statusCodes: WEBHOOK_RETRYABLE_STATUS_CODES,
      errorCodes: WEBHOOK_RETRYABLE_ERROR_CODES,
    },
  );
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    CacheModule.register(),
    ConfigModule,
  ],
  controllers: [WebhooksController],
  providers: [
    WebhookService,
    WebhookDispatcherService,
    {
      provide: UNDICI_AGENT,
      inject: [ConfigService],
      useFactory: createWebhookAgent,
    },
  ],
  exports: [TypeOrmModule, WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}

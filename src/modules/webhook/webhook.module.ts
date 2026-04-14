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
import { Agent, RetryAgent } from 'undici';

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
      useFactory: (configService: ConfigService) => {
        const timeout = Number(configService.get('HTTP_TIMEOUT', 5_000));
        const maxRetries = Number(configService.get('HTTP_MAX_RETRIES', 2));
        return new RetryAgent(
          new Agent({
            headersTimeout: timeout,
            bodyTimeout: timeout,
          }),
          {
            maxRetries,
            minTimeout: 200,
            maxTimeout: 2_000,
            timeoutFactor: 2,
            methods: ['POST'],
            statusCodes: [429, 500, 502, 503, 504],
            errorCodes: [
              'ECONNRESET',
              'ECONNREFUSED',
              'ENOTFOUND',
              'ETIMEDOUT',
              'ENETDOWN',
              'ENETUNREACH',
              'EHOSTDOWN',
              'EHOSTUNREACH',
              'EPIPE',
            ],
          },
        );
      },
    },
  ],
  exports: [TypeOrmModule, WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}

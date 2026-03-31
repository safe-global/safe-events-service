import * as http from 'http';
import * as https from 'https';
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './repositories/webhook.entity';
import { WebhookService } from './webhook.service';
import { WebhookDispatcherService } from './webhookDispatcher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { WebhooksController } from './webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    CacheModule.register(),
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const timeout = Number(configService.get('HTTP_TIMEOUT', 1_000));
        return {
          timeout,
          maxRedirects: Number(configService.get('HTTP_MAX_REDIRECTS', 0)),
          httpAgent: new http.Agent({ keepAlive: true, timeout }),
          httpsAgent: new https.Agent({ keepAlive: true, timeout }),
        };
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhookService, WebhookDispatcherService],
  exports: [TypeOrmModule, WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}

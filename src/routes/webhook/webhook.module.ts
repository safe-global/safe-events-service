import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    CacheModule.register(),
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        timeout: Number(configService.get('HTTP_TIMEOUT', 1_000)),
        maxRedirects: Number(configService.get('HTTP_MAX_REDIRECTS', 0)),
      }),
    }),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [TypeOrmModule, WebhookService],
})
export class WebhookModule {}

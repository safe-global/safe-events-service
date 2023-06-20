import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook]),
    CacheModule.register(),
    ConfigModule,
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 2,
      }),
    }),
  ],
  exports: [TypeOrmModule, WebhookService],
  providers: [WebhookService],
})
export class WebhookModule {}

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook]), CacheModule.register()],
  exports: [TypeOrmModule, WebhookService],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}

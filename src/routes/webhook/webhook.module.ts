import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook])],
  exports: [TypeOrmModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {};
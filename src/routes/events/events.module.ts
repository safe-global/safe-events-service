import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { QueueModule } from '../../datasources/queue/queue.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [QueueModule, WebhookModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}

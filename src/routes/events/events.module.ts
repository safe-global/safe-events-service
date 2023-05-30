import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { WebhookModule } from '../webhook/webhook.module';
import { QueueModule } from '../../datasources/queue/queue.module';

@Module({
  imports: [QueueModule, WebhookModule],
  // controllers: [Controller],
  providers: [EventsService],
})
export class EventsModule {}

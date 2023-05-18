import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [WebhookModule],
  // controllers: [Controller],
  providers: [EventsService],
})
export class EventsModule {}

import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { WebhookModule } from '../webhook/webhook.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [WebhookModule, ConfigModule],
  // controllers: [Controller],
  providers: [EventsService],
})
export class EventsModule {}

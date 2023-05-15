import { Module } from '@nestjs/common';
import { EventsService } from './events.service';

@Module({
  // controllers: [Controller],
  providers: [EventsService],
})
export class EventsModule {}

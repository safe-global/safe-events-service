import { Module } from '@nestjs/common';
import { QueueHealthIndicator } from './queue.health';
import { QueueProvider } from './queue.provider';

@Module({
  providers: [QueueProvider, QueueHealthIndicator],
  exports: [QueueProvider, QueueHealthIndicator],
})
export class QueueModule {}

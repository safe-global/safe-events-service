import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueHealthIndicator } from './queue.health';
import { QueueProvider } from './queue.provider';

@Module({
  imports: [ConfigModule],
  providers: [QueueProvider, QueueHealthIndicator],
  exports: [QueueProvider, QueueHealthIndicator],
})
export class QueueModule {}

import { Module } from '@nestjs/common';
import { QueueProvider } from './queue.provider';

@Module({
  providers: [QueueProvider],
  exports: [QueueProvider],
})
export class QueueModule {}

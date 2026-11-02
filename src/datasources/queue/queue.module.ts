import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueProvider } from './queue.provider';

@Module({
  imports: [ConfigModule],
  providers: [QueueProvider],
  exports: [QueueProvider],
})
export class QueueModule {}

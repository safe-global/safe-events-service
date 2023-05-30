import { Module } from '@nestjs/common';
import { QueueProvider } from './queue.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [QueueProvider],
  exports: [QueueProvider],
})
export class QueueModule {}

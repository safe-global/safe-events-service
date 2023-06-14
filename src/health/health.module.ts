import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { QueueModule } from '../datasources/queue/queue.module';

@Module({
  imports: [TerminusModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}

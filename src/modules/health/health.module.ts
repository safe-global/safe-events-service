import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { QueueModule } from '../../datasources/queue/queue.module';
import { DatabaseHealthIndicator } from '../../datasources/db/database.health';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';

@Module({
  imports: [TerminusModule, QueueModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { QueueModule } from '../../datasources/queue/queue.module';
import { QueueHealthIndicator } from '../../datasources/queue/queue.health';

@Module({
  imports: [ConfigModule, TerminusModule, QueueModule],
  controllers: [HealthController],
  providers: [QueueHealthIndicator],
})
export class HealthModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { QueueModule } from '../datasources/queue/queue.module';

@Module({
  imports: [ConfigModule, TerminusModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}

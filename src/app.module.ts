import { Module } from '@nestjs/common';

import { AboutModule } from './modules/about/about.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './datasources/db/database.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { pinoHttpOptions } from './logging/pino-logger.config';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    AboutModule,
    ConfigModule.forRoot(),
    DatabaseModule,
    EventsModule,
    HealthModule,
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    ScheduleModule.forRoot(),
    WebhookModule,
  ],
})
export class AppModule {}

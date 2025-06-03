import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { AboutModule } from './modules/about/about.module';
import { AdminJsModule } from './modules/admin/adminjs';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './datasources/db/database.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    AboutModule,
    AdminJsModule,
    ConfigModule.forRoot(),
    DatabaseModule,
    EventsModule,
    HealthModule,
    ScheduleModule.forRoot(),
    WebhookModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

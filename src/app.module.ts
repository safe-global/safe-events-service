import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { AboutModule } from './routes/about/about.module';
import { AdminJsModule } from './admin/adminjs';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './datasources/db/database.module';
import { EventsModule } from './routes/events/events.module';
import { HealthModule } from './health/health.module';
import { WebhookModule } from './routes/webhook/webhook.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';

@Module({
  imports: [
    AboutModule,
    AdminJsModule,
    ConfigModule.forRoot(),
    DatabaseModule,
    EventsModule,
    HealthModule,
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

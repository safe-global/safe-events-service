import { Module } from '@nestjs/common';

import { AboutModule } from './routes/about/about.module';
import { AdminJsModule } from './admin/adminjs';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './datasources/db/database.module';
import { EventsModule } from './routes/events/events.module';
import { HealthModule } from './health/health.module';
import { WebhookModule } from './routes/webhook/webhook.module';

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
export class AppModule {}

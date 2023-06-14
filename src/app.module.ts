import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AboutModule } from './routes/about/about.module';
import { WebhookModule } from './routes/webhook/webhook.module';
import { AdminJsModule } from './admin/adminjs';
import { EventsModule } from './routes/events/events.module';
import { DatabaseModule } from './datasources/db/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DatabaseModule,
    AboutModule,
    EventsModule,
    WebhookModule,
    AdminJsModule,
    HealthModule,
  ],
})
export class AppModule {}

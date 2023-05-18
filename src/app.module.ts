import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AboutModule } from './routes/about/about.module';
import { WebhookModule } from './routes/webhook/webhook.module';
import { AdminJsModule } from './admin/adminjs';
import { EventsModule } from './routes/events/events.module';

@Module({
  imports: [
    AboutModule,
    EventsModule,
    WebhookModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'test',
      entities: [],
      autoLoadEntities: true,
      synchronize: true, // TODO False in production
    }),
    AdminJsModule,
  ],
})
export class AppModule {}

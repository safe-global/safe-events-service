import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [],
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production', // TODO False in production
      }),
      inject: [ConfigService],
    }),
    AdminJsModule,
  ],
})
export class AppModule {}

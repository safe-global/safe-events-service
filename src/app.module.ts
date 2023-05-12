import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AboutModule } from './routes/about/about.module';
import { WebhookModule } from './routes/webhook/webhook.module';

@Module({
  imports: [
    AboutModule,
    WebhookModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'test',
      entities: [],
      synchronize: true,  // TODO False in production
      autoLoadEntities: true,
    }),
  ]
})
export class AppModule {}

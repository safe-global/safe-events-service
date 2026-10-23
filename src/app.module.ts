import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { AboutModule } from './modules/about/about.module';
import { AdminJsModule } from './modules/admin/adminjs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './datasources/db/database.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoHttpOptions } from './logging/pino-logger.config';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ReverseProxyMiddleware } from './middleware/reverse-proxy.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import {
  configModuleOptions,
  EnvironmentVariables,
} from './config/environment';

@Module({
  imports: [
    AboutModule,
    AdminJsModule,
    ConfigModule.forRoot(configModuleOptions),
    DatabaseModule,
    EventsModule,
    HealthModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        pinoHttp: buildPinoHttpOptions({
          urlBasePath: configService.get('URL_BASE_PATH', { infer: true }),
          logLevel: configService.get('LOG_LEVEL', { infer: true }),
          nodeEnv: configService.get('NODE_ENV', { infer: true }),
        }),
      }),
    }),
    ScheduleModule.forRoot(),
    WebhookModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ReverseProxyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import { AboutModule } from './modules/about/about.module';
import { AdminJsModule } from './modules/admin/adminjs';
import { ADMIN_BASE_PATH } from './modules/admin/admin.constants';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './datasources/db/database.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ReverseProxyMiddleware } from './middleware/reverse-proxy.middleware';
import { ScheduleModule } from '@nestjs/schedule';

/* eslint-disable */
const { version: packageVersion } = require('../package.json');
/* eslint-enable */

const HEALTH_BASE_PATH = (process.env.URL_BASE_PATH || '') + '/health';

/**
 * Requests we don't want a `httpRequest`/`httpResponse` log line for:
 * health probes (one every few seconds) and the AdminJS panel, which pulls
 * dozens of static assets per page load.
 */
function isIgnoredRequest(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return (
    path === HEALTH_BASE_PATH ||
    path.startsWith(HEALTH_BASE_PATH + '/') ||
    path === ADMIN_BASE_PATH ||
    path.startsWith(ADMIN_BASE_PATH + '/')
  );
}

@Module({
  imports: [
    AboutModule,
    AdminJsModule,
    ConfigModule.forRoot(),
    DatabaseModule,
    EventsModule,
    HealthModule,
    LoggerModule.forRoot({
      pinoHttp: {
        // pino transport spawns a worker thread that NestJS doesn't close on
        // shutdown, which leaves an open handle and hangs Jest.
        // Keep it for local dev only
        transport:
          process.env.NODE_ENV !== 'production' &&
          process.env.NODE_ENV !== 'test'
            ? { target: 'pino-pretty' }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'INFO',
        customLevels: { log: 30 },
        autoLogging: {
          ignore: (req) => isIgnoredRequest(req.url),
        },
        genReqId: (req, res) => {
          const requestId =
            (req.headers['x-request-id'] as string) ?? randomUUID();
          res.setHeader('x-request-id', requestId);
          return requestId;
        },
        base: undefined,
        useOnlyCustomLevels: false,
        messageKey: 'message',
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        customAttributeKeys: {
          req: 'httpRequest',
        },
        formatters: {
          level: (label: string) => ({
            level: label === 'log' ? 'INFO' : label.toUpperCase(),
          }),
          log: (object: Record<string, unknown>): Record<string, unknown> => {
            const {
              httpRequest,
              res,
              responseTime,
              reqId,
              err,
              messageContext,
              context,
              message,
              ...rest
            } = object as {
              httpRequest?: {
                id?: string;
                method?: string;
                url?: string;
                remoteAddress?: string;
                headers?: Record<string, string | string[] | undefined>;
              };
              res?: { statusCode?: number };
              responseTime?: number;
              reqId?: string;
              err?: { message?: string; stack?: string };
              context?: string;
              message?: string;
              messageContext?: Record<string, unknown>;
              [key: string]: unknown;
            };
            const origin = httpRequest?.headers?.origin as string | undefined;
            const finalHttpRequest = httpRequest
              ? {
                  method: httpRequest.method,
                  url: httpRequest.url,
                  clientIp: httpRequest.remoteAddress,
                  origin,
                  requestId: httpRequest.id ?? reqId,
                }
              : undefined;
            const finalHttpResponse =
              res?.statusCode !== undefined || responseTime !== undefined
                ? {
                    ...(res?.statusCode !== undefined && {
                      statusCode: res.statusCode,
                    }),
                    ...(responseTime !== undefined && { responseTime }),
                  }
                : undefined;
            const appInfo = {
              appInfo: {
                version: packageVersion,
              },
            };

            return {
              ...rest,
              ...appInfo,
              ...(finalHttpRequest ? { httpRequest: finalHttpRequest } : {}),
              ...(finalHttpResponse ? { httpResponse: finalHttpResponse } : {}),
              ...(err
                ? {
                    httpRequestError: {
                      message: err.message,
                      stackTrace: err.stack,
                    },
                  }
                : {}),
              context: context ?? 'RequestLoggerMiddleware',
              message,
              ...(messageContext ? { messageContext } : {}),
            };
          },
        },
        customSuccessMessage: (req, res) =>
          `${req.method} ${req.url} ${res.statusCode}`,
        serializers: {
          httpRequest: (req: {
            id?: string;
            method: string;
            url: string;
            remoteAddress?: string;
            headers?: Record<string, string | string[] | undefined>;
          }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
            origin: req.headers?.origin,
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
      },
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

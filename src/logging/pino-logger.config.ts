import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import { ADMIN_BASE_PATH } from '../modules/admin/admin.constants';

/* eslint-disable */
const { version: packageVersion } = require('../../package.json');
/* eslint-enable */

const HEALTH_BASE_PATH = (process.env.URL_BASE_PATH || '') + '/health';

/**
 * Requests we don't want a `httpRequest`/`httpResponse` log line for:
 * health probes (one every few seconds) and the AdminJS panel, which pulls
 * dozens of static assets per page load.
 */
export function isIgnoredRequest(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return (
    path === HEALTH_BASE_PATH ||
    path.startsWith(HEALTH_BASE_PATH + '/') ||
    path === ADMIN_BASE_PATH ||
    path.startsWith(ADMIN_BASE_PATH + '/')
  );
}

export const pinoHttpOptions: Params['pinoHttp'] = {
  // pino transport spawns a worker thread that NestJS doesn't close on
  // shutdown, which leaves an open handle and hangs Jest.
  // Keep it for local dev only
  transport:
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
      ? { target: 'pino-pretty' }
      : undefined,
  // pino only case-normalizes its built-in levels, so an uppercase value
  // for our custom `log` level would throw. Lowercase it ourselves.
  level: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
  // The logger this replaced used NestJS's LogLevel names, where the
  // info-equivalent level is called `log`, so existing deployments (and
  // .env.sample) set LOG_LEVEL=log. pino has no such level and would
  // throw at startup, so register it as an alias of info (both 30). The
  // level formatter below maps it back to INFO in the output.
  customLevels: { log: 30 },
  autoLogging: {
    ignore: (req) => isIgnoredRequest(req.url),
  },
  genReqId: (req, res) => {
    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
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
        res,
        responseTime,
        err,
        messageContext,
        context,
        message,
        ...rest
      } = object as {
        res?: { statusCode?: number };
        responseTime?: number;
        err?: { message?: string; stack?: string };
        context?: string;
        message?: string;
        messageContext?: Record<string, unknown>;
        [key: string]: unknown;
      };
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
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  // Without this, pino-http labels every failed request "request errored",
  // which loses the method/url/status the success line carries.
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    // pino applies serializers to child bindings, which is how pino-http
    // attaches the request, so the request log shape is defined here rather
    // than in `formatters.log` (which never sees it).
    httpRequest: (req: {
      id?: string;
      method: string;
      url: string;
      remoteAddress?: string;
      headers?: Record<string, string | string[] | undefined>;
    }) => ({
      method: req.method,
      url: req.url,
      clientIp: req.remoteAddress,
      origin: req.headers?.origin,
      requestId: req.id,
    }),
    res: (res: { statusCode: number }) => ({
      statusCode: res.statusCode,
    }),
  },
};

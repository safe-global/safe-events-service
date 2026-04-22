import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  DocumentBuilder,
  OpenAPIObject,
  SwaggerCustomOptions,
} from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JsonConsoleLogger } from './logging/json-logger';
import { INestApplication, LogLevel, ValidationPipe } from '@nestjs/common';
import { Request, RequestHandler, Response } from 'express';
import { wrapAdminResponse } from './middleware/admin-proxy.middleware';
import {
  getForwardedPrefix,
  ReverseProxyMiddleware,
} from './middleware/reverse-proxy.middleware';

/**
 * Configure swagger for app
 */
function setupSwagger(app: INestApplication, basePath: string) {
  const config = new DocumentBuilder()
    .setTitle('Safe Events Service')
    .setDescription('Safe Events Service API')
    .setVersion('1.0')
    .addSecurity('apiKeyHeader', {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
    })
    // .addTag('safe')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(basePath, app, document, {
    // When behind a reverse proxy, patch the OpenAPI document per-request so
    // that the servers field reflects the externally-visible base URL.  This
    // makes the "Try it out" feature in Swagger UI send requests to the proxy
    // address rather than the internal host.
    //
    // The cast is needed because @nestjs/swagger types this callback as a
    // generic <TRequest, TResponse> to stay adapter-agnostic, but at runtime
    // the underlying adapter is always Express.
    patchDocumentOnRequest: ((
      req: Request,
      _res: Response,
      doc: OpenAPIObject,
    ): OpenAPIObject => {
      const prefix = getForwardedPrefix(req);
      if (!prefix) return doc;
      return { ...doc, servers: [{ url: prefix }] };
    }) as NonNullable<SwaggerCustomOptions['patchDocumentOnRequest']>,
  });
}

function getLogLevels(): LogLevel[] {
  const default_log_level: LogLevel = 'log';
  const all_log_levels: LogLevel[] = [
    'verbose',
    'debug',
    'log',
    'warn',
    'error',
    'fatal',
  ];
  let log_level = (
    process.env.LOG_LEVEL || default_log_level
  ).toLowerCase() as LogLevel;
  if (!all_log_levels.includes(log_level)) {
    console.log(
      `LOG_LEVEL ${log_level} is not valid. Using default log level '${default_log_level}'`,
    );
    log_level = default_log_level;
  }

  return all_log_levels.slice(all_log_levels.indexOf(log_level));
}

/**
 * `@adminjs/nestjs` mounts its Express router in `onModuleInit` and then
 * reorders it to the front of the Express stack, so Nest `MiddlewareConsumer`
 * entries never run for `/admin/*`. We wrap the admin layer's handler after
 * `app.listen()` with two pieces:
 *
 *  - `ReverseProxyMiddleware`: rewrites `Location` headers emitted by
 *    `res.redirect(...)` so post-login/logout redirects point to the
 *    externally-visible proxy URL.
 *  - `wrapAdminResponse`: patches `res.send` so AdminJS's HTML/JSON bodies
 *    (which hardcode the internal `rootPath`) get rewritten to include the
 *    proxy prefix.
 *
 * Both are no-op when `x-forwarded-prefix` is absent.
 */
function installAdminProxyBodyRewrite(app: INestApplication): void {
  type ExpressLayer = { name?: string; handle: RequestHandler };
  const expressApp = app.getHttpAdapter().getInstance() as {
    router?: { stack: ExpressLayer[] };
    _router?: { stack: ExpressLayer[] };
  };
  const stack = expressApp.router?.stack ?? expressApp._router?.stack;
  const adminLayer = stack?.find((layer) => layer.name === 'admin');
  if (!adminLayer) {
    console.warn(
      '[installAdminProxyBodyRewrite] admin layer not found in Express stack — proxy rewriting will not work',
    );
    return;
  }

  const originalHandle = adminLayer.handle;
  const reverseProxy = new ReverseProxyMiddleware();
  adminLayer.handle = (req, res, next) => {
    reverseProxy.use(req, res, () => {
      wrapAdminResponse(req, res);
      originalHandle(req, res, next);
    });
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? new JsonConsoleLogger('', {
            logLevels: getLogLevels(),
            timestamp: false,
          })
        : ['verbose', 'debug', 'log', 'fatal', 'error', 'warn'],
  });
  const basePath = process.env.URL_BASE_PATH || '';
  app.setGlobalPrefix(basePath);
  setupSwagger(app, basePath);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
  installAdminProxyBodyRewrite(app);
}
bootstrap();

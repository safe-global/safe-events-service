import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  DocumentBuilder,
  OpenAPIObject,
  SwaggerCustomOptions,
} from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, RequestHandler, Response } from 'express';
import { patchAdminResponse } from './middleware/admin-proxy.middleware';
import { getForwardedPrefix } from './middleware/reverse-proxy.middleware';

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

/**
 * `@adminjs/nestjs` mounts its Express router in `onModuleInit` and then
 * reorders it to the front of the Express stack, so Nest `MiddlewareConsumer`
 * entries never run for `/admin/*`. We therefore wrap the admin layer's
 * handler after `app.listen()` and apply `patchAdminResponse`, which adapts
 * AdminJS's Location headers, HTML/JSON bodies, and static-asset serving (see
 * its docs). Proxy-prefix rewrites are no-op without `x-forwarded-prefix`.
 */
function installAdminResponsePatch(app: INestApplication): void {
  type ExpressLayer = { name?: string; handle: RequestHandler };
  const expressApp = app.getHttpAdapter().getInstance() as {
    router?: { stack: ExpressLayer[] };
    _router?: { stack: ExpressLayer[] };
  };
  const stack = expressApp.router?.stack ?? expressApp._router?.stack;
  const adminLayer = stack?.find((layer) => layer.name === 'admin');
  if (!adminLayer) {
    console.warn(
      '[installAdminResponsePatch] admin layer not found in Express stack — admin response patching will not work',
    );
    return;
  }

  const originalHandle = adminLayer.handle;
  adminLayer.handle = (req, res, next) => {
    patchAdminResponse(req, res);
    originalHandle(req, res, next);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const basePath = process.env.URL_BASE_PATH || '';
  app.setGlobalPrefix(basePath);
  setupSwagger(app, basePath);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
  installAdminResponsePatch(app);
}
bootstrap();

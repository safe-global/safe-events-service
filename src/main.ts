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
import { Request, Response } from 'express';
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Open SSE streams would keep the HTTP server, and so the shutdown, from
    // finishing
    forceCloseConnections: true,
  });
  app.useLogger(app.get(Logger));
  // Shutdown hooks close the RabbitMQ connection on SIGTERM. Node runs as PID 1
  // in the container, and Linux ignores a signal without a handler for PID 1,
  // so the signal Nest sends again after the hooks would not stop the process:
  // exit explicitly instead
  app.enableShutdownHooks([], { useProcessExit: true });
  const basePath = process.env.URL_BASE_PATH || '';
  app.setGlobalPrefix(basePath);
  setupSwagger(app, basePath);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
bootstrap();

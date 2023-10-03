import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JsonConsoleLogger } from './logging/json-logger';
import { INestApplication } from '@nestjs/common';

/**
 * Configure swagger for app
 */
function setupSwagger(app: INestApplication, basePath: string) {
  const config = new DocumentBuilder()
    .setTitle('Safe Events Service')
    .setDescription('Safe Events Service API')
    .setVersion('1.0')
    // .addTag('safe')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(basePath, app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? new JsonConsoleLogger('', {
            logLevels: ['log', 'error', 'warn'],
            timestamp: false,
          })
        : ['verbose', 'debug', 'log', 'error', 'warn'],
  });
  const basePath = process.env.URL_BASE_PATH || '';
  app.setGlobalPrefix(basePath);
  setupSwagger(app, basePath);
  await app.listen(3000);
}
bootstrap();

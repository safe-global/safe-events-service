import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JsonConsoleLogger } from './logging/json-logger';
import { INestApplication, LogLevel } from '@nestjs/common';

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
  await app.listen(3000);
}
bootstrap();

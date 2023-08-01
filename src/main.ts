import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JsonConsoleLogger } from './logging/json-logger';

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

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Safe Events Service')
    .setDescription('Safe Events Service API')
    .setVersion('1.0')
    // .addTag('safe')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  // End Swagger -------------

  await app.listen(3000);
}
bootstrap();

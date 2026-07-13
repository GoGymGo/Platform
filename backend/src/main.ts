import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap';
import type { Environment } from './config/environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApplication(app);

  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();

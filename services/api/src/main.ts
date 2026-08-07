import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap';
import type { Environment } from './config/environment';
import { shutdownTelemetry } from './observability/instrumentation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApplication(app);

  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  if (config.get('RUNTIME_ROLE', { infer: true }) !== 'api') {
    throw new Error('The API process requires RUNTIME_ROLE=api.');
  }
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap().catch(async () => {
  process.stderr.write('{"event":"api.bootstrap.failed"}\n');
  await shutdownTelemetry();
  process.exitCode = 1;
});

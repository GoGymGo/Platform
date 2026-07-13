import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Environment } from './config/environment';
import { OperationsWorkerService } from './modules/operations/operations-worker.service';

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const worker = app.get(OperationsWorkerService);
  const pollInterval = config.get('WORKER_POLL_INTERVAL_MS', { infer: true });
  let running = true;
  const stop = () => {
    running = false;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  while (running) {
    try {
      const result = await worker.runOnce();
      if (
        result.notificationsSent > 0 ||
        result.paymentsReconciled > 0 ||
        result.privacyExportsDeleted > 0 ||
        result.privacyOperationsCompleted > 0 ||
        result.privacyOperationsFailed > 0 ||
        result.webhooksProcessed > 0
      ) {
        logger.log({ event: 'worker.batch.completed', ...result });
      }
    } catch {
      logger.error({ event: 'worker.batch.failed' });
    }
    if (running) {
      await delay(pollInterval);
    }
  }

  await app.close();
}

void bootstrap();

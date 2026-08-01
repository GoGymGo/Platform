import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import type { Environment } from './config/environment';
import { OperationsWorkerService } from './modules/operations/operations-worker.service';
import {
  safeOperationalErrorCode,
  WorkerObservabilityService,
} from './modules/operations/worker-observability.service';
import { shutdownTelemetry } from './observability/instrumentation';

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
  if (config.get('RUNTIME_ROLE', { infer: true }) !== 'worker') {
    throw new Error('The worker process requires RUNTIME_ROLE=worker.');
  }
  const worker = app.get(OperationsWorkerService);
  const observability = app.get(WorkerObservabilityService);
  const pollInterval = config.get('WORKER_POLL_INTERVAL_MS', { infer: true });
  const instanceId = `${process.env.CLOUD_RUN_REVISION ?? 'local'}:${randomUUID()}`;
  let running = true;
  const stop = () => {
    running = false;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await observability.markStarted(instanceId);

  while (running) {
    try {
      const result = await observability.runObserved(instanceId, () =>
        worker.runOnce(),
      );
      if (Object.values(result).some((count) => count > 0)) {
        logger.log({ event: 'worker.batch.completed', ...result });
      }
    } catch (error) {
      logger.error({
        errorType: safeOperationalErrorCode(error),
        event: 'worker.batch.failed',
      });
    }
    if (running) {
      await delay(pollInterval);
    }
  }

  try {
    await observability.markStopping(instanceId);
  } catch (error) {
    logger.warn({
      errorType: safeOperationalErrorCode(error),
      event: 'worker.shutdown.heartbeat_failed',
    });
  }
  await app.close();
}

void bootstrap().catch(async (error) => {
  process.stderr.write(
    `${JSON.stringify({
      errorType: safeOperationalErrorCode(error),
      event: 'worker.bootstrap.failed',
    })}\n`,
  );
  await shutdownTelemetry();
  process.exitCode = 1;
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { JsonObject } from '../../database/database.types';
import type { WorkerRunResult } from './operations-worker.service';

const WORKER_NAME = 'operations';
const WORKER_RESULT_KEYS = [
  'competitionsActivated',
  'competitionsCancelled',
  'competitionPeriodsSettled',
  'notificationsSent',
  'profileMediaCleanupFailed',
  'profileMediaDeleted',
  'privacyExportsDeleted',
  'privacyOperationsCompleted',
  'privacyOperationsFailed',
] as const satisfies readonly (keyof WorkerRunResult)[];

export function safeOperationalErrorCode(error: unknown): string {
  return error instanceof Error
    ? error.name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 120) || 'Error'
    : 'UnknownError';
}

export class WorkerHeartbeatLeaseLostError extends Error {
  constructor() {
    super('The worker heartbeat belongs to a newer process instance.');
    this.name = 'WorkerHeartbeatLeaseLostError';
  }
}

@Injectable()
export class WorkerObservabilityService {
  private readonly batchCounter = metrics
    .getMeter('gogymgo-worker')
    .createCounter('gogymgo.worker.batches');
  private readonly batchDuration = metrics
    .getMeter('gogymgo-worker')
    .createHistogram('gogymgo.worker.batch.duration', { unit: 'ms' });
  private readonly operationCounter = metrics
    .getMeter('gogymgo-worker')
    .createCounter('gogymgo.worker.operations');
  private readonly tracer = trace.getTracer('gogymgo-worker');
  private readonly heartbeatIntervalMs: number;
  private lastSuccessfulHeartbeatAt = 0;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService<Environment, true>,
  ) {
    this.heartbeatIntervalMs = config.get('WORKER_HEARTBEAT_INTERVAL_MS', {
      infer: true,
    });
  }

  async markStarted(instanceId: string): Promise<void> {
    const now = new Date();
    await this.database.connection
      .insertInto('worker_heartbeats')
      .values({
        instance_id: instanceId,
        last_completed_at: null,
        last_failed_at: null,
        last_failure_code: null,
        last_result: null,
        last_started_at: now,
        status: 'running',
        updated_at: now,
        worker_name: WORKER_NAME,
      })
      .onConflict((conflict) =>
        conflict.column('worker_name').doUpdateSet({
          instance_id: instanceId,
          last_started_at: now,
          status: 'running',
          updated_at: now,
        }),
      )
      .execute();
    this.lastSuccessfulHeartbeatAt = now.getTime();
  }

  async runObserved(
    instanceId: string,
    run: () => Promise<WorkerRunResult>,
  ): Promise<WorkerRunResult> {
    return this.tracer.startActiveSpan('operations.run_once', async (span) => {
      const startedAt = Date.now();
      try {
        const result = await run();
        const durationMs = Date.now() - startedAt;
        this.batchCounter.add(1, { outcome: 'success' });
        this.batchDuration.record(durationMs, { outcome: 'success' });
        for (const operation of WORKER_RESULT_KEYS) {
          const count = result[operation];
          this.operationCounter.add(count, { operation });
          span.setAttribute(`gogymgo.worker.${operation}`, count);
        }
        span.setStatus({ code: SpanStatusCode.OK });

        if (
          Date.now() - this.lastSuccessfulHeartbeatAt >=
          this.heartbeatIntervalMs
        ) {
          await this.recordSuccess(instanceId, result);
        }
        return result;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const errorCode = safeOperationalErrorCode(error);
        this.batchCounter.add(1, { outcome: 'failure' });
        this.batchDuration.record(durationMs, { outcome: 'failure' });
        span.setAttribute('error.type', errorCode);
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorCode });
        this.lastSuccessfulHeartbeatAt = 0;
        try {
          await this.recordFailure(instanceId, errorCode);
        } catch {
          // The structured failure log and OTLP metric remain available if the database is down.
        }
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async markStopping(instanceId: string): Promise<void> {
    await this.database.connection
      .updateTable('worker_heartbeats')
      .set({ status: 'stopping', updated_at: new Date() })
      .where('worker_name', '=', WORKER_NAME)
      .where('instance_id', '=', instanceId)
      .execute();
  }

  private async recordSuccess(
    instanceId: string,
    result: WorkerRunResult,
  ): Promise<void> {
    const now = new Date();
    const updated = await this.database.connection
      .updateTable('worker_heartbeats')
      .set({
        last_completed_at: now,
        last_failure_code: null,
        last_result: result as unknown as JsonObject,
        status: 'running',
        updated_at: now,
      })
      .where('worker_name', '=', WORKER_NAME)
      .where('instance_id', '=', instanceId)
      .returning('worker_name')
      .executeTakeFirst();
    if (!updated) throw new WorkerHeartbeatLeaseLostError();
    this.lastSuccessfulHeartbeatAt = now.getTime();
  }

  private async recordFailure(
    instanceId: string,
    errorCode: string,
  ): Promise<void> {
    const now = new Date();
    const updated = await this.database.connection
      .updateTable('worker_heartbeats')
      .set({
        last_failed_at: now,
        last_failure_code: errorCode,
        status: 'failed',
        updated_at: now,
      })
      .where('worker_name', '=', WORKER_NAME)
      .where('instance_id', '=', instanceId)
      .returning('worker_name')
      .executeTakeFirst();
    if (!updated) throw new WorkerHeartbeatLeaseLostError();
  }
}

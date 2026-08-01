import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const config = {
    get: () => 120_000,
  } as unknown as ConfigService<Environment, true>;

  it('reports API liveness without external dependencies', () => {
    const response = new HealthController(
      {} as DatabaseService,
      config,
    ).getHealth();

    expect(response.service).toBe('gogymgo-api');
    expect(response.status).toBe('ok');
    expect(Number.isFinite(response.uptimeSeconds)).toBe(true);
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('reports readiness while the worker heartbeat is healthy', async () => {
    const now = new Date();
    const executeTakeFirst = jest.fn().mockResolvedValue({
      last_completed_at: now,
      last_failed_at: null,
      last_started_at: now,
      status: 'running',
    });
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const controller = new HealthController(
      { connection: { selectFrom } } as unknown as DatabaseService,
      config,
    );

    await expect(controller.getReadiness()).resolves.toEqual(
      expect.objectContaining({
        dependencies: { database: 'ok', worker: 'healthy' },
        status: 'ok',
      }),
    );
  });

  it('fails readiness when the worker heartbeat is stale', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const controller = new HealthController(
      { connection: { selectFrom } } as unknown as DatabaseService,
      config,
    );

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

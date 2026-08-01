import type { ConfigService } from '@nestjs/config';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { ProfilesService } from '../profiles/profiles.service';
import type { ExpoPushClient } from './expo-push.client';
import { NotificationsService } from './notifications.service';

function fluentQuery() {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'forUpdate',
    'orderBy',
    'returning',
    'returningAll',
    'select',
    'set',
    'skipLocked',
    'where',
  ]) {
    query[method] = jest.fn(() => query);
  }
  return query;
}

function createService(candidateId?: string) {
  const selection = fluentQuery();
  selection.executeTakeFirst = jest
    .fn()
    .mockResolvedValue(candidateId ? { id: candidateId } : undefined);
  const update = fluentQuery();
  update.executeTakeFirstOrThrow = jest.fn().mockResolvedValue({
    attempt_count: 0,
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    id: candidateId,
    last_error: null,
    lease_expires_at: null,
    lease_token: null,
    payload: {},
    scheduled_at: new Date('2026-08-01T00:00:00.000Z'),
    sent_at: null,
    status: 'pending',
    template: 'competition_cancelled',
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    user_id: 'user-1',
  });
  const transaction = {
    selectFrom: jest.fn(() => selection),
    updateTable: jest.fn(() => update),
  };
  const directUpdate = fluentQuery();
  directUpdate.executeTakeFirst = jest
    .fn()
    .mockResolvedValue({ id: 'delivery-1' });
  const database = {
    connection: {
      updateTable: jest.fn(() => directUpdate),
      transaction: jest.fn(() => ({
        execute: (callback: (value: unknown) => Promise<unknown>) =>
          callback(transaction),
      })),
    },
  } as unknown as DatabaseService;
  const config = {
    get: jest.fn(() => true),
  } as unknown as ConfigService<Environment, true>;
  const service = new NotificationsService(
    database,
    {} as IdempotencyService,
    {} as ProfilesService,
    {} as ExpoPushClient,
    config,
  );

  return { directUpdate, selection, service, transaction, update };
}

function claimNext(service: NotificationsService, now: Date) {
  return (
    service as unknown as {
      claimNextDelivery(value: Date): Promise<{
        id: string;
        lease_token: string;
      } | null>;
    }
  ).claimNextDelivery(now);
}

function updateDelivery(service: NotificationsService, leaseToken: string) {
  return (
    service as unknown as {
      updateDelivery(
        id: string,
        token: string,
        status: 'sent',
        error: null,
      ): Promise<boolean>;
    }
  ).updateDelivery('delivery-1', leaseToken, 'sent', null);
}

describe('NotificationsService delivery claims', () => {
  it('claims one due delivery under a short, unique lease', async () => {
    const { selection, service, update } = createService('delivery-1');
    const now = new Date('2026-08-01T00:00:00.000Z');

    const claimed = await claimNext(service, now);

    expect(selection.forUpdate).toHaveBeenCalledTimes(1);
    expect(selection.skipLocked).toHaveBeenCalledTimes(1);
    expect(selection.where).toHaveBeenCalledWith(expect.any(Function));
    expect(update.set).toHaveBeenCalledWith({
      lease_expires_at: new Date('2026-08-01T00:00:30.000Z'),
      lease_token: expect.any(String),
      updated_at: now,
    });
    expect(claimed).toEqual({
      attempt_count: 0,
      created_at: new Date('2026-08-01T00:00:00.000Z'),
      id: 'delivery-1',
      last_error: null,
      lease_expires_at: null,
      lease_token: expect.any(String),
      payload: {},
      scheduled_at: new Date('2026-08-01T00:00:00.000Z'),
      sent_at: null,
      status: 'pending',
      template: 'competition_cancelled',
      updated_at: new Date('2026-08-01T00:00:00.000Z'),
      user_id: 'user-1',
    });
  });

  it('does not write a lease when no due delivery is available', async () => {
    const { service, transaction } = createService();

    await expect(
      claimNext(service, new Date('2026-08-01T00:00:00.000Z')),
    ).resolves.toBeNull();
    expect(transaction.updateTable).not.toHaveBeenCalled();
  });

  it('reports whether the completion still owns the delivery lease', async () => {
    const { directUpdate, service } = createService();

    await expect(updateDelivery(service, 'lease-1')).resolves.toBe(true);
    expect(directUpdate.where).toHaveBeenCalledWith(
      'lease_token',
      '=',
      'lease-1',
    );

    directUpdate.executeTakeFirst.mockResolvedValueOnce(undefined);
    await expect(updateDelivery(service, 'expired-lease')).resolves.toBe(false);
  });
});

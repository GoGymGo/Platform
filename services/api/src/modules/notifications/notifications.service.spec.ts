import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { ProfilesService } from '../profiles/profiles.service';
import type { ExpoPushClient } from './expo-push.client';
import { NotificationsService } from './notifications.service';

function fluentQuery() {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'columns',
    'doNothing',
    'doUpdateSet',
    'forUpdate',
    'limit',
    'onConflict',
    'orderBy',
    'returning',
    'returningAll',
    'select',
    'set',
    'skipLocked',
    'values',
    'where',
  ]) {
    query[method] = jest.fn(() => query);
  }
  return query;
}

function makeService(
  database: DatabaseService,
  overrides: {
    enabled?: boolean;
    idempotency?: IdempotencyService;
    profiles?: ProfilesService;
    pushClient?: ExpoPushClient;
  } = {},
) {
  const config = {
    get: jest.fn(() => overrides.enabled ?? true),
  } as unknown as ConfigService<Environment, true>;
  return new NotificationsService(
    database,
    overrides.idempotency ?? ({} as IdempotencyService),
    overrides.profiles ?? ({} as ProfilesService),
    overrides.pushClient ?? ({} as ExpoPushClient),
    config,
  );
}

const delivery = {
  attempt_count: 1,
  completed_device_ids: [],
  created_at: new Date('2026-08-01T00:00:00.000Z'),
  dedupe_key: 'competition_cancelled:competition-1',
  delivered_count: 0,
  id: 'delivery-1',
  last_error: null,
  lease_expires_at: new Date('2026-08-01T00:00:30.000Z'),
  lease_token: 'lease-1',
  payload: { competitionId: 'competition-1' },
  scheduled_at: new Date('2026-08-01T00:00:00.000Z'),
  sent_at: null,
  status: 'pending' as const,
  target_device_ids: ['device-1', 'device-2'],
  template: 'competition_cancelled',
  updated_at: new Date('2026-08-01T00:00:00.000Z'),
  user_id: 'user-1',
};

describe('NotificationsService device lifecycle', () => {
  it('reports fail-closed registration capability', () => {
    const disabled = makeService({} as DatabaseService, { enabled: false });
    const enabled = makeService({} as DatabaseService, { enabled: true });

    expect(disabled.getCapabilities()).toEqual({
      deliveryStatus: 'disabled',
      maximumDevices: 5,
      registrationAvailable: false,
    });
    expect(enabled.getCapabilities()).toEqual({
      deliveryStatus: 'available',
      maximumDevices: 5,
      registrationAvailable: true,
    });
  });

  it('reauthorizes the current principal before an idempotent replay', async () => {
    const execute = jest.fn().mockResolvedValue({
      enabled: true,
      id: 'device-1',
      platform: 'ios',
      provider: 'expo',
    });
    const ensureUser = jest.fn().mockResolvedValue({ id: 'user-1' });
    const service = makeService({} as DatabaseService, {
      idempotency: { execute } as unknown as IdempotencyService,
      profiles: { ensureUser } as unknown as ProfilesService,
    });
    const principal = {
      firebaseUid: 'firebase-user-1',
    } as AuthenticatedPrincipal;

    await service.registerDevice(principal, 'registration-key', {
      installationId: '40000000-0000-4000-8000-000000000004',
      platform: 'ios',
      pushToken: 'ExponentPushToken[device-one]',
    });

    const calls = execute.mock.calls as unknown as [
      [
        unknown,
        unknown,
        (transaction: Transaction<Database>) => Promise<{ userId: string }>,
      ],
    ];
    const authorize = calls[0][2];
    await expect(authorize({} as Transaction<Database>)).resolves.toEqual({
      userId: 'user-1',
    });
    expect(ensureUser).toHaveBeenCalledWith(principal, expect.anything());
  });

  it('does not accept or retain a token while provider delivery is disabled', () => {
    const execute = jest.fn();
    const service = makeService({} as DatabaseService, {
      enabled: false,
      idempotency: { execute } as unknown as IdempotencyService,
    });

    expect(() =>
      service.registerDevice(
        { firebaseUid: 'user' } as AuthenticatedPrincipal,
        'key',
        {
          installationId: '40000000-0000-4000-8000-000000000004',
          platform: 'ios',
          pushToken: 'ExponentPushToken[device-one]',
        },
      ),
    ).toThrow(ServiceUnavailableException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rotates one stable installation and clears conflicting and over-limit devices', async () => {
    const conflict = fluentQuery();
    conflict.executeTakeFirst = jest.fn().mockResolvedValue({
      id: 'conflicting-device',
      installation_id: '50000000-0000-4000-8000-000000000005',
      user_id: 'prior-user',
    });
    const enabled = fluentQuery();
    enabled.execute = jest
      .fn()
      .mockResolvedValue([
        { id: 'registered-device' },
        { id: 'device-2' },
        { id: 'device-3' },
        { id: 'device-4' },
        { id: 'device-5' },
        { id: 'oldest-device' },
      ]);
    const insert = fluentQuery();
    insert.onConflict.mockImplementation(
      (callback: (query: typeof insert) => unknown) => {
        callback(insert);
        return insert;
      },
    );
    insert.executeTakeFirstOrThrow = jest.fn().mockResolvedValue({
      enabled: true,
      id: 'registered-device',
      platform: 'ios',
      provider: 'expo',
    });
    const deviceUpdate = fluentQuery();
    deviceUpdate.executeTakeFirst = jest
      .fn()
      .mockResolvedValue({ id: 'disabled-device' });
    const updateTable = jest.fn(() => deviceUpdate);
    const transaction = {
      insertInto: jest.fn(() => insert),
      selectFrom: jest
        .fn()
        .mockReturnValueOnce(conflict)
        .mockReturnValueOnce(enabled),
      updateTable,
    } as unknown as Transaction<Database>;
    const execute = jest.fn(
      async (
        _options: unknown,
        handler: (
          transaction: Transaction<Database>,
          context: { userId: string },
        ) => Promise<unknown>,
      ) => handler(transaction, { userId: 'user-1' }),
    );
    const service = makeService({} as DatabaseService, {
      idempotency: { execute } as unknown as IdempotencyService,
    });

    await expect(
      service.registerDevice(
        { firebaseUid: 'firebase-user-1' } as AuthenticatedPrincipal,
        'registration-key',
        {
          installationId: '40000000-0000-4000-8000-000000000004',
          platform: 'ios',
          pushToken: 'ExponentPushToken[rotated-device]',
        },
      ),
    ).resolves.toEqual({
      enabled: true,
      id: 'registered-device',
      platform: 'ios',
      provider: 'expo',
    });
    expect(insert.columns).toHaveBeenCalledWith(['user_id', 'installation_id']);
    expect(insert.doUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        push_token: 'ExponentPushToken[rotated-device]',
      }),
    );
    expect(deviceUpdate.where).toHaveBeenCalledWith(
      'id',
      '=',
      'conflicting-device',
    );
    expect(deviceUpdate.where).toHaveBeenCalledWith('id', '=', 'oldest-device');
    expect(deviceUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, push_token: null }),
    );
    expect(updateTable).toHaveBeenCalledTimes(2);
  });

  it('disables only the authenticated owner row and minimizes its token', async () => {
    const update = fluentQuery();
    update.executeTakeFirst = jest.fn().mockResolvedValue({ id: 'device-1' });
    const transaction = { updateTable: jest.fn(() => update) };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (callback: (value: unknown) => Promise<unknown>) =>
            callback(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const ensureUser = jest.fn().mockResolvedValue({ id: 'user-1' });
    const service = makeService(database, {
      profiles: { ensureUser } as unknown as ProfilesService,
    });

    await service.disableDevice(
      { firebaseUid: 'firebase-user-1' } as AuthenticatedPrincipal,
      'device-1',
    );

    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, push_token: null }),
    );
    expect(update.where).toHaveBeenCalledWith('id', '=', 'device-1');
    expect(update.where).toHaveBeenCalledWith('user_id', '=', 'user-1');
  });
});

describe('NotificationsService delivery claims', () => {
  it('snapshots at most five current devices and consumes an attempt under a unique lease', async () => {
    const candidate = fluentQuery();
    candidate.executeTakeFirst = jest.fn().mockResolvedValue({
      id: 'delivery-1',
      target_device_ids: null,
      user_id: 'user-1',
    });
    const targets = fluentQuery();
    targets.execute = jest
      .fn()
      .mockResolvedValue([{ id: 'device-1' }, { id: 'device-2' }]);
    const claim = fluentQuery();
    claim.executeTakeFirstOrThrow = jest.fn().mockResolvedValue({
      ...delivery,
      target_device_ids: ['device-1', 'device-2'],
    });
    const transaction = {
      selectFrom: jest.fn((table: string) =>
        table === 'notification_deliveries' ? candidate : targets,
      ),
      updateTable: jest.fn(() => claim),
    };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (callback: (value: unknown) => Promise<unknown>) =>
            callback(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const service = makeService(database);

    const claimed = await (
      service as unknown as {
        claimNextDelivery(now: Date): Promise<typeof delivery | null>;
      }
    ).claimNextDelivery(new Date('2026-08-01T00:00:00.000Z'));

    expect(targets.limit).toHaveBeenCalledWith(5);
    expect(claim.set).toHaveBeenCalledWith({
      attempt_count: expect.any(Function),
      lease_expires_at: new Date('2026-08-01T00:00:30.000Z'),
      lease_token: expect.any(String),
      target_device_ids: ['device-1', 'device-2'],
      updated_at: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(claimed?.target_device_ids).toEqual(['device-1', 'device-2']);
    expect(candidate.forUpdate).toHaveBeenCalledTimes(1);
    expect(candidate.skipLocked).toHaveBeenCalledTimes(1);
  });

  it('fences completion, records per-device progress, and minimizes invalid tokens', async () => {
    const deliveryUpdate = fluentQuery();
    deliveryUpdate.executeTakeFirst = jest
      .fn()
      .mockResolvedValue({ id: 'delivery-1' });
    const deviceUpdate = fluentQuery();
    deviceUpdate.executeTakeFirst = jest
      .fn()
      .mockResolvedValue({ id: 'device-2' });
    const transaction = {
      updateTable: jest.fn((table: string) =>
        table === 'notification_deliveries' ? deliveryUpdate : deviceUpdate,
      ),
    };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (callback: (value: unknown) => Promise<unknown>) =>
            callback(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const service = makeService(database);

    await expect(
      (
        service as unknown as {
          recordDeliveryResults(
            item: typeof delivery,
            results: readonly unknown[],
            unavailable: readonly string[],
            failure: string | null,
          ): Promise<string>;
        }
      ).recordDeliveryResults(
        delivery,
        [
          {
            device: { id: 'device-1', push_token: 'token-one' },
            result: { status: 'accepted' },
          },
          {
            device: { id: 'device-2', push_token: 'token-two' },
            result: { status: 'invalid-token' },
          },
        ],
        [],
        null,
      ),
    ).resolves.toBe('sent');
    expect(deliveryUpdate.where).toHaveBeenCalledWith(
      'lease_token',
      '=',
      'lease-1',
    );
    expect(deliveryUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_device_ids: ['device-1', 'device-2'],
        delivered_count: 1,
        last_error: null,
        status: 'sent',
      }),
    );
    expect(deviceUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, push_token: null }),
    );
  });

  it('does not mutate a device after the delivery lease is lost', async () => {
    const deliveryUpdate = fluentQuery();
    deliveryUpdate.executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      updateTable: jest.fn(() => deliveryUpdate),
    };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (callback: (value: unknown) => Promise<unknown>) =>
            callback(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const service = makeService(database);

    await expect(
      (
        service as unknown as {
          recordDeliveryResults(
            item: typeof delivery,
            results: readonly unknown[],
            unavailable: readonly string[],
            failure: string | null,
          ): Promise<string>;
        }
      ).recordDeliveryResults(
        delivery,
        [
          {
            device: { id: 'device-2', push_token: 'token-two' },
            result: { status: 'invalid-token' },
          },
        ],
        ['device-1'],
        null,
      ),
    ).resolves.toBe('lost');
    expect(transaction.updateTable).toHaveBeenCalledTimes(1);
  });

  it('backs retryable failures off instead of reclaiming them immediately', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T00:00:10.000Z'));
    const deliveryUpdate = fluentQuery();
    deliveryUpdate.executeTakeFirst = jest
      .fn()
      .mockResolvedValue({ id: 'delivery-1' });
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (callback: (value: unknown) => Promise<unknown>) =>
            callback({ updateTable: jest.fn(() => deliveryUpdate) }),
        })),
      },
    } as unknown as DatabaseService;
    const service = makeService(database);

    await (
      service as unknown as {
        recordDeliveryResults(
          item: typeof delivery,
          results: readonly unknown[],
          unavailable: readonly string[],
          failure: string | null,
        ): Promise<string>;
      }
    ).recordDeliveryResults(delivery, [], [], 'PUSH_PROVIDER_UNAVAILABLE');

    expect(deliveryUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        last_error: 'PUSH_PROVIDER_UNAVAILABLE',
        scheduled_at: new Date('2026-08-01T00:01:10.000Z'),
        status: 'failed',
      }),
    );
    jest.useRealTimers();
  });
});

describe('NotificationsService enqueue', () => {
  it('suppresses duplicate user/event deliveries at the database boundary', async () => {
    const insert = fluentQuery();
    insert.onConflict.mockImplementation(
      (callback: (value: unknown) => unknown) => {
        callback(insert);
        return insert;
      },
    );
    insert.executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      insertInto: jest.fn(() => insert),
    } as unknown as Transaction<Database>;
    const service = makeService({} as DatabaseService);

    await service.enqueue(transaction, 'user-1', 'reward_awarded', {
      awardId: 'award-1',
    });

    expect(insert.columns).toHaveBeenCalledWith(['user_id', 'dedupe_key']);
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ dedupe_key: 'reward_awarded:award-1' }),
    );
  });
});

import { createHash } from 'node:crypto';
import type { DatabaseService } from '../../database/database.service';
import type { JsonObject } from '../../database/database.types';
import { IdempotencyService } from './idempotency.service';
import { stableJson } from './stable-json';

type TerminalValues = {
  execute?: unknown;
  executeTakeFirst?: unknown;
  executeTakeFirstOrThrow?: unknown;
};

function queryBuilder(terminals: TerminalValues = {}) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of [
    'columns',
    'deleteFrom',
    'doNothing',
    'onConflict',
    'returning',
    'selectAll',
    'set',
    'updateTable',
    'values',
    'where',
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.execute = jest.fn().mockResolvedValue(terminals.execute ?? []);
  builder.executeTakeFirst = jest
    .fn()
    .mockResolvedValue(terminals.executeTakeFirst);
  builder.executeTakeFirstOrThrow = jest
    .fn()
    .mockResolvedValue(terminals.executeTakeFirstOrThrow);
  return builder;
}

function createService(options: {
  existing?: Record<string, unknown>;
  reservation?: { id: string };
}) {
  const deletion = queryBuilder();
  const insertion = queryBuilder({ executeTakeFirst: options.reservation });
  const selection = queryBuilder({
    executeTakeFirstOrThrow: options.existing,
  });
  const update = queryBuilder({ executeTakeFirstOrThrow: { id: 'stored' } });
  const transaction = {
    deleteFrom: jest.fn(() => deletion),
    insertInto: jest.fn(() => insertion),
    selectFrom: jest.fn(() => selection),
    updateTable: jest.fn(() => update),
  };
  const database = {
    connection: {
      transaction: jest.fn(() => ({
        execute: (callback: (value: unknown) => Promise<unknown>) =>
          callback(transaction),
      })),
    },
  } as unknown as DatabaseService;

  return {
    service: new IdempotencyService(database),
    transaction,
    update,
  };
}

function requestHash(request: JsonObject): string {
  return createHash('sha256').update(stableJson(request)).digest('hex');
}

describe('IdempotencyService', () => {
  const request = { awardId: 'award-1' };
  const baseOptions = {
    actorKey: 'firebase:user-1',
    key: 'claim-1',
    request,
    scope: 'reward-awards:award-1:claim',
    storeResponseBody: false,
  } as const;

  it('stores a non-sensitive completion marker when the response is redacted', async () => {
    const { service, update } = createService({
      reservation: { id: 'reservation-1' },
    });
    const response = { couponCode: 'SECRET-CODE', id: 'award-1' };

    await expect(
      service.execute(baseOptions, () => Promise.resolve(response)),
    ).resolves.toEqual(response);

    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        response_body: { redacted: true },
        state: 'completed',
      }),
    );
    expect(update.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ response_body: response }),
    );
  });

  it('rebuilds a redacted response on an idempotent replay', async () => {
    const { service } = createService({
      existing: {
        request_hash: requestHash(request),
        response_body: { redacted: true },
        state: 'completed',
      },
    });
    const handler = jest.fn(() =>
      Promise.resolve({
        couponCode: 'SAME-SECRET-CODE',
        id: 'award-1',
      }),
    );

    await expect(service.execute(baseOptions, handler)).resolves.toEqual({
      couponCode: 'SAME-SECRET-CODE',
      id: 'award-1',
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns a stored ordinary response without rerunning the handler', async () => {
    const storedResponse = { id: 'request-1', status: 'accepted' };
    const { service } = createService({
      existing: {
        request_hash: requestHash(request),
        response_body: storedResponse,
        state: 'completed',
      },
    });
    const handler = jest.fn(() => Promise.resolve(storedResponse));

    await expect(
      service.execute({ ...baseOptions, storeResponseBody: true }, handler),
    ).resolves.toEqual(storedResponse);
    expect(handler).not.toHaveBeenCalled();
  });
});

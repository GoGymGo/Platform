import type { DatabaseService } from '../../database/database.service';
import { PartnerApplicationRetentionService } from './partner-application-retention.service';

describe('PartnerApplicationRetentionService', () => {
  it('deletes only bounded anonymous expired rows', async () => {
    const subquery = queryBuilder();
    const deletion = queryBuilder([{ id: 'one' }, { id: 'two' }]);
    deletion.where.mockImplementation(
      (_column: string, _operator: string, value: unknown) => {
        if (typeof value === 'function') {
          (value as (builder: typeof subquery) => unknown)(subquery);
        }
        return deletion;
      },
    );
    const transaction = {
      deleteFrom: jest.fn().mockReturnValue(deletion),
    };
    const database = {
      connection: {
        transaction: () => ({
          execute: (handler: (value: typeof transaction) => Promise<number>) =>
            handler(transaction),
        }),
      },
    } as unknown as DatabaseService;
    const service = new PartnerApplicationRetentionService(database);
    const now = new Date('2026-08-21T00:00:00.000Z');

    await expect(service.purgeExpired(25, now)).resolves.toBe(2);
    expect(transaction.deleteFrom).toHaveBeenCalledWith('partner_applications');
    expect(subquery.where).toHaveBeenCalledWith('user_id', 'is', null);
    expect(subquery.where).toHaveBeenCalledWith(
      'retention_expires_at',
      'is not',
      null,
    );
    expect(subquery.where).toHaveBeenCalledWith(
      'retention_expires_at',
      '<=',
      now,
    );
    expect(subquery.limit).toHaveBeenCalledWith(25);
  });

  it.each([0, 501, 1.5])('rejects an unsafe purge limit: %s', (limit) => {
    const service = new PartnerApplicationRetentionService(
      {} as DatabaseService,
    );
    expect(() => service.purgeExpired(limit)).toThrow(RangeError);
  });
});

function queryBuilder(result: unknown[] = []) {
  const builder = {
    deleteFrom: jest.fn(),
    execute: jest.fn().mockResolvedValue(result),
    limit: jest.fn(),
    orderBy: jest.fn(),
    returning: jest.fn(),
    select: jest.fn(),
    selectFrom: jest.fn(),
    where: jest.fn(),
  };
  for (const key of [
    'deleteFrom',
    'limit',
    'orderBy',
    'returning',
    'select',
    'selectFrom',
    'where',
  ] as const) {
    builder[key].mockReturnValue(builder);
  }
  return builder;
}

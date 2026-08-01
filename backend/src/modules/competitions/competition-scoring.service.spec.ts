import { DatabaseService } from '../../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { CompetitionScoringService } from './competition-scoring.service';

function createService() {
  const query = {
    execute: jest.fn().mockResolvedValue([]),
    innerJoin: jest.fn(),
    limit: jest.fn(),
    orderBy: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
  };
  query.innerJoin.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.where.mockReturnValue(query);
  const selectFrom = jest.fn().mockReturnValue(query);
  const database = {
    connection: { selectFrom },
  } as unknown as DatabaseService;

  return {
    query,
    selectFrom,
    service: new CompetitionScoringService(
      database,
      {} as unknown as LedgerService,
    ),
  };
}

describe('CompetitionScoringService', () => {
  it('does not cap the candidate query before scanning past settled competitions', async () => {
    const { query, service } = createService();

    await expect(service.processDuePeriods()).resolves.toBe(0);

    expect(query.limit).not.toHaveBeenCalled();
    expect(query.execute).toHaveBeenCalledTimes(1);
  });

  it('does not query when the settlement budget is exhausted', async () => {
    const { selectFrom, service } = createService();

    await expect(service.processDuePeriods(0)).resolves.toBe(0);

    expect(selectFrom).not.toHaveBeenCalled();
  });
});

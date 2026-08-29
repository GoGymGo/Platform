import type { DatabaseService } from '../../database/database.service';
import { AutomaticDrawSettlementService } from './automatic-draw-settlement.service';
import type { DrawsService } from './draws.service';

function createService(endsAt: Date) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['orderBy', 'select', 'where']) {
    query[method] = jest.fn(() => query);
  }
  query.execute = jest
    .fn()
    .mockResolvedValue([
      { ends_at: endsAt, id: 'competition-1', status: 'active' },
    ]);
  const transaction = {};
  const executeTransaction = jest.fn(
    (callback: (transaction: unknown) => Promise<unknown>) =>
      callback(transaction),
  );
  const database = {
    connection: {
      selectFrom: jest.fn(() => query),
      transaction: jest.fn(() => ({ execute: executeTransaction })),
    },
  } as unknown as DatabaseService;
  const lock = jest.fn().mockResolvedValue({ drawId: 'draw-1' });
  const settle = jest.fn().mockResolvedValue({
    drawId: 'draw-1',
    winnerCount: 1,
  });
  const service = new AutomaticDrawSettlementService(database, {
    lock,
    settle,
  } as unknown as DrawsService);
  return { lock, service, settle };
}

describe('AutomaticDrawSettlementService', () => {
  it('locks and settles each due Contest atomically with system audit ownership', async () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const { lock, service, settle } = createService(
      new Date('2026-08-28T11:44:59.000Z'),
    );

    await expect(service.processDueCompetitions(20, now)).resolves.toBe(1);
    expect(lock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        competitionId: 'competition-1',
        operatorUserId: null,
        requestId: 'automatic-draw-lock:competition-1',
        seedCommitment: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      now,
    );
    expect(settle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        drawId: 'draw-1',
        operatorUserId: null,
        requestId: 'automatic-draw-settle:competition-1',
        seedReveal: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      now,
    );
  });

  it('waits for the workout completion grace period', async () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const { lock, service } = createService(
      new Date('2026-08-28T11:50:00.000Z'),
    );

    await expect(service.processDueCompetitions(20, now)).resolves.toBe(0);
    expect(lock).not.toHaveBeenCalled();
  });
});

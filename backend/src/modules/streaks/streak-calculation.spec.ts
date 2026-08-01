import { calculateStreaks } from './streak-calculation';

describe('calculateStreaks', () => {
  it('returns zeroes when there are no verified gym logs', () => {
    expect(calculateStreaks([], '2026-07-15')).toEqual({
      daily: 0,
      monthly: 0,
      weekly: 0,
      yearly: 0,
    });
  });

  it('calculates each calendar interval independently', () => {
    expect(
      calculateStreaks(
        [
          '2026-07-15',
          '2026-07-14',
          '2026-07-13',
          '2026-07-07',
          '2026-06-30',
          '2026-06-22',
          '2026-05-20',
          '2026-04-18',
          '2025-12-20',
          '2024-12-20',
        ],
        '2026-07-15',
      ),
    ).toEqual({
      daily: 3,
      monthly: 4,
      weekly: 4,
      yearly: 3,
    });
  });

  it('keeps a streak active during the period immediately after its latest log', () => {
    expect(
      calculateStreaks(
        ['2026-07-14', '2026-07-13', '2026-07-12', '2026-07-05'],
        '2026-07-15',
      ),
    ).toEqual({
      daily: 3,
      monthly: 1,
      weekly: 3,
      yearly: 1,
    });
  });

  it('counts only one achievement when several logs share a period', () => {
    expect(
      calculateStreaks(
        ['2026-07-15', '2026-07-14', '2026-07-13'],
        '2026-07-15',
      ),
    ).toEqual({
      daily: 3,
      monthly: 1,
      weekly: 1,
      yearly: 1,
    });
  });

  it('uses Monday-based weeks across calendar-year boundaries', () => {
    expect(
      calculateStreaks(['2025-12-31', '2025-12-28'], '2026-01-01').weekly,
    ).toBe(2);
  });

  it('resets every interval whose latest log is stale', () => {
    expect(calculateStreaks(['2024-12-31'], '2026-07-15')).toEqual({
      daily: 0,
      monthly: 0,
      weekly: 0,
      yearly: 0,
    });
  });

  it('rejects invalid date keys', () => {
    expect(() => calculateStreaks(['2026-02-30'], '2026-07-15')).toThrow(
      'Unexpected database date key.',
    );
  });
});

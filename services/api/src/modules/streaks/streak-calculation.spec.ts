import { calculateStreaks } from './streak-calculation';
import { dateKeyInTimezone } from '../competitions/competition-calendar';

describe('calculateStreaks', () => {
  it('returns zeroes when there are no verified gym logs', () => {
    expect(calculateStreaks([], '2026-07-15')).toEqual({
      daily: 0,
      monthly: 0,
      projectionVersion: 'streaks-v1',
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
      projectionVersion: 'streaks-v1',
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
      projectionVersion: 'streaks-v1',
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
      projectionVersion: 'streaks-v1',
      weekly: 1,
      yearly: 1,
    });
  });

  it('uses Monday-based weeks across calendar-year boundaries', () => {
    expect(
      calculateStreaks(['2025-12-31', '2025-12-28'], '2026-01-01').weekly,
    ).toBe(2);
  });

  it('preserves consecutive local dates across the spring DST boundary', () => {
    const beforeShift = dateKeyInTimezone(
      new Date('2026-03-08T07:59:59.000Z'),
      'America/Vancouver',
    );
    const afterShift = dateKeyInTimezone(
      new Date('2026-03-08T10:00:00.000Z'),
      'America/Vancouver',
    );

    expect(beforeShift).toBe('2026-03-07');
    expect(afterShift).toBe('2026-03-08');
    expect(calculateStreaks([beforeShift, afterShift], afterShift).daily).toBe(
      2,
    );
  });

  it('deduplicates the repeated local hour at the fall DST boundary', () => {
    const firstHour = dateKeyInTimezone(
      new Date('2026-11-01T08:30:00.000Z'),
      'America/Vancouver',
    );
    const repeatedHour = dateKeyInTimezone(
      new Date('2026-11-01T09:30:00.000Z'),
      'America/Vancouver',
    );

    expect(firstHour).toBe('2026-11-01');
    expect(repeatedHour).toBe('2026-11-01');
    expect(
      calculateStreaks([firstHour, repeatedHour], repeatedHour).daily,
    ).toBe(1);
  });

  it('resets every interval whose latest log is stale', () => {
    expect(calculateStreaks(['2024-12-31'], '2026-07-15')).toEqual({
      daily: 0,
      monthly: 0,
      projectionVersion: 'streaks-v1',
      weekly: 0,
      yearly: 0,
    });
  });

  it('ignores future dates instead of letting them anchor a streak', () => {
    expect(
      calculateStreaks(
        ['2026-07-16', '2026-07-15', '2026-07-14'],
        '2026-07-15',
      ),
    ).toEqual({
      daily: 2,
      monthly: 1,
      projectionVersion: 'streaks-v1',
      weekly: 1,
      yearly: 1,
    });
  });

  it('rejects invalid date keys', () => {
    expect(() => calculateStreaks(['2026-02-30'], '2026-07-15')).toThrow(
      'Unexpected database date key.',
    );
  });
});

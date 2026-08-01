import {
  buildCompetitionPeriods,
  dateKeyInTimezone,
} from './competition-calendar';

describe('competition calendar', () => {
  it('builds four fixed seven-day periods', () => {
    expect(buildCompetitionPeriods('2026-07')).toEqual([
      { endDateKey: '2026-07-07', index: 1, startDateKey: '2026-07-01' },
      { endDateKey: '2026-07-14', index: 2, startDateKey: '2026-07-08' },
      { endDateKey: '2026-07-21', index: 3, startDateKey: '2026-07-15' },
      { endDateKey: '2026-07-28', index: 4, startDateKey: '2026-07-22' },
    ]);
  });

  it('uses the competition timezone instead of UTC for eligible dates', () => {
    expect(
      dateKeyInTimezone(
        new Date('2026-07-12T06:30:00.000Z'),
        'America/Vancouver',
      ),
    ).toBe('2026-07-11');
  });
});

import { automaticWeeklyMatchPeriod } from './automatic-weekly-matching.service';

describe('automaticWeeklyMatchPeriod', () => {
  it('assigns the current scoring week and does not pre-assign future weeks', () => {
    expect(automaticWeeklyMatchPeriod('2026-08', '2026-08-27')).toEqual({
      endDateKey: '2026-08-28',
      index: 4,
      startDateKey: '2026-08-22',
    });
  });

  it('queues the first week before the contest month and stops after week four', () => {
    expect(automaticWeeklyMatchPeriod('2026-09', '2026-08-28')?.index).toBe(1);
    expect(automaticWeeklyMatchPeriod('2026-08', '2026-08-29')).toBeNull();
  });
});

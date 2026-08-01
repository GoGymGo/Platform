import { socialChallengeDateWindow } from './social.service';

describe('social challenge query bounds', () => {
  it('covers only the earliest start through the latest end date', () => {
    expect(
      socialChallengeDateWindow([
        { end_date: '2026-08-14', start_date: '2026-08-08' },
        { end_date: '2026-09-30', start_date: '2026-09-01' },
        {
          end_date: new Date('2026-08-31T00:00:00.000Z'),
          start_date: new Date('2026-07-20T00:00:00.000Z'),
        },
      ]),
    ).toEqual({ endDate: '2026-09-30', startDate: '2026-07-20' });
  });

  it('returns no window when every requested challenge was filtered out', () => {
    expect(socialChallengeDateWindow([])).toBeNull();
  });
});

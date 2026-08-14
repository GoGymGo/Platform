import { canLockCompetitionDraw } from './draw-policy';

describe('draw lock policy', () => {
  const competitionEndsAt = new Date('2026-09-01T07:00:00.000Z');

  it('waits through the exact workout completion grace boundary', () => {
    expect(
      canLockCompetitionDraw({
        competitionEndsAt,
        competitionStatus: 'active',
        now: new Date('2026-09-01T07:14:59.999Z'),
      }),
    ).toBe(false);
    expect(
      canLockCompetitionDraw({
        competitionEndsAt,
        competitionStatus: 'active',
        now: new Date('2026-09-01T07:15:00.000Z'),
      }),
    ).toBe(true);
  });

  it('never reopens a non-active contest', () => {
    expect(
      canLockCompetitionDraw({
        competitionEndsAt,
        competitionStatus: 'settling',
        now: new Date('2026-09-01T08:00:00.000Z'),
      }),
    ).toBe(false);
  });
});

import {
  applyCategoryMultiplier,
  calculateWeeklyScore,
  competitionTieBreakDigest,
  longestConsecutiveDateStreak,
  rankCategoryStandings,
} from './competition-scoring';

describe('authoritative competition scoring', () => {
  it('removes the weekly entries when the goal is missed', () => {
    expect(
      calculateWeeklyScore({
        bothHitMultiplier: 2,
        entriesPerVerifiedDay: 1,
        goalDays: 3,
        opponentVerifiedDays: 3,
        recoveryMultiplier: 3,
        verifiedDays: 2,
      }),
    ).toEqual({
      entries: 0,
      goalMet: false,
      multiplier: 0,
      recovered: false,
    });
  });

  it('awards one settled point for a one-day goal at 1x', () => {
    expect(
      calculateWeeklyScore({
        bothHitMultiplier: 2,
        entriesPerVerifiedDay: 1,
        goalDays: 1,
        opponentVerifiedDays: null,
        recoveryMultiplier: 3,
        verifiedDays: 1,
      }),
    ).toEqual({
      entries: 1,
      goalMet: true,
      multiplier: 1,
      recovered: false,
    });
  });

  it('awards both-hit and recovery outcomes without inventing a partner', () => {
    const base = {
      bothHitMultiplier: 2,
      entriesPerVerifiedDay: 1,
      goalDays: 3,
      recoveryMultiplier: 3,
      verifiedDays: 4,
    };
    expect(
      calculateWeeklyScore({ ...base, opponentVerifiedDays: 3 }),
    ).toMatchObject({ entries: 6, multiplier: 2, recovered: false });
    expect(
      calculateWeeklyScore({ ...base, opponentVerifiedDays: 2 }),
    ).toMatchObject({ entries: 9, multiplier: 3, recovered: true });
    expect(
      calculateWeeklyScore({ ...base, opponentVerifiedDays: null }),
    ).toMatchObject({ entries: 3, multiplier: 1, recovered: false });
  });

  it('requires a verified extra workout for the 3x recovery result', () => {
    expect(
      calculateWeeklyScore({
        bothHitMultiplier: 2,
        entriesPerVerifiedDay: 1,
        goalDays: 4,
        opponentVerifiedDays: 2,
        recoveryMultiplier: 3,
        verifiedDays: 4,
      }),
    ).toMatchObject({ entries: 4, multiplier: 1, recovered: false });
  });

  it('uses deterministic category tie-breaks and integer draw weights', () => {
    const first = rankCategoryStandings('competition-1', 'rules-v1', [
      {
        categoryScore: 10,
        goalDays: 3,
        longestStreak: 4,
        userId: 'user-b',
        verifiedDays: 12,
      },
      {
        categoryScore: 10,
        goalDays: 3,
        longestStreak: 5,
        userId: 'user-a',
        verifiedDays: 11,
      },
    ]);
    const second = rankCategoryStandings(
      'competition-1',
      'rules-v1',
      [...first].reverse(),
    );

    expect(first.map(({ userId }) => userId)).toEqual(['user-a', 'user-b']);
    expect(second.map(({ userId }) => userId)).toEqual(['user-a', 'user-b']);
    expect(
      competitionTieBreakDigest('competition-1', 'rules-v1', 'user-a'),
    ).not.toBe(
      competitionTieBreakDigest('competition-1', 'rules-v2', 'user-a'),
    );
    expect(applyCategoryMultiplier(3, 1.5)).toBe(4);
  });

  it('calculates longest streaks from distinct verified dates', () => {
    expect(
      longestConsecutiveDateStreak([
        '2026-07-01',
        '2026-07-02',
        '2026-07-02',
        '2026-07-04',
        '2026-07-05',
        '2026-07-06',
      ]),
    ).toBe(3);
  });
});

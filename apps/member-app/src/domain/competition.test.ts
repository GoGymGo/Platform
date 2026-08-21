import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCompetitionCalendar,
  canLoadWeeklyChallengePairing,
  evaluateMonthlyCompetition,
  formatCompetitionOpeningDateTime,
  getCompetitionRankLabel,
  getCompetitionRegionDateKey,
  getCurrentWeekProgress,
  getWeeklyChallengeDisplayStatus,
  hasCompetitionStarted,
  isCompetitionBonusDay,
  type CompetitionMatch,
  type CompetitionPeriodIndex
} from './competition';
import {
  buildCompetitionReminders,
  toCompetitionReminderDate
} from './competitionReminders';

describe('monthly competition scoring', () => {
  it('formats the exact location-check opening time in the Contest region', () => {
    assert.equal(
      formatCompetitionOpeningDateTime(
        '2026-09-01T07:00:00.000Z',
        'America/Vancouver'
      ),
      'September 1, 2026 at 12:00 a.m. PDT'
    );
    assert.equal(
      formatCompetitionOpeningDateTime(
        '2026-09-01T07:00:30.000Z',
        'America/Vancouver'
      ),
      'September 1, 2026 at 12:00:30 a.m. PDT'
    );
  });

  it('opens workouts at the exact admin-configured instant', () => {
    const startsAt = '2026-08-13T00:06:30.000Z';

    assert.equal(
      hasCompetitionStarted(startsAt, Date.parse('2026-08-13T00:06:29.999Z')),
      false
    );
    assert.equal(
      hasCompetitionStarted(startsAt, Date.parse('2026-08-13T00:06:30.000Z')),
      true
    );
    assert.equal(hasCompetitionStarted('not-a-date'), false);
  });

  it('creates four seven-day periods and separate leftover bonus days', () => {
    const calendar = buildCompetitionCalendar('2026-07');

    assert.deepEqual(
      calendar.periods.map((period) => [period.startDateKey, period.endDateKey]),
      [
        ['2026-07-01', '2026-07-07'],
        ['2026-07-08', '2026-07-14'],
        ['2026-07-15', '2026-07-21'],
        ['2026-07-22', '2026-07-28']
      ]
    );
    assert.deepEqual(calendar.bonusDateKeys, [
      '2026-07-29',
      '2026-07-30',
      '2026-07-31'
    ]);
  });

  it('tracks the current calendar week when the registered competition starts later', () => {
    assert.deepEqual(
      getCurrentWeekProgress('2026-07-11', [
        '2026-06-30',
        '2026-07-10',
        '2026-07-10'
      ]),
      { index: 2, verifiedCount: 1 }
    );
    assert.deepEqual(
      getCurrentWeekProgress('2026-07-29', ['2026-07-29']),
      { index: null, verifiedCount: 0 }
    );
  });

  it('awards 2x period results and includes remainder days in the perfect-month 10x', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: createMatches(4, 4),
      referenceDateKey: '2026-08-01',
      userVerifiedDateKeys: [
        ...periodDates(1, 4),
        ...periodDates(2, 4),
        ...periodDates(3, 4),
        ...periodDates(4, 4),
        '2026-07-29',
        '2026-07-30',
        '2026-07-31'
      ],
      weeklyGoal: 4
    });

    assert.equal(result.periodEntriesBeforePerfectMonth, 32);
    assert.equal(result.perfectMonthMultiplier, 10);
    assert.equal(result.bonusDayEntries, 12);
    assert.equal(result.totalCompetitionEntries, 440);
  });

  it('awards the selected weekly goal for every completed remainder day', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-04',
      matches: createSoloPeriods(7),
      referenceDateKey: '2026-05-01',
      userVerifiedDateKeys: [
        ...periodDates(1, 7, '2026-04'),
        ...periodDates(2, 7, '2026-04'),
        ...periodDates(3, 7, '2026-04'),
        ...periodDates(4, 7, '2026-04'),
        '2026-04-29',
        '2026-04-30'
      ],
      weeklyGoal: 7
    });

    assert.equal(result.bonusDayEntries, 14);
    assert.equal(result.perfectMonthMultiplier, 10);
    assert.equal(result.totalCompetitionEntries, 420);
  });

  it('awards only successful periods and removes 10x when one period is missed', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: createSoloPeriods(4).map((match) =>
        match.periodIndex === 3 ? { ...match, entries: 0, multiplier: 0 as const } : match
      ),
      referenceDateKey: '2026-08-01',
      userVerifiedDateKeys: [
        ...periodDates(1, 4),
        ...periodDates(2, 4),
        ...periodDates(3, 3),
        ...periodDates(4, 4)
      ],
      weeklyGoal: 4
    });

    assert.deepEqual(result.periodResults.map((period) => period.entries), [4, 4, 0, 4]);
    assert.equal(result.perfectMonthAchieved, false);
    assert.equal(result.totalCompetitionEntries, 12);
  });

  it('awards 3x when the user completes an extra workout and their match fails', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: [createMatch(1, 3, 12, 3)],
      referenceDateKey: '2026-07-08',
      userVerifiedDateKeys: periodDates(1, 5),
      weeklyGoal: 4
    });

    assert.equal(result.periodResults[0].finalMultiplier, 3);
    assert.equal(result.periodResults[0].entries, 12);
  });

  it('does not project 3x without an eligible extra workout day', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: [createMatch(1, 6, 7, 1)],
      referenceDateKey: '2026-07-08',
      userVerifiedDateKeys: periodDates(1, 7),
      weeklyGoal: 7
    });

    assert.equal(result.periodResults[0].bonusWorkoutCompleted, false);
    assert.equal(result.periodResults[0].finalMultiplier, 1);
    assert.equal(result.periodResults[0].entries, 7);
  });

  it('shows live multiplier progress but banks entries only after the period closes', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: [createMatch(1, 4, 8, 2, 'projected')],
      referenceDateKey: '2026-07-05',
      userVerifiedDateKeys: periodDates(1, 4),
      weeklyGoal: 4
    });

    assert.equal(result.currentPeriod?.liveMultiplier, 2);
    assert.equal(result.currentPeriod?.entries, 0);
    assert.equal(result.totalCompetitionEntries, 0);
  });

  it('updates the cumulative category score with weekly multipliers after week one settles', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: [
        createMatch(1, 4, 8, 2),
        createMatch(2, 4, 8, 2, 'projected')
      ],
      referenceDateKey: '2026-07-10',
      userVerifiedDateKeys: [
        ...periodDates(1, 4),
        '2026-07-08',
        '2026-07-09',
        '2026-07-10'
      ],
      weeklyGoal: 4
    });

    assert.equal(result.periodResults[0].status, 'settled');
    assert.equal(result.periodResults[0].finalMultiplier, 2);
    assert.equal(result.periodResults[0].entries, 8);
    assert.equal(result.periodResults[1].status, 'in-progress');
    assert.equal(result.periodResults[1].entries, 0);
    assert.equal(result.periodEntriesBeforePerfectMonth, 8);
  });

  it('scores a reduced late-registration goal from the registration day', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      eligibleFromDateKey: '2026-07-03',
      matches: createSoloPeriods(5),
      perfectMonthEligible: true,
      referenceDateKey: '2026-08-01',
      userVerifiedDateKeys: [
        '2026-07-01',
        '2026-07-02',
        '2026-07-03',
        '2026-07-04',
        '2026-07-05',
        '2026-07-06',
        '2026-07-07',
        ...periodDates(2, 5),
        ...periodDates(3, 5),
        ...periodDates(4, 5)
      ],
      weeklyGoal: 5
    });

    assert.deepEqual(
      result.periodResults.map((period) => period.status),
      ['settled', 'settled', 'settled', 'settled']
    );
    assert.equal(result.periodResults[0].userVerifiedCount, 5);
    assert.equal(result.perfectMonthEligible, true);
    assert.equal(result.perfectMonthAchieved, true);
    assert.equal(result.totalCompetitionEntries, 200);
  });

  it('does not award 3x to a late entrant without an eligible extra workout', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      eligibleFromDateKey: '2026-07-03',
      matches: [createMatch(1, 4, 5, 1)],
      referenceDateKey: '2026-07-08',
      userVerifiedDateKeys: [
        '2026-07-03',
        '2026-07-04',
        '2026-07-05',
        '2026-07-06',
        '2026-07-07'
      ],
      weeklyGoal: 5
    });

    assert.equal(result.periodResults[0].bonusWorkoutCompleted, false);
    assert.equal(result.periodResults[0].finalMultiplier, 1);
    assert.equal(result.periodResults[0].entries, 5);
  });

  it('does not create bonus days in a 28-day month', () => {
    assert.deepEqual(buildCompetitionCalendar('2026-02').bonusDateKeys, []);
    assert.equal(isCompetitionBonusDay('2026-02-28'), false);
  });

  it('uses the competition region timezone for scoring dates', () => {
    assert.equal(
      getCompetitionRegionDateKey(
        new Date('2026-07-10T03:30:00.000Z'),
        'America/Toronto'
      ),
      '2026-07-09'
    );
  });

  it('builds progress reminders and universal bonus-day reminders', () => {
    const reminders = buildCompetitionReminders({
      competitionMonthKey: '2026-07',
      referenceDateKey: '2026-07-27',
      userVerifiedDateKeys: ['2026-07-22', '2026-07-23', '2026-07-24'],
      weeklyGoal: 4
    });

    assert.deepEqual(
      reminders.map((reminder) => [reminder.dateKey, reminder.kind]),
      [
        ['2026-07-27', 'weekly-goal'],
        ['2026-07-28', 'weekly-goal'],
        ['2026-07-28', 'weekly-challenge'],
        ['2026-07-29', 'bonus-day'],
        ['2026-07-30', 'bonus-day'],
        ['2026-07-31', 'bonus-day']
      ]
    );
  });

  it('resolves the declared Contest timezone across daylight-saving changes', () => {
    assert.equal(
      toCompetitionReminderDate(
        { dateKey: '2026-07-27', localTime: '18:00' },
        'America/Toronto'
      ).toISOString(),
      '2026-07-27T22:00:00.000Z'
    );
    assert.equal(
      toCompetitionReminderDate(
        { dateKey: '2026-11-27', localTime: '18:00' },
        'America/Toronto'
      ).toISOString(),
      '2026-11-27T23:00:00.000Z'
    );
  });
});

describe('competition clarity labels', () => {
  it('shows a precise rank state', () => {
    assert.equal(
      getCompetitionRankLabel({
        competitionNotStarted: true,
        hasSettledWeek: false
      }),
      'PENDING FIRST WEEK'
    );
    assert.equal(
      getCompetitionRankLabel({
        competitionNotStarted: false,
        hasSettledWeek: true,
        rank: 2
      }),
      '#2'
    );
    assert.equal(
      getCompetitionRankLabel({
        competitionNotStarted: false,
        hasSettledWeek: true
      }),
      'UPDATING'
    );
  });

  it('prioritizes the next Weekly Challenge action', () => {
    assert.equal(
      getWeeklyChallengeDisplayStatus({
        hasFeaturedPartner: true,
        hasIncomingRequest: true,
        isRemainderDayPhase: false
      }),
      'INVITE WAITING'
    );
    assert.equal(
      getWeeklyChallengeDisplayStatus({
        activeAvailability: 'matched',
        hasFeaturedPartner: true,
        hasIncomingRequest: true,
        isRemainderDayPhase: false
      }),
      'IN PROGRESS'
    );
    assert.equal(
      getWeeklyChallengeDisplayStatus({
        hasFeaturedPartner: true,
        hasIncomingRequest: false,
        isRemainderDayPhase: false
      }),
      'CHOOSE PARTNER'
    );
    assert.equal(
      getWeeklyChallengeDisplayStatus({
        hasFeaturedPartner: true,
        hasIncomingRequest: true,
        isRemainderDayPhase: true
      }),
      'COMPLETE'
    );
  });

  it('loads Weekly Challenge pairing only during an active scoring period', () => {
    assert.equal(
      canLoadWeeklyChallengePairing({
        hasCurrentPeriod: false,
        phase: 'before-month'
      }),
      false
    );
    assert.equal(
      canLoadWeeklyChallengePairing({
        hasCurrentPeriod: true,
        phase: 'scoring-period'
      }),
      true
    );
    assert.equal(
      canLoadWeeklyChallengePairing({
        hasCurrentPeriod: false,
        phase: 'scoring-period'
      }),
      false
    );
    assert.equal(
      canLoadWeeklyChallengePairing({
        hasCurrentPeriod: true,
        phase: 'bonus-days'
      }),
      false
    );
  });
});

function createMatches(goal: number, opponentCompleted: number) {
  return ([1, 2, 3, 4] as const).map((periodIndex) =>
    createMatch(periodIndex, Math.min(goal, opponentCompleted), goal * 2, 2)
  );
}

function createSoloPeriods(goal = 4): readonly CompetitionMatch[] {
  return ([1, 2, 3, 4] as const).map((periodIndex) => ({
    availability: 'solo',
    entries: goal,
    multiplier: 1,
    opponentAlias: null,
    opponentBestStreak: 0,
    opponentCurrentStreak: 0,
    opponentMonthlyVerifiedDays: 0,
    opponentStreaks: {
      daily: 0,
      monthly: 0,
      projectionVersion: 'streaks-v1',
      weekly: 0,
      yearly: 0
    },
    opponentVerifiedCount: 0,
    periodIndex,
    region: 'TORONTO',
    scoringStatus: 'settled'
  }));
}

function createMatch(
  periodIndex: CompetitionPeriodIndex,
  opponentCompleted: number,
  entries = 8,
  multiplier: 0 | 1 | 2 | 3 = 2,
  scoringStatus: 'projected' | 'settled' = 'settled'
): CompetitionMatch {
  return {
    availability: 'matched',
    entries,
    multiplier,
    opponentAlias: 'TEST_MATCH',
    opponentBestStreak: opponentCompleted,
    opponentCurrentStreak: opponentCompleted,
    opponentMonthlyVerifiedDays: opponentCompleted,
    opponentStreaks: {
      daily: opponentCompleted,
      monthly: opponentCompleted > 0 ? 1 : 0,
      projectionVersion: 'streaks-v1',
      weekly: opponentCompleted > 0 ? 1 : 0,
      yearly: opponentCompleted > 0 ? 1 : 0
    },
    opponentVerifiedCount: opponentCompleted,
    periodIndex,
    region: 'TORONTO',
    scoringStatus
  };
}

function periodDates(
  periodIndex: CompetitionPeriodIndex,
  count: number,
  monthKey = '2026-07'
) {
  const startDay = (periodIndex - 1) * 7 + 1;

  return Array.from(
    { length: count },
    (_, index) => `${monthKey}-${String(startDay + index).padStart(2, '0')}`
  );
}

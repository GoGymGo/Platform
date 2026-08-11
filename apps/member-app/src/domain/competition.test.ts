import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCompetitionCalendar,
  evaluateMonthlyCompetition,
  formatCompetitionOpeningDateTime,
  getCompetitionRankLabel,
  getCompetitionRegionDateKey,
  getCurrentWeekProgress,
  getWeeklyChallengeDisplayStatus,
  isCompetitionBonusDay,
  type CompetitionMatch,
  type CompetitionPeriodIndex
} from './competition';
import { buildCompetitionReminders } from './competitionReminders';

describe('monthly competition scoring', () => {
  it('formats the exact location-check opening time in the Contest region', () => {
    assert.equal(
      formatCompetitionOpeningDateTime(
        '2026-09-01T07:00:00.000Z',
        'America/Vancouver'
      ),
      'September 1, 2026 at 12:00 a.m. PDT'
    );
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
      matches: createSoloPeriods(),
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
      matches: createSoloPeriods(),
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
      matches: [createMatch(1, 3)],
      referenceDateKey: '2026-07-08',
      userVerifiedDateKeys: periodDates(1, 5),
      weeklyGoal: 4
    });

    assert.equal(result.periodResults[0].finalMultiplier, 3);
    assert.equal(result.periodResults[0].entries, 12);
  });

  it('awards the seven-day category automatic 3x when its match fails', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: [createMatch(1, 6)],
      referenceDateKey: '2026-07-08',
      userVerifiedDateKeys: periodDates(1, 7),
      weeklyGoal: 7
    });

    assert.equal(result.periodResults[0].bonusWorkoutCompleted, true);
    assert.equal(result.periodResults[0].finalMultiplier, 3);
    assert.equal(result.periodResults[0].entries, 21);
  });

  it('shows live multiplier progress but banks entries only after the period closes', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      matches: [createMatch(1, 4)],
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
      matches: [createMatch(1, 4), createMatch(2, 4)],
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
      matches: createSoloPeriods(),
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

  it('automatically awards 3x when a late entrant fills every remaining first-week day', () => {
    const result = evaluateMonthlyCompetition({
      competitionMonthKey: '2026-07',
      eligibleFromDateKey: '2026-07-03',
      matches: [createMatch(1, 4)],
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

    assert.equal(result.periodResults[0].bonusWorkoutCompleted, true);
    assert.equal(result.periodResults[0].finalMultiplier, 3);
    assert.equal(result.periodResults[0].entries, 15);
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
        ['2026-07-27', 'period-progress'],
        ['2026-07-28', 'period-progress'],
        ['2026-07-29', 'bonus-day'],
        ['2026-07-30', 'bonus-day'],
        ['2026-07-31', 'bonus-day']
      ]
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
});

function createMatches(goal: number, opponentCompleted: number) {
  return ([1, 2, 3, 4] as const).map((periodIndex) =>
    createMatch(periodIndex, Math.min(goal, opponentCompleted))
  );
}

function createSoloPeriods(): readonly CompetitionMatch[] {
  return ([1, 2, 3, 4] as const).map((periodIndex) => ({
    availability: 'solo',
    opponentAlias: 'SOLO MODE',
    opponentVerifiedDateKeys: [],
    periodIndex,
    region: 'TORONTO'
  }));
}

function createMatch(
  periodIndex: CompetitionPeriodIndex,
  opponentCompleted: number
): CompetitionMatch {
  return {
    availability: 'matched',
    opponentAlias: 'TEST_MATCH',
    opponentVerifiedDateKeys: periodDates(periodIndex, opponentCompleted),
    periodIndex,
    region: 'TORONTO'
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

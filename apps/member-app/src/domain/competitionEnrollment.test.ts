import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCompetitionEnrollmentSummary,
  evaluateCompetitionEnrollment,
  getCompetitionDateRange,
  getCompetitionEntryStartDateKey,
  getNextCompetitionMonthKey,
  getRegistrationGoalLimit,
  getRegistrationGoalOptions
} from './competitionEnrollment';

const enrollmentPolicy = { maximumEntrants: null, minimumEntrants: 2 } as const;

describe('competition enrollment', () => {
  it('builds the complete competition window', () => {
    const july = buildCompetitionEnrollmentSummary('2026-07', enrollmentPolicy);
    const february = buildCompetitionEnrollmentSummary('2028-02', enrollmentPolicy);

    assert.equal(july.competitionStartDateKey, '2026-07-01');
    assert.equal(july.competitionEndDateKey, '2026-07-31');
    assert.equal(february.competitionStartDateKey, '2028-02-01');
    assert.equal(february.competitionEndDateKey, '2028-02-29');
  });

  it('keeps a published competition joinable before and throughout its active month', () => {
    const summary = buildCompetitionEnrollmentSummary('2026-07', enrollmentPolicy);

    for (const dateKey of ['2026-05-01', '2026-06-30', '2026-07-01', '2026-07-31']) {
      assert.equal(
        evaluateCompetitionEnrollment(summary, 99, dateKey).registrationOpen,
        true,
        `Expected registration to remain open on ${dateKey}`
      );
    }

    assert.equal(
      evaluateCompetitionEnrollment(summary, 99, '2026-08-01').registrationOpen,
      false
    );
  });

  it('confirms launch at the two-entrant pilot minimum without closing enrollment', () => {
    const summary = buildCompetitionEnrollmentSummary('2026-07', enrollmentPolicy);
    const status = evaluateCompetitionEnrollment(summary, 2, '2026-07-20');

    assert.equal(status.launchConfirmed, true);
    assert.equal(status.phase, 'competition-active');
    assert.equal(status.registrationOpen, true);
  });

  it('supports an optional sponsor-advised entrant cap', () => {
    const summary = buildCompetitionEnrollmentSummary('2026-07', {
      maximumEntrants: 2_500,
      minimumEntrants: 2
    });
    const status = evaluateCompetitionEnrollment(summary, 2_500, '2026-07-20');

    assert.equal(status.phase, 'full');
    assert.equal(status.atCapacity, true);
    assert.equal(status.registrationOpen, false);
    assert.equal(status.spotsRemaining, 0);
  });

  it('starts entrants on the competition start or their enrollment date', () => {
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-06-30'),
      '2026-07-01'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-01'),
      '2026-07-01'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-07'),
      '2026-07-07'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-31'),
      '2026-07-31'
    );
  });

  it('offers every configured goal throughout a published competition', () => {
    for (const dateKey of ['2026-06-01', '2026-07-01', '2026-07-20', '2026-07-31']) {
      assert.equal(getRegistrationGoalLimit('2026-07', dateKey), 7);
      assert.deepEqual(
        getRegistrationGoalOptions('2026-07', dateKey),
        [1, 2, 3, 4, 5, 6, 7]
      );
    }
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-08-01'), 0);
    assert.deepEqual(getRegistrationGoalOptions('2026-07', '2026-08-01'), []);
  });

  it('builds the next competition month and complete date range', () => {
    assert.equal(getNextCompetitionMonthKey('2026-07'), '2026-08');
    assert.equal(getNextCompetitionMonthKey('2026-12'), '2027-01');
    assert.deepEqual(getCompetitionDateRange('2026-08'), {
      startDateKey: '2026-08-01',
      endDateKey: '2026-08-31'
    });
  });

  it('rejects a launch minimum below two entrants', () => {
    assert.throws(
      () =>
        buildCompetitionEnrollmentSummary('2026-07', {
          maximumEntrants: null,
          minimumEntrants: 1
        }),
      /at least 2/i
    );
  });

  it('rejects a sponsor-advised cap below the launch minimum', () => {
    assert.throws(
      () =>
        buildCompetitionEnrollmentSummary('2026-07', {
          maximumEntrants: 1,
          minimumEntrants: 2
        }),
      /cap must be at least/i
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCompetitionEnrollmentSummary,
  evaluateCompetitionEnrollment,
  getCompetitionDateRange,
  getCompetitionEntryStartDateKey,
  getRegistrationGoalLimit,
  getRegistrationGoalOptions,
  getRegistrationTargetCompetitionMonthKey,
  isLateCompetitionRegistration,
  getNextCompetitionMonthKey
} from './competitionEnrollment';

const enrollmentPolicy = { maximumEntrants: null, minimumEntrants: 100 } as const;

describe('competition enrollment', () => {
  it('opens registration for the complete calendar month before competition', () => {
    const july = buildCompetitionEnrollmentSummary('2026-07', enrollmentPolicy);
    const january = buildCompetitionEnrollmentSummary('2027-01', enrollmentPolicy);

    assert.equal(july.registrationStartDateKey, '2026-06-01');
    assert.equal(july.registrationEndDateKey, '2026-06-30');
    assert.equal(july.lateRegistrationEndDateKey, '2026-07-06');
    assert.equal(january.registrationStartDateKey, '2026-12-01');
    assert.equal(january.registrationEndDateKey, '2026-12-31');
  });

  it('does not launch below 100 entrants and confirms launch at 100', () => {
    const summary = buildCompetitionEnrollmentSummary('2026-07', enrollmentPolicy);

    assert.equal(
      evaluateCompetitionEnrollment(summary, 99, '2026-07-01').phase,
      'cancelled'
    );
    assert.equal(
      evaluateCompetitionEnrollment(summary, 100, '2026-07-01').phase,
      'competition-active'
    );
  });

  it('keeps late registration open only through the conclusion of day 6', () => {
    const summary = buildCompetitionEnrollmentSummary('2026-07', enrollmentPolicy);
    const openStatus = evaluateCompetitionEnrollment(summary, 100, '2026-07-06');
    const closedStatus = evaluateCompetitionEnrollment(summary, 100, '2026-07-07');

    assert.equal(openStatus.phase, 'competition-active');
    assert.equal(openStatus.lateRegistration, true);
    assert.equal(openStatus.registrationOpen, true);
    assert.equal(closedStatus.phase, 'competition-active');
    assert.equal(closedStatus.lateRegistration, false);
    assert.equal(closedStatus.registrationOpen, false);
  });

  it('supports an optional sponsor-advised entrant cap', () => {
    const summary = buildCompetitionEnrollmentSummary('2026-07', {
      maximumEntrants: 2_500,
      minimumEntrants: 100
    });
    const status = evaluateCompetitionEnrollment(summary, 2_500, '2026-07-04');

    assert.equal(status.phase, 'full');
    assert.equal(status.atCapacity, true);
    assert.equal(status.registrationOpen, false);
    assert.equal(status.spotsRemaining, 0);
  });

  it('starts eligible late entrants on their registration date', () => {
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-06-30'),
      '2026-07-01'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-01'),
      '2026-07-01'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-02'),
      '2026-07-02'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-06'),
      '2026-07-06'
    );
    assert.equal(
      getCompetitionEntryStartDateKey('2026-07', '2026-07-07'),
      '2026-08-01'
    );
  });

  it('returns the only late-registration goal from days left in scoring week 1', () => {
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-06-30'), 7);
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-07-01'), 7);
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-07-02'), 6);
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-07-03'), 5);
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-07-06'), 2);
    assert.equal(getRegistrationGoalLimit('2026-07', '2026-07-07'), 0);
    assert.equal(isLateCompetitionRegistration('2026-07', '2026-07-01'), true);
    assert.equal(isLateCompetitionRegistration('2026-07', '2026-07-06'), true);
    assert.equal(isLateCompetitionRegistration('2026-07', '2026-07-07'), false);
    assert.deepEqual(
      getRegistrationGoalOptions('2026-07', '2026-06-30'),
      [1, 2, 3, 4, 5, 6, 7]
    );
    assert.deepEqual(getRegistrationGoalOptions('2026-07', '2026-07-02'), [6]);
    assert.deepEqual(getRegistrationGoalOptions('2026-07', '2026-07-03'), [5]);
    assert.deepEqual(getRegistrationGoalOptions('2026-07', '2026-07-06'), [2]);
    assert.deepEqual(getRegistrationGoalOptions('2026-07', '2026-07-07'), []);
  });

  it('targets the active month through day 6 and the next month afterward', () => {
    assert.equal(getRegistrationTargetCompetitionMonthKey('2026-07-01'), '2026-07');
    assert.equal(getRegistrationTargetCompetitionMonthKey('2026-07-06'), '2026-07');
    assert.equal(getRegistrationTargetCompetitionMonthKey('2026-07-07'), '2026-08');
    assert.equal(getRegistrationTargetCompetitionMonthKey('2026-12-31'), '2027-01');
  });

  it('builds the next competition month and complete date range', () => {
    assert.equal(getNextCompetitionMonthKey('2026-07'), '2026-08');
    assert.equal(getNextCompetitionMonthKey('2026-12'), '2027-01');
    assert.deepEqual(getCompetitionDateRange('2026-08'), {
      startDateKey: '2026-08-01',
      endDateKey: '2026-08-31'
    });
  });

  it('rejects a launch minimum below 100 entrants', () => {
    assert.throws(
      () =>
        buildCompetitionEnrollmentSummary(
          '2026-07',
          { maximumEntrants: null, minimumEntrants: 99 }
        ),
      /at least 100/i
    );
  });

  it('rejects a sponsor-advised cap below the launch minimum', () => {
    assert.throws(
      () =>
        buildCompetitionEnrollmentSummary('2026-07', {
          maximumEntrants: 99,
          minimumEntrants: 100
        }),
      /cap must be at least/i
    );
  });
});

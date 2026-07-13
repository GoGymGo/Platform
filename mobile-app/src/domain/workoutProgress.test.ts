import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCalendarDays,
  calculateBestStreak,
  calculateCurrentStreak,
  evaluateSessionCompletion,
  getAverageHeartRateBpm,
  getMidSessionGraceSecondsRemaining,
  getRandomMidSessionCheckSecond,
  getSessionElapsedSeconds,
  parseStoredActiveWorkoutSession,
  parseStoredWorkoutLogs,
  sanitizeManualDuration,
  toDateKey,
  type WorkoutLog
} from './workoutProgress';

const referenceDate = new Date(2026, 6, 9, 12, 0, 0);

describe('workout progress calculations', () => {
  it('uses local calendar dates without UTC drift', () => {
    assert.equal(toDateKey(referenceDate), '2026-07-09');
  });

  it('hydrates only valid persisted workout logs', () => {
    const validLog = createLog('verified', '2026-07-09');
    const invalidLog = { ...validLog, source: 'imported' };

    assert.deepEqual(
      parseStoredWorkoutLogs(JSON.stringify([validLog, invalidLog])),
      [validLog]
    );
    assert.deepEqual(parseStoredWorkoutLogs('{not-json'), []);
  });

  it('hydrates only a complete active workout session', () => {
    const activeSession = {
      averageHeartRateBpm: 118,
      dateKey: '2026-07-09',
      heartRateObservedSeconds: 120,
      heartRateTotalBpmSeconds: 14160,
      id: 'session-1',
      lastHeartRateSampleElapsedSeconds: 120,
      midSessionCheckAtSeconds: 900,
      midSessionCheckPrompted: false,
      midSessionCheckPromptedAt: null,
      midSessionVerified: false,
      startedAt: '2026-07-09T18:00:00.000Z',
      verificationMethod: 'heartRate'
    } as const;

    assert.deepEqual(
      parseStoredActiveWorkoutSession(JSON.stringify(activeSession)),
      activeSession
    );
    assert.equal(
      parseStoredActiveWorkoutSession(JSON.stringify({ ...activeSession, id: '' })),
      null
    );
    assert.equal(parseStoredActiveWorkoutSession('{not-json'), null);
  });

  it('calculates current and best streaks from unique dates', () => {
    const dates = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'];

    assert.equal(calculateCurrentStreak(dates, referenceDate), 4);
    assert.equal(calculateBestStreak([...dates, '2026-07-01']), 4);
  });

  it('keeps a current streak alive when today has not been logged yet', () => {
    assert.equal(
      calculateCurrentStreak(['2026-07-07', '2026-07-08'], referenceDate),
      2
    );
  });

  it('builds a stable 42-day calendar and prefers verified status', () => {
    const logs: readonly WorkoutLog[] = [
      createLog('manual', '2026-07-09'),
      createLog('verified', '2026-07-09')
    ];
    const days = buildCalendarDays(referenceDate, logs);
    const today = days.find((day) => day.dateKey === '2026-07-09');

    assert.equal(days.length, 42);
    assert.deepEqual(
      today && { isToday: today.isToday, status: today.status },
      { isToday: true, status: 'verified' }
    );
  });

  it('derives elapsed session time from the real clock', () => {
    const startedAt = new Date(2026, 6, 9, 11, 59, 50).toISOString();

    assert.equal(getSessionElapsedSeconds(startedAt, referenceDate), 10);
  });

  it('places the automatic face check inside the configured middle window', () => {
    assert.equal(getRandomMidSessionCheckSecond(0), 600);
    assert.equal(getRandomMidSessionCheckSecond(0.5), 900);
    assert.equal(getRandomMidSessionCheckSecond(1), 1200);
    assert.equal(getRandomMidSessionCheckSecond(Number.NaN), 900);
  });

  it('keeps the automatic face-check grace period stable across navigation', () => {
    const promptedAt = new Date(2026, 6, 9, 11, 58, 30).toISOString();

    assert.equal(getMidSessionGraceSecondsRemaining(promptedAt, referenceDate), 30);
    assert.equal(
      getMidSessionGraceSecondsRemaining(
        promptedAt,
        new Date(2026, 6, 9, 12, 0, 30)
      ),
      0
    );
    assert.equal(getMidSessionGraceSecondsRemaining(null, referenceDate), 0);
  });

  it('calculates a duration-weighted session heart-rate average', () => {
    assert.equal(getAverageHeartRateBpm(180_000, 1800), 100);
    assert.equal(getAverageHeartRateBpm(238_500, 1800), 133);
    assert.equal(getAverageHeartRateBpm(0, 0), 0);
  });

  it('blocks completion until the active session passes every frontend guard', () => {
    const startedAt = new Date(2026, 6, 9, 11, 30, 0).toISOString();
    const baseSession = {
      averageHeartRateBpm: 128,
      dateKey: '2026-07-09',
      heartRateObservedSeconds: 1800,
      midSessionVerified: true,
      startedAt,
      verificationMethod: 'heartRate' as const
    };

    assert.equal(evaluateSessionCompletion(null, [], referenceDate), 'no-active-session');
    assert.equal(
      evaluateSessionCompletion(
        { ...baseSession, midSessionVerified: false },
        [],
        referenceDate
      ),
      'missing-mid-session-check'
    );
    assert.equal(
      evaluateSessionCompletion(
        { ...baseSession, startedAt: new Date(2026, 6, 9, 11, 59, 0).toISOString() },
        [],
        referenceDate
      ),
      'minimum-not-met'
    );
    assert.equal(
      evaluateSessionCompletion(baseSession, [], referenceDate),
      'completed'
    );
    assert.equal(
      evaluateSessionCompletion(
        { ...baseSession, averageHeartRateBpm: 99 },
        [],
        referenceDate
      ),
      'heart-rate-target-not-met'
    );
    assert.equal(
      evaluateSessionCompletion(
        { ...baseSession, heartRateObservedSeconds: 1799 },
        [],
        referenceDate
      ),
      'heart-rate-target-not-met'
    );
    assert.equal(
      evaluateSessionCompletion(
        {
          ...baseSession,
          averageHeartRateBpm: 0,
          heartRateObservedSeconds: 0,
          verificationMethod: 'partnerGymQr'
        },
        [],
        referenceDate
      ),
      'completed'
    );
    assert.equal(
      evaluateSessionCompletion(
        baseSession,
        [createLog('verified', '2026-07-09')],
        referenceDate
      ),
      'already-verified'
    );
  });

  it('clamps invalid manual workout durations', () => {
    assert.equal(sanitizeManualDuration(0), 1);
    assert.equal(sanitizeManualDuration(45.6), 46);
    assert.equal(sanitizeManualDuration(5000), 1440);
  });
});

function createLog(source: WorkoutLog['source'], dateKey: string): WorkoutLog {
  return {
    createdAt: `${dateKey}T12:00:00.000Z`,
    dateKey,
    durationMinutes: 30,
    entriesEarned: source === 'verified' ? 10 : 0,
    exercises: 'Test workout',
    id: `${source}-${dateKey}`,
    source,
    title: 'Test workout'
  };
}

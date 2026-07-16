import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildChallengeMonthWindow,
  normalizeChallengeName,
  normalizeChallengeInput,
  normalizeScreenName,
  validateChallengeInput,
  validateChallengeName,
  validateScreenName
} from '@/domain/social';

describe('social input rules', () => {
  it('keeps searchable aliases portable and predictable', () => {
    assert.equal(normalizeScreenName('  GHOST_RUNNER  '), 'GHOST_RUNNER');
    assert.equal(validateScreenName('GHOST_RUNNER'), null);
    assert.match(validateScreenName('ghost runner') ?? '', /underscores/i);
    assert.match(validateScreenName('ab') ?? '', /3-24/i);
  });

  it('normalizes named challenges without changing their words', () => {
    assert.equal(
      normalizeChallengeName('  July   Strength\nSprint  '),
      'July Strength Sprint'
    );
    assert.equal(validateChallengeName('July Strength Sprint'), null);
    assert.match(validateChallengeName('   ') ?? '', /enter/i);
  });

  it('validates a structured four-times-per-week friend challenge', () => {
    const input = normalizeChallengeInput({
      activity: 'gym',
      activityLabel: '  Gym   visits ',
      challengeType: 'friend',
      endDate: '2026-07-31',
      invitedFriendUserIds: ['friend-1', 'friend-1'],
      name: '  July   4x Gym Crew ',
      scheduledDays: [],
      startDate: '2026-07-01',
      targetCount: 4,
      targetPeriod: 'weekly'
    });

    assert.equal(validateChallengeInput(input), null);
    assert.equal(input.name, 'July 4x Gym Crew');
    assert.equal(input.activityLabel, 'Gym visits');
    assert.deepEqual(input.invitedFriendUserIds, ['friend-1']);
  });

  it('allows a private challenge to start from an external contact invitation', () => {
    const input = {
      activity: 'gym' as const,
      activityLabel: 'Gym visits',
      challengeType: 'friend' as const,
      endDate: '2026-07-31',
      invitedFriendUserIds: [],
      name: 'July Phone Crew',
      scheduledDays: [],
      startDate: '2026-07-01',
      targetCount: 4,
      targetPeriod: 'weekly' as const
    };

    assert.match(validateChallengeInput(input) ?? '', /email address or phone/i);
    assert.equal(validateChallengeInput(input, 1), null);
  });

  it('requires complete regional schedule details', () => {
    const base = {
      activity: 'running' as const,
      activityLabel: 'Group runs',
      challengeType: 'regional' as const,
      endDate: '2026-07-31',
      invitedFriendUserIds: [],
      locationName: 'Waterfront Trail',
      name: 'Waterfront Run Series',
      regionCode: 'TORONTO',
      scheduledDays: [] as number[],
      scheduledTime: '18:30',
      startDate: '2026-07-01',
      targetCount: 8,
      targetPeriod: 'monthly' as const
    };

    assert.match(validateChallengeInput(base) ?? '', /scheduled day/i);
    assert.equal(validateChallengeInput({ ...base, scheduledDays: [2, 4] }), null);
  });

  it('builds calendar-month windows without UTC date drift', () => {
    const window = buildChallengeMonthWindow(new Date(2026, 6, 15), 1);

    assert.equal(window.startDate, '2026-08-01');
    assert.equal(window.endDate, '2026-08-31');
    assert.match(window.label, /August 2026/i);
  });
});

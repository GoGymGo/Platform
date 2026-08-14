import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildChallengeMonthWindow,
  buildChallengeWindow,
  normalizeChallengeName,
  normalizeChallengeInput,
  normalizeScreenName,
  validateChallengeInput,
  validateChallengeName,
  validateScreenName,
} from '@/domain/social';

describe('social input rules', () => {
  it('keeps searchable aliases portable and predictable', () => {
    assert.equal(normalizeScreenName('  ghost_runner  '), 'GHOST_RUNNER');
    assert.equal(normalizeScreenName('  GHOST_RUNNER  '), 'GHOST_RUNNER');
    assert.equal(validateScreenName('GHOST_RUNNER'), null);
    assert.match(validateScreenName('ghost runner') ?? '', /ASCII/i);
    assert.match(validateScreenName('ab') ?? '', /3-24/i);
    assert.match(validateScreenName('SUPPORT_TEAM') ?? '', /reserved/i);
    assert.match(validateScreenName('GG_ABCDEF123456') ?? '', /reserved/i);
    assert.match(validateScreenName('NÓVA') ?? '', /ASCII/i);
  });

  it('normalizes named challenges without changing their words', () => {
    assert.equal(
      normalizeChallengeName('  July   Strength\nSprint  '),
      'July Strength Sprint',
    );
    assert.equal(validateChallengeName('July Strength Sprint'), null);
    assert.match(validateChallengeName('   ') ?? '', /enter/i);
  });

  it('validates a structured four-times-per-week friend challenge', () => {
    const input = normalizeChallengeInput({
      activity: 'gym',
      activityLabel: '  Gym   visits ',
      challengeType: 'friend',
      endDate: '2090-07-31',
      invitedFriendUserIds: ['friend-1', 'friend-1'],
      name: '  July   4x Gym Crew ',
      scheduledDays: [],
      startDate: '2090-07-01',
      targetCount: 4,
      targetPeriod: 'weekly',
      timezone: 'America/Vancouver',
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
      endDate: '2090-07-31',
      invitedFriendUserIds: [],
      name: 'July Phone Crew',
      scheduledDays: [],
      startDate: '2090-07-01',
      targetCount: 4,
      targetPeriod: 'weekly' as const,
      timezone: 'America/Vancouver',
    };

    assert.match(
      validateChallengeInput(input) ?? '',
      /email address or phone/i,
    );
    assert.equal(validateChallengeInput(input, 1), null);
  });

  it('requires complete regional schedule details', () => {
    const base = {
      activity: 'running' as const,
      activityLabel: 'Group runs',
      challengeType: 'regional' as const,
      endDate: '2090-07-31',
      invitedFriendUserIds: [],
      locationName: 'Waterfront Trail',
      name: 'Waterfront Run Series',
      regionCode: 'toronto-on',
      scheduledDays: [] as number[],
      scheduledTime: '18:30',
      startDate: '2090-07-01',
      targetCount: 8,
      targetPeriod: 'monthly' as const,
    };

    assert.match(validateChallengeInput(base) ?? '', /scheduled day/i);
    assert.equal(
      validateChallengeInput({ ...base, scheduledDays: [2, 4] }),
      null,
    );
  });

  it('builds calendar-month windows without UTC date drift', () => {
    const window = buildChallengeMonthWindow(new Date(2026, 6, 15), 1);

    assert.equal(window.startDate, '2026-08-01');
    assert.equal(window.endDate, '2026-08-31');
    assert.match(window.label, /August 2026/i);
  });

  it('builds a bounded current-day window and rejects invalid calendar dates', () => {
    assert.deepEqual(buildChallengeWindow(new Date(2090, 6, 15), 31), {
      endDate: '2090-08-14',
      startDate: '2090-07-15',
    });
    const base = {
      activity: 'walking' as const,
      activityLabel: 'Walking',
      challengeType: 'friend' as const,
      endDate: '2090-08-14',
      invitedContacts: [
        { channel: 'email' as const, destination: 'friend@example.test' },
      ],
      invitedFriendUserIds: [],
      name: 'Future Walk',
      scheduledDays: [] as number[],
      startDate: '2090-07-15',
      targetCount: 31,
      targetPeriod: 'weekly' as const,
      timezone: 'America/Vancouver',
    };
    assert.equal(validateChallengeInput(base), null);
    assert.match(
      validateChallengeInput({ ...base, endDate: '2090-08-15' }) ?? '',
      /1 and 31 days/i,
    );
    assert.match(
      validateChallengeInput({ ...base, startDate: '2090-02-30' }) ?? '',
      /1 and 31 days/i,
    );
  });
});

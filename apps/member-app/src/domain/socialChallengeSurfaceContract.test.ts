import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

test('Challenge public models omit internal owner and member identifiers', () => {
  const domain = source('src/domain/social.ts');
  const memberContract = domain.slice(
    domain.indexOf('export type SocialChallengeMember'),
    domain.indexOf('export type SocialChallenge =')
  );
  const challengeContract = domain.slice(
    domain.indexOf('export type SocialChallenge ='),
    domain.indexOf('export type CreateSocialChallengeInput')
  );

  assert.equal(memberContract.includes('userId'), false);
  assert.equal(challengeContract.includes('ownerUserId'), false);
  for (const marker of [
    'canCancel',
    'canCheckIn',
    'canInvite',
    'canJoin',
    'canRespond',
    'canWithdraw',
    "state: 'active' | 'cancelled' | 'ended' | 'full' | 'upcoming'"
  ]) {
    assert.ok(challengeContract.includes(marker), `missing ${marker}`);
  }
});

test('Challenge creation keeps contact links atomic and provider-free', () => {
  const component = source('src/components/socialChallenges.tsx');
  const screen = source('app/(tabs)/squad/social.tsx');

  assert.ok(component.includes('invitedContacts: challengeType'));
  assert.ok(component.includes('timezone: challengeType'));
  assert.ok(screen.includes('createChallenge.mutateAsync(input)'));
  assert.ok(screen.includes('challenge.contactInvitations'));
  assert.equal(screen.includes('inviteContact.mutateAsync'), false);
  assert.ok(screen.includes('GoGymGo did not send it.'));
});

test('Challenge controls expose accessible and honest lifecycle states', () => {
  const component = source('src/components/socialChallenges.tsx');
  const screen = source('app/(tabs)/squad/social.tsx');

  for (const marker of [
    'accessibilityRole="tablist"',
    'accessibilityRole="checkbox"',
    'accessibilityRole="radio"',
    'accessibilityState={{ checked: selected, disabled }}',
    'accessibilityLabel={`${label}. ${subtitle}`}',
    'accessibilityValue={{ max: 100, min: 0, now: boundedPercent }}',
    'aria-selected={selected}',
    'aria-valuenow={boundedPercent}',
    'CHALLENGE FULL',
    'CHALLENGE ENDED',
    'CHALLENGE CANCELLED',
    'LEAVE CHALLENGE',
    'CANCEL CHALLENGE',
    'REGION UNAVAILABLE'
  ]) {
    assert.ok(component.includes(marker), `missing ${marker}`);
  }
  for (const marker of [
    '<RecoverableError',
    'COULD NOT LOAD SOCIAL DATA',
    'Loading friends and challenges...',
    'Refreshing friends and challenges...',
    'RETRY SHARE',
    'cancelChallenge.isPending',
    'withdrawFromChallenge.isPending'
  ]) {
    assert.ok(screen.includes(marker), `missing ${marker}`);
  }
  assert.ok(screen.includes('aria-selected={selected}'));
});

test('Challenge mutations and App Tour fixtures stay on explicit repositories', () => {
  const repository = source('src/data/socialRepository.ts');
  const appTour = source('src/testing/appTourData.ts');

  assert.ok(repository.includes('/v1/social/challenges/${encodeURIComponent(challengeId)}'));
  assert.ok(repository.includes('members/me'));
  assert.ok(appTour.includes('joinUrl:'));
  assert.ok(appTour.includes("deliveryStatus: 'not_sent'"));
  assert.ok(appTour.includes('cancelChallenge: async'));
  assert.ok(appTour.includes('withdrawFromChallenge: async'));
});

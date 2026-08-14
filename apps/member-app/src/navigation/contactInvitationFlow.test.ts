import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contactInvitationAuthRoute,
  contactInvitationFromNext,
  contactInvitationNext,
  contactInvitationReviewRoute,
} from './contactInvitationFlow';

test('preserves an opaque invitation token across verification and auth routes', () => {
  const token = 'opaque-token-without-contact-data';

  assert.equal(contactInvitationNext(token), `challenge:${token}`);
  assert.equal(contactInvitationFromNext(contactInvitationNext(token)), token);
  assert.deepEqual(contactInvitationAuthRoute('/sign-in', token), {
    pathname: '/sign-in',
    params: { challengeInvite: token },
  });
  assert.deepEqual(contactInvitationReviewRoute(token), {
    pathname: '/join',
    params: { challengeInvite: token },
  });
});

test('rejects missing and empty invitation continuations', () => {
  assert.equal(contactInvitationFromNext(undefined), null);
  assert.equal(contactInvitationFromNext('home'), null);
  assert.equal(contactInvitationFromNext('challenge:'), null);
});

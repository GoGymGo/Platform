import { ConflictException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { socialInvitationHash } from './social-contact';
import { requireInvitationDestinationHash } from './social-invitation-contact';

const principal: AuthenticatedPrincipal = {
  email: 'friend@example.com',
  emailVerified: true,
  firebaseUid: 'friend',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describe('contact invitation destination binding', () => {
  it('binds email redemption to the verified signed-in address', () => {
    expect(
      requireInvitationDestinationHash(
        principal,
        'email',
        'opaque-token',
        'attacker@example.com',
      ),
    ).toBe(socialInvitationHash('opaque-token:friend@example.com'));
  });

  it('requires explicit phone confirmation when auth has no phone claim', () => {
    expect(
      requireInvitationDestinationHash(
        principal,
        'phone',
        'opaque-token',
        '+1 (250) 555-0199',
      ),
    ).toBe(socialInvitationHash('opaque-token:+12505550199'));
    expect(() =>
      requireInvitationDestinationHash(principal, 'phone', 'opaque-token'),
    ).toThrow(ConflictException);
  });
});

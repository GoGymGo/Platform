import { ConflictException } from '@nestjs/common';
import type { DatabaseService } from '../../database/database.service';
import { ProfilesService } from './profiles.service';

describe('profile eligibility', () => {
  const profiles: ProfilesService = new ProfilesService({} as DatabaseService);

  it('accepts an account only when both email and verification are present', () => {
    expect(() =>
      profiles.requireVerifiedEmail({
        email: 'verified@example.test',
        email_verified: true,
      }),
    ).not.toThrow();
  });

  it.each([
    { email: null, email_verified: true },
    { email: 'unverified@example.test', email_verified: false },
  ])('rejects an ineligible identity with a stable error', (user) => {
    expect.assertions(2);
    try {
      profiles.requireVerifiedEmail(user);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'VERIFIED_EMAIL_REQUIRED',
      });
    }
  });
});

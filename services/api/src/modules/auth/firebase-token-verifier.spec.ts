import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import { FirebaseTokenVerifier } from './firebase-token-verifier';

describe('FirebaseTokenVerifier', () => {
  const config = {} as ConfigService<Environment, true>;

  it('checks revocation and derives the principal only from Firebase claims', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      email: 'member@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
      iat: 123,
      uid: 'firebase-member',
    });
    const verifier = new FirebaseTokenVerifier(config, () =>
      Promise.resolve({ verifyIdToken }),
    );

    await expect(verifier.verifyIdToken('firebase-token')).resolves.toEqual({
      email: 'member@example.com',
      emailVerified: true,
      firebaseUid: 'firebase-member',
      roles: ['user'],
      signInProvider: 'password',
      tokenIssuedAt: 123,
    });
    expect(verifyIdToken).toHaveBeenCalledWith('firebase-token', true);
  });

  it.each([
    'auth/id-token-revoked',
    'auth/user-disabled',
    'auth/id-token-expired',
    'auth/argument-error',
  ])('fails closed when Firebase rejects %s', async (code) => {
    const firebaseError = Object.assign(new Error('Rejected identity.'), {
      code,
    });
    const verifyIdToken = jest.fn().mockRejectedValue(firebaseError);
    const verifier = new FirebaseTokenVerifier(config, () =>
      Promise.resolve({ verifyIdToken }),
    );

    await expect(verifier.verifyIdToken('rejected-token')).rejects.toBe(
      firebaseError,
    );
    expect(verifyIdToken).toHaveBeenCalledWith('rejected-token', true);
  });
});

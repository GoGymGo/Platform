import { authenticatedPrincipalFromDecodedToken } from './firebase-token-principal';

describe('authenticatedPrincipalFromDecodedToken', () => {
  it('preserves the verified Firebase sign-in provider for authorization', () => {
    expect(
      authenticatedPrincipalFromDecodedToken({
        email: 'operator@gogymgo.com',
        email_verified: true,
        firebase: { sign_in_provider: 'password' },
        iat: 123,
        roles: ['admin', 42, null],
        uid: 'firebase-operator',
      }),
    ).toEqual({
      email: 'operator@gogymgo.com',
      emailVerified: true,
      firebaseUid: 'firebase-operator',
      roles: ['admin'],
      signInProvider: 'password',
      tokenIssuedAt: 123,
    });
  });

  it('fails closed when Firebase does not provide a usable provider', () => {
    expect(
      authenticatedPrincipalFromDecodedToken({
        email_verified: false,
        firebase: { sign_in_provider: null },
        iat: 456,
        uid: 'firebase-user',
      }),
    ).toEqual({
      emailVerified: false,
      firebaseUid: 'firebase-user',
      roles: ['user'],
      signInProvider: null,
      tokenIssuedAt: 456,
    });
  });
});

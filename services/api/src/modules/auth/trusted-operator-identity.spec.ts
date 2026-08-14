import { assertTrustedFirebaseOperatorIdentity } from './trusted-operator-identity';

const passwordIdentity = {
  disabled: false,
  email: 'operator@example.com',
  emailVerified: true,
  providerData: [{ providerId: 'password' }],
  uid: 'firebase-operator',
};

describe('assertTrustedFirebaseOperatorIdentity', () => {
  it('accepts only the exact enabled and verified password identity', () => {
    expect(() =>
      assertTrustedFirebaseOperatorIdentity(passwordIdentity, {
        email: 'OPERATOR@example.com',
        firebaseUid: 'firebase-operator',
      }),
    ).not.toThrow();
  });

  it.each([
    ['disabled', { disabled: true }],
    ['unverified', { emailVerified: false }],
    ['different email', { email: 'other@example.com' }],
    ['different uid', { uid: 'other-firebase-user' }],
    ['social-only', { providerData: [{ providerId: 'google.com' }] }],
  ])('rejects a %s Firebase identity', (_name, override) => {
    expect(() =>
      assertTrustedFirebaseOperatorIdentity(
        { ...passwordIdentity, ...override },
        {
          email: 'operator@example.com',
          firebaseUid: 'firebase-operator',
        },
      ),
    ).toThrow(/matching enabled, verified Firebase password account/);
  });
});

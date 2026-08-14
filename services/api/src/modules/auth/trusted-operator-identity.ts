export type TrustedFirebaseOperatorIdentity = {
  disabled: boolean;
  email?: string;
  emailVerified: boolean;
  providerData: { providerId: string }[];
  uid: string;
};

export function assertTrustedFirebaseOperatorIdentity(
  identity: TrustedFirebaseOperatorIdentity,
  expected: { email: string; firebaseUid: string },
): void {
  const expectedEmail = expected.email.trim().toLowerCase();
  const firebaseEmail = identity.email?.trim().toLowerCase();
  if (
    identity.uid !== expected.firebaseUid ||
    firebaseEmail !== expectedEmail ||
    identity.disabled ||
    !identity.emailVerified ||
    !identity.providerData.some(
      (provider) => provider.providerId === 'password',
    )
  ) {
    throw new Error(
      'The operator must be the matching enabled, verified Firebase password account.',
    );
  }
}

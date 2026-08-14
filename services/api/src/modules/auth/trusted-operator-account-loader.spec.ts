import { loadTrustedFirebaseOperatorAccount } from './trusted-operator-account-loader';

const expected = {
  email: 'operator@example.com',
  firebaseUid: 'firebase-operator',
};

describe('loadTrustedFirebaseOperatorAccount', () => {
  it('validates the exact identity returned by the trusted loader', async () => {
    const loadIdentity = jest.fn().mockResolvedValue({
      disabled: false,
      email: expected.email,
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
      uid: expected.firebaseUid,
    });

    await expect(
      loadTrustedFirebaseOperatorAccount(expected, loadIdentity),
    ).resolves.toBeUndefined();
    expect(loadIdentity).toHaveBeenCalledWith(expected.firebaseUid);
  });

  it('redacts provider and credential errors from trusted command output', async () => {
    const loadIdentity = jest
      .fn()
      .mockRejectedValue(
        new Error('private_key=secret Firebase response for operator@example'),
      );

    const error = await loadTrustedFirebaseOperatorAccount(
      expected,
      loadIdentity,
    ).catch((caught: unknown) => caught);
    expect(error).toEqual(
      new Error(
        'The exact enabled, verified Firebase password operator could not be confirmed.',
      ),
    );
    expect(String(error)).not.toMatch(/private_key|operator@example/);
  });
});

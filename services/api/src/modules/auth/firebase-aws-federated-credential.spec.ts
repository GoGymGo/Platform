import type { AwsClientOptions } from 'google-auth-library';
import {
  createFirebaseAwsFederatedCredential,
  isFirebaseAwsFederationConfig,
  type FirebaseAwsFederationConfig,
} from './firebase-aws-federated-credential';

const validConfig: FirebaseAwsFederationConfig = {
  audience:
    '//iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/gogymgo-staging/providers/gogymgo-aws',
  service_account_impersonation_url:
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/gogymgo-staging%40gogymgo-8cb8b.iam.gserviceaccount.com:generateAccessToken',
  subject_token_type: 'urn:ietf:params:aws:token-type:aws4_request',
  token_url: 'https://sts.googleapis.com/v1/token',
  type: 'external_account',
};

describe('Firebase AWS federated credential', () => {
  it('recognizes external-account credential configurations', () => {
    expect(isFirebaseAwsFederationConfig(validConfig)).toBe(true);
    expect(isFirebaseAwsFederationConfig({ type: 'service_account' })).toBe(
      false,
    );
  });

  it('maps short-lived ECS role credentials into the Google AWS supplier', async () => {
    let clientOptions: AwsClientOptions | undefined;
    const now = 1_800_000_000_000;
    const credential = createFirebaseAwsFederatedCredential(
      validConfig,
      'gogymgo-8cb8b',
      'ca-central-1',
      {
        createAwsClient: (options) => {
          clientOptions = options;
          return {
            credentials: { expiry_date: now + 3_600_000 },
            getAccessToken: () =>
              Promise.resolve({ token: 'federated-access-token' }),
          };
        },
        getAwsCredentials: () =>
          Promise.resolve({
            accessKeyId: 'temporary-access-key',
            secretAccessKey: 'temporary-secret-key',
            sessionToken: 'temporary-session-token',
          }),
        now: () => now,
      },
    );

    expect(clientOptions).toBeDefined();
    await expect(
      clientOptions?.aws_security_credentials_supplier?.getAwsRegion({
        audience: validConfig.audience,
        subjectTokenType: validConfig.subject_token_type,
        transporter: {} as never,
      }),
    ).resolves.toBe('ca-central-1');
    await expect(
      clientOptions?.aws_security_credentials_supplier?.getAwsSecurityCredentials(
        {
          audience: validConfig.audience,
          subjectTokenType: validConfig.subject_token_type,
          transporter: {} as never,
        },
      ),
    ).resolves.toEqual({
      accessKeyId: 'temporary-access-key',
      secretAccessKey: 'temporary-secret-key',
      token: 'temporary-session-token',
    });
    await expect(credential.getAccessToken()).resolves.toEqual({
      access_token: 'federated-access-token',
      expires_in: 3_600,
    });
  });

  it.each([
    {
      ...validConfig,
      audience: '//iam.googleapis.com/projects/not-a-number/pools/unsafe',
    },
    { ...validConfig, token_url: 'https://attacker.example/token' },
    {
      ...validConfig,
      service_account_impersonation_url:
        'https://attacker.example/v1/projects/-/serviceAccounts/unsafe:generateAccessToken',
    },
    {
      ...validConfig,
      service_account_impersonation_url:
        'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/unsafe%40another-project.iam.gserviceaccount.com:generateAccessToken',
    },
  ])('rejects unsafe credential configuration %#', (config) => {
    expect(() =>
      createFirebaseAwsFederatedCredential(
        config as FirebaseAwsFederationConfig,
        'gogymgo-8cb8b',
        'ca-central-1',
      ),
    ).toThrow();
  });

  it('rejects expired Google access tokens', async () => {
    const now = 1_800_000_000_000;
    const credential = createFirebaseAwsFederatedCredential(
      validConfig,
      'gogymgo-8cb8b',
      'ca-central-1',
      {
        createAwsClient: () => ({
          credentials: { expiry_date: now - 1 },
          getAccessToken: () => Promise.resolve({ token: 'expired-token' }),
        }),
        now: () => now,
      },
    );

    await expect(credential.getAccessToken()).rejects.toThrow(
      'did not return a valid access token',
    );
  });
});

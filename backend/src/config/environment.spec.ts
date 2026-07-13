import { validateEnvironment } from './environment';

describe('environment validation', () => {
  it('normalizes safe local defaults', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      AUTH_MODE: 'test',
      HYPERWALLET_PORTAL_URL: '',
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.OPENAPI_ENABLED).toBe(true);
    expect(environment.DATABASE_URL).toContain('localhost:5432');
    expect(environment.HYPERWALLET_ENABLED).toBe(false);
    expect(environment.PRIVACY_OPERATIONS_ENABLED).toBe(false);
    expect(environment.PRIVACY_EXPORT_RETENTION_DAYS).toBe(7);
    expect(environment.HYPERWALLET_API_URL).toBe(
      'https://uat-api.paylution.com/rest/v4',
    );
  });

  it('rejects test authentication in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        AUTH_MODE: 'test',
        FIREBASE_PROJECT_ID: 'gogymgo-production',
      }),
    ).toThrow(/AUTH_MODE must be firebase/i);
  });

  it('requires a Firebase project in production', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production', AUTH_MODE: 'firebase' }),
    ).toThrow(/FIREBASE_PROJECT_ID is required/i);
  });

  it('requires every server-side Hyperwallet setting when payouts are enabled', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        AUTH_MODE: 'test',
        HYPERWALLET_ENABLED: 'true',
      }),
    ).toThrow(/HYPERWALLET_PORTAL_URL is required/i);
  });

  it('requires Firebase, a private bucket, and a pseudonymization key for privacy execution', () => {
    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        PRIVACY_OPERATIONS_ENABLED: 'true',
      }),
    ).toThrow(/AUTH_MODE must be firebase/i);

    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'firebase',
        NODE_ENV: 'test',
        PRIVACY_OPERATIONS_ENABLED: 'true',
      }),
    ).toThrow(/PRIVACY_EXPORT_BUCKET is required/i);

    expect(
      validateEnvironment({
        AUTH_MODE: 'firebase',
        NODE_ENV: 'test',
        PRIVACY_EXPORT_BUCKET: 'private-exports',
        PRIVACY_OPERATIONS_ENABLED: 'true',
        PRIVACY_PSEUDONYMIZATION_KEY: 'k'.repeat(32),
      }).PRIVACY_OPERATIONS_ENABLED,
    ).toBe(true);
  });
});

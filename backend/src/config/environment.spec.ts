import { validateEnvironment } from './environment';

describe('environment validation', () => {
  it('normalizes safe local defaults', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      AUTH_MODE: 'test',
      HYPERWALLET_PORTAL_URL: '',
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.RUNTIME_ROLE).toBe('api');
    expect(environment.OPENAPI_ENABLED).toBe(true);
    expect(environment.DATABASE_URL).toContain('localhost:5432');
    expect(environment.HYPERWALLET_ENABLED).toBe(false);
    expect(environment.PRIVACY_OPERATIONS_ENABLED).toBe(false);
    expect(environment.PRIVACY_EXPORT_RETENTION_DAYS).toBe(7);
    expect(environment.OTEL_ENABLED).toBe(false);
    expect(environment.WORKER_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(environment.HYPERWALLET_API_URL).toBe(
      'https://uat-api.paylution.com/rest/v4',
    );
  });

  it('requires an OTLP endpoint and service name when telemetry is enabled', () => {
    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        OTEL_ENABLED: 'true',
      }),
    ).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT is required/i);

    expect(
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        OTEL_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_SERVICE_NAME: 'gogymgo-test',
      }).OTEL_ENABLED,
    ).toBe(true);
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

  it('does not expose API-only webhook secrets to the worker', () => {
    expect(
      validateEnvironment({
        AUTH_MODE: 'test',
        HYPERWALLET_ENABLED: 'true',
        HYPERWALLET_PASSWORD: 'password',
        HYPERWALLET_PORTAL_URL: 'https://payee.example.com',
        HYPERWALLET_PROGRAM_TOKEN: 'program-token',
        HYPERWALLET_USERNAME: 'username',
        NODE_ENV: 'test',
        RUNTIME_ROLE: 'worker',
      }).HYPERWALLET_ENABLED,
    ).toBe(true);
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
      }).PRIVACY_OPERATIONS_ENABLED,
    ).toBe(true);

    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'firebase',
        NODE_ENV: 'test',
        PRIVACY_EXPORT_BUCKET: 'private-exports',
        PRIVACY_OPERATIONS_ENABLED: 'true',
        RUNTIME_ROLE: 'worker',
      }),
    ).toThrow(/PRIVACY_PSEUDONYMIZATION_KEY is required by the worker/i);
  });

  it('requires the Expo access token only in the sending worker', () => {
    expect(
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        PUSH_NOTIFICATIONS_ENABLED: 'true',
      }).PUSH_NOTIFICATIONS_ENABLED,
    ).toBe(true);

    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        PUSH_NOTIFICATIONS_ENABLED: 'true',
        RUNTIME_ROLE: 'worker',
      }),
    ).toThrow(/EXPO_PUSH_ACCESS_TOKEN is required by the worker/i);
  });
});

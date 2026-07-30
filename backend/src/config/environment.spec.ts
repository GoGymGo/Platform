import { validateEnvironment } from './environment';

describe('environment validation', () => {
  it('normalizes safe local defaults', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      AUTH_MODE: 'test',
      REWARD_CODE_ENCRYPTION_KEY: '',
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.RUNTIME_ROLE).toBe('api');
    expect(environment.OPENAPI_ENABLED).toBe(true);
    expect(environment.PRETTY_LOGS_ENABLED).toBe(true);
    expect(environment.DATABASE_URL).toContain('localhost:5432');
    expect(environment.PRIVACY_OPERATIONS_ENABLED).toBe(false);
    expect(environment.PROFILE_MEDIA_ENABLED).toBe(false);
    expect(environment.PROFILE_MEDIA_MAX_BYTES).toBe(2 * 1_024 * 1_024);
    expect(environment.PRIVACY_EXPORT_RETENTION_DAYS).toBe(7);
    expect(environment.OTEL_ENABLED).toBe(false);
    expect(environment.WORKER_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(environment.REWARD_CODE_ENCRYPTION_KEY).toBeUndefined();
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

  it('requires coupon encryption keys to decode to exactly 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        AUTH_MODE: 'test',
        REWARD_CODE_ENCRYPTION_KEY: Buffer.from('too-short').toString('base64'),
      }),
    ).toThrow(/32-byte key/i);
    expect(
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        REWARD_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      }).REWARD_CODE_ENCRYPTION_KEY,
    ).toBeDefined();
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

  it('requires a private content bucket when profile media is enabled', () => {
    expect(() =>
      validateEnvironment({
        AUTH_MODE: 'test',
        NODE_ENV: 'test',
        PROFILE_MEDIA_ENABLED: 'true',
      }),
    ).toThrow(/GCP_STORAGE_BUCKET is required/i);

    expect(
      validateEnvironment({
        AUTH_MODE: 'test',
        GCP_STORAGE_BUCKET: 'private-content',
        NODE_ENV: 'test',
        PROFILE_MEDIA_ENABLED: 'true',
      }).PROFILE_MEDIA_ENABLED,
    ).toBe(true);
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

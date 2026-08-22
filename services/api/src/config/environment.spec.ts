import { validateEnvironment } from './environment';

const productionEnvironment = {
  CORS_ORIGINS: 'https://app.gogymgo.com',
  DATABASE_URL: 'postgresql://gogymgo:secret@10.20.0.3:5432/gogymgo',
  FIREBASE_PROJECT_ID: 'gogymgo-production',
  GOGYMGO_OWNER_EMAIL: 'owner@gogymgo.example',
  NODE_ENV: 'production',
  OPENAPI_ENABLED: 'false',
  PRETTY_LOGS_ENABLED: 'false',
  REWARD_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  TRUST_PROXY: 'true',
} as const;

describe('environment validation', () => {
  it('normalizes safe local defaults', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      REWARD_CODE_ENCRYPTION_KEY: '',
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.RUNTIME_ROLE).toBe('api');
    expect(environment.OPENAPI_ENABLED).toBe(true);
    expect(environment.PRETTY_LOGS_ENABLED).toBe(true);
    expect(environment.DATABASE_URL).toContain('localhost:5432');
    expect(environment.PRIVACY_OPERATIONS_ENABLED).toBe(false);
    expect(environment.LANDING_INTAKE_ENABLED).toBe(false);
    expect(environment.PROFILE_MEDIA_ENABLED).toBe(false);
    expect(environment.CREATOR_FEATURES_ENABLED).toBe(false);
    expect(environment.PARTNER_APPLICATION_RETENTION_DAYS).toBeUndefined();
    expect(environment.PRIVATE_OBJECT_STORAGE_PROVIDER).toBe('aws-s3');
    expect(environment.AWS_REGION).toBe('ca-central-1');
    expect(environment.PROFILE_MEDIA_MAX_BYTES).toBe(2 * 1_024 * 1_024);
    expect(environment.PRIVACY_EXPORT_RETENTION_DAYS).toBe(7);
    expect(environment.OTEL_ENABLED).toBe(false);
    expect(environment.WORKER_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(environment.REWARD_CODE_ENCRYPTION_KEY).toBeUndefined();
    expect(
      validateEnvironment({ AWS_REGION: '', NODE_ENV: 'test' }).AWS_REGION,
    ).toBe('ca-central-1');
  });

  it('accepts only a bounded explicitly configured partner retention period', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        PARTNER_APPLICATION_RETENTION_DAYS: '365',
      }).PARTNER_APPLICATION_RETENTION_DAYS,
    ).toBe(365);
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        PARTNER_APPLICATION_RETENTION_DAYS: '29',
      }),
    ).toThrow(/PARTNER_APPLICATION_RETENTION_DAYS/i);
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        PARTNER_APPLICATION_RETENTION_DAYS: '731',
      }),
    ).toThrow(/PARTNER_APPLICATION_RETENTION_DAYS/i);
  });

  it('requires the forwarding secret and retention when landing intake is enabled', () => {
    expect(() =>
      validateEnvironment({
        LANDING_INTAKE_ENABLED: 'true',
        NODE_ENV: 'test',
      }),
    ).toThrow(/LANDING_INTAKE_FORWARDING_SECRET is required/i);
    expect(() =>
      validateEnvironment({
        LANDING_INTAKE_ENABLED: 'true',
        LANDING_INTAKE_FORWARDING_SECRET: 's'.repeat(32),
        NODE_ENV: 'test',
      }),
    ).toThrow(/LANDING_INTAKE_RETENTION_DAYS is required/i);

    const environment = validateEnvironment({
      LANDING_INTAKE_ENABLED: 'true',
      LANDING_INTAKE_FORWARDING_SECRET: 's'.repeat(32),
      LANDING_INTAKE_RETENTION_DAYS: '90',
      NODE_ENV: 'test',
    });
    expect(environment.LANDING_INTAKE_ENABLED).toBe(true);
    expect(environment.LANDING_INTAKE_RETENTION_DAYS).toBe(90);
  });

  it('requires an OTLP endpoint and service name when telemetry is enabled', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        OTEL_ENABLED: 'true',
      }),
    ).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT is required/i);

    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        OTEL_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_SERVICE_NAME: 'gogymgo-test',
      }).OTEL_ENABLED,
    ).toBe(true);
  });

  it('requires a Firebase project in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      /FIREBASE_PROJECT_ID is required/i,
    );
  });

  it('accepts a complete fail-closed production configuration', () => {
    const environment = validateEnvironment(productionEnvironment);

    expect(environment.NODE_ENV).toBe('production');
    expect(environment.OPENAPI_ENABLED).toBe(false);
    expect(environment.PRETTY_LOGS_ENABLED).toBe(false);
    expect(environment.TRUST_PROXY).toBe(true);
  });

  it('does not require API-only secrets for a production worker', () => {
    const environment = validateEnvironment({
      ...productionEnvironment,
      GOGYMGO_OWNER_EMAIL: '',
      REWARD_CODE_ENCRYPTION_KEY: '',
      RUNTIME_ROLE: 'worker',
    });

    expect(environment.GOGYMGO_OWNER_EMAIL).toBeUndefined();
    expect(environment.REWARD_CODE_ENCRYPTION_KEY).toBeUndefined();
    expect(environment.RUNTIME_ROLE).toBe('worker');
  });

  it.each([
    [
      'missing owner identity',
      { GOGYMGO_OWNER_EMAIL: '' },
      /GOGYMGO_OWNER_EMAIL is required/i,
    ],
    [
      'loopback database',
      { DATABASE_URL: 'postgresql://gogymgo:secret@localhost:5432/gogymgo' },
      /DATABASE_URL must not use a loopback host/i,
    ],
    [
      'insecure CORS origin',
      { CORS_ORIGINS: 'http://app.gogymgo.com' },
      /CORS_ORIGINS must contain only exact HTTPS origins/i,
    ],
    [
      'Firebase emulator',
      { FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' },
      /FIREBASE_AUTH_EMULATOR_HOST must not be configured/i,
    ],
    [
      'public OpenAPI',
      { OPENAPI_ENABLED: 'true' },
      /OPENAPI_ENABLED must be false/i,
    ],
    [
      'pretty logs',
      { PRETTY_LOGS_ENABLED: 'true' },
      /PRETTY_LOGS_ENABLED must be false/i,
    ],
    ['untrusted proxy', { TRUST_PROXY: 'false' }, /TRUST_PROXY must be true/i],
    [
      'missing reward key',
      { REWARD_CODE_ENCRYPTION_KEY: '' },
      /REWARD_CODE_ENCRYPTION_KEY is required/i,
    ],
    [
      'insecure push endpoint',
      { EXPO_PUSH_API_URL: 'http://push.gogymgo.com' },
      /EXPO_PUSH_API_URL must use HTTPS/i,
    ],
    [
      'insecure telemetry endpoint',
      {
        OTEL_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://telemetry.gogymgo.com',
        OTEL_SERVICE_NAME: 'gogymgo-api',
      },
      /OTEL_EXPORTER_OTLP_ENDPOINT must use HTTPS/i,
    ],
    [
      'non-Canadian AWS region',
      { AWS_REGION: 'us-east-2' },
      /AWS_REGION must be ca-central-1/i,
    ],
  ])('rejects %s in production', (_label, override, message) => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        ...override,
      }),
    ).toThrow(message);
  });

  it('requires coupon encryption keys to decode to exactly 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        REWARD_CODE_ENCRYPTION_KEY: Buffer.from('too-short').toString('base64'),
      }),
    ).toThrow(/32-byte key/i);
    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        REWARD_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      }).REWARD_CODE_ENCRYPTION_KEY,
    ).toBeDefined();
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        REWARD_CODE_ENCRYPTION_KEY: `!!!!${Buffer.alloc(32, 7).toString('base64')}`,
      }),
    ).toThrow(/base64-encoded 32-byte key/i);
  });

  it('requires a private bucket and pseudonymization key for privacy execution', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        PRIVACY_OPERATIONS_ENABLED: 'true',
      }),
    ).toThrow(/PRIVACY_EXPORT_BUCKET is required/i);

    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        PRIVACY_EXPORT_BUCKET: 'private-exports',
        PRIVACY_OPERATIONS_ENABLED: 'true',
      }).PRIVACY_OPERATIONS_ENABLED,
    ).toBe(true);

    expect(() =>
      validateEnvironment({
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
        NODE_ENV: 'test',
        PROFILE_MEDIA_ENABLED: 'true',
      }),
    ).toThrow(/PRIVATE_CONTENT_BUCKET is required/i);

    expect(
      validateEnvironment({
        PRIVATE_CONTENT_BUCKET: 'private-content',
        NODE_ENV: 'test',
        PROFILE_MEDIA_ENABLED: 'true',
      }).PROFILE_MEDIA_ENABLED,
    ).toBe(true);
  });

  it('accepts only the AWS S3 private-storage provider', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        PRIVATE_OBJECT_STORAGE_PROVIDER: 'google-cloud',
      }),
    ).toThrow(/PRIVATE_OBJECT_STORAGE_PROVIDER/i);

    const localEnvironment = validateEnvironment({
      AWS_REGION: 'us-west-2',
      NODE_ENV: 'test',
      PRIVATE_OBJECT_STORAGE_PROVIDER: 'aws-s3',
    });
    expect(localEnvironment.AWS_REGION).toBe('us-west-2');

    expect(
      validateEnvironment({ NODE_ENV: 'test' }).PRIVATE_OBJECT_STORAGE_PROVIDER,
    ).toBe('aws-s3');
  });

  it('requires the Expo access token only in the sending worker', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        PUSH_NOTIFICATIONS_ENABLED: 'true',
      }).PUSH_NOTIFICATIONS_ENABLED,
    ).toBe(true);

    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        PUSH_NOTIFICATIONS_ENABLED: 'true',
        RUNTIME_ROLE: 'worker',
      }),
    ).toThrow(/EXPO_PUSH_ACCESS_TOKEN is required by the worker/i);
  });
});

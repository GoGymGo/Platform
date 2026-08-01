import { z } from 'zod';
import { Buffer } from 'node:buffer';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().url().optional(),
);

const optionalSecret = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(32).optional(),
);

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    RUNTIME_ROLE: z.enum(['api', 'worker']).default('api'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    PRETTY_LOGS_ENABLED: booleanString.default(true),
    CORS_ORIGINS: z
      .string()
      .default(
        'http://localhost:8081,http://localhost:19006,http://localhost:19000',
      ),
    TRUST_PROXY: booleanString.default(false),
    OPENAPI_ENABLED: booleanString.default(true),
    RATE_LIMIT_TTL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(3_600_000)
      .default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
    WORKER_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(5_000),
    WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(300_000)
      .default(30_000),
    WORKER_STALE_AFTER_MS: z.coerce
      .number()
      .int()
      .min(30_000)
      .max(900_000)
      .default(120_000),
    OTEL_ENABLED: booleanString.default(false),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    OTEL_SERVICE_NAME: optionalTrimmedString,
    FIREBASE_PROJECT_ID: optionalTrimmedString,
    FIREBASE_AUTH_EMULATOR_HOST: optionalTrimmedString,
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://gogymgo:gogymgo@localhost:5432/gogymgo'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    GCP_STORAGE_BUCKET: optionalTrimmedString,
    PROFILE_MEDIA_ENABLED: booleanString.default(false),
    PROFILE_MEDIA_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(12)
      .max(5 * 1_024 * 1_024)
      .default(2 * 1_024 * 1_024),
    PROFILE_MEDIA_UPLOAD_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(900)
      .default(300),
    PROFILE_MEDIA_READ_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(900)
      .default(300),
    PRIVACY_OPERATIONS_ENABLED: booleanString.default(false),
    PRIVACY_EXPORT_BUCKET: optionalTrimmedString,
    PRIVACY_EXPORT_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(90)
      .default(7),
    PRIVACY_DOWNLOAD_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(900)
      .default(300),
    PRIVACY_JOB_LEASE_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3_600)
      .default(600),
    PRIVACY_PSEUDONYMIZATION_KEY: optionalSecret,
    PUSH_NOTIFICATIONS_ENABLED: booleanString.default(false),
    EXPO_PUSH_API_URL: z
      .string()
      .url()
      .default('https://exp.host/--/api/v2/push/send'),
    EXPO_PUSH_ACCESS_TOKEN: optionalTrimmedString,
    REWARD_CODE_ENCRYPTION_KEY: optionalTrimmedString,
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      !environment.FIREBASE_PROJECT_ID
    ) {
      context.addIssue({
        code: 'custom',
        message: 'FIREBASE_PROJECT_ID is required in production.',
        path: ['FIREBASE_PROJECT_ID'],
      });
    }

    if (environment.NODE_ENV === 'production') {
      const databaseHost = new URL(environment.DATABASE_URL).hostname
        .trim()
        .toLowerCase();
      if (
        databaseHost === 'localhost' ||
        databaseHost === '127.0.0.1' ||
        databaseHost === '::1'
      ) {
        context.addIssue({
          code: 'custom',
          message: 'DATABASE_URL must not use a loopback host in production.',
          path: ['DATABASE_URL'],
        });
      }

      const corsOrigins = environment.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
      if (
        corsOrigins.some(
          (origin) => !/^https:\/\/[^/?#]+(?::\d+)?$/i.test(origin),
        )
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'CORS_ORIGINS must contain only exact HTTPS origins in production.',
          path: ['CORS_ORIGINS'],
        });
      }

      if (environment.FIREBASE_AUTH_EMULATOR_HOST) {
        context.addIssue({
          code: 'custom',
          message:
            'FIREBASE_AUTH_EMULATOR_HOST must not be configured in production.',
          path: ['FIREBASE_AUTH_EMULATOR_HOST'],
        });
      }
      if (environment.OPENAPI_ENABLED) {
        context.addIssue({
          code: 'custom',
          message: 'OPENAPI_ENABLED must be false in production.',
          path: ['OPENAPI_ENABLED'],
        });
      }
      if (environment.PRETTY_LOGS_ENABLED) {
        context.addIssue({
          code: 'custom',
          message: 'PRETTY_LOGS_ENABLED must be false in production.',
          path: ['PRETTY_LOGS_ENABLED'],
        });
      }
      if (!environment.TRUST_PROXY) {
        context.addIssue({
          code: 'custom',
          message: 'TRUST_PROXY must be true in production.',
          path: ['TRUST_PROXY'],
        });
      }
      if (!environment.REWARD_CODE_ENCRYPTION_KEY) {
        context.addIssue({
          code: 'custom',
          message: 'REWARD_CODE_ENCRYPTION_KEY is required in production.',
          path: ['REWARD_CODE_ENCRYPTION_KEY'],
        });
      }
      if (!environment.EXPO_PUSH_API_URL.startsWith('https://')) {
        context.addIssue({
          code: 'custom',
          message: 'EXPO_PUSH_API_URL must use HTTPS in production.',
          path: ['EXPO_PUSH_API_URL'],
        });
      }
      if (
        environment.OTEL_EXPORTER_OTLP_ENDPOINT &&
        !environment.OTEL_EXPORTER_OTLP_ENDPOINT.startsWith('https://')
      ) {
        context.addIssue({
          code: 'custom',
          message: 'OTEL_EXPORTER_OTLP_ENDPOINT must use HTTPS in production.',
          path: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
        });
      }
    }

    if (environment.REWARD_CODE_ENCRYPTION_KEY) {
      const key = Buffer.from(environment.REWARD_CODE_ENCRYPTION_KEY, 'base64');
      if (key.length !== 32) {
        context.addIssue({
          code: 'custom',
          message:
            'REWARD_CODE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
          path: ['REWARD_CODE_ENCRYPTION_KEY'],
        });
      }
    }

    if (environment.OTEL_ENABLED) {
      for (const key of [
        'OTEL_EXPORTER_OTLP_ENDPOINT',
        'OTEL_SERVICE_NAME',
      ] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            message: `${key} is required when OTEL_ENABLED is true.`,
            path: [key],
          });
        }
      }
    }

    if (environment.PRIVACY_OPERATIONS_ENABLED) {
      for (const key of ['PRIVACY_EXPORT_BUCKET'] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            message: `${key} is required when PRIVACY_OPERATIONS_ENABLED is true.`,
            path: [key],
          });
        }
      }
      if (
        environment.RUNTIME_ROLE === 'worker' &&
        !environment.PRIVACY_PSEUDONYMIZATION_KEY
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'PRIVACY_PSEUDONYMIZATION_KEY is required by the worker when PRIVACY_OPERATIONS_ENABLED is true.',
          path: ['PRIVACY_PSEUDONYMIZATION_KEY'],
        });
      }
    }

    if (environment.PROFILE_MEDIA_ENABLED && !environment.GCP_STORAGE_BUCKET) {
      context.addIssue({
        code: 'custom',
        message:
          'GCP_STORAGE_BUCKET is required when PROFILE_MEDIA_ENABLED is true.',
        path: ['GCP_STORAGE_BUCKET'],
      });
    }

    if (
      environment.PUSH_NOTIFICATIONS_ENABLED &&
      environment.RUNTIME_ROLE === 'worker' &&
      !environment.EXPO_PUSH_ACCESS_TOKEN
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'EXPO_PUSH_ACCESS_TOKEN is required by the worker when PUSH_NOTIFICATIONS_ENABLED is true.',
        path: ['EXPO_PUSH_ACCESS_TOKEN'],
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(config);
}

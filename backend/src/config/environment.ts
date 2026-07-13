import { z } from 'zod';

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

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
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
    AUTH_MODE: z.enum(['firebase', 'test']).default('firebase'),
    FIREBASE_PROJECT_ID: optionalTrimmedString,
    FIREBASE_AUTH_EMULATOR_HOST: optionalTrimmedString,
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://gogymgo:gogymgo@localhost:5432/gogymgo'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    GCP_STORAGE_BUCKET: optionalTrimmedString,
    PUSH_NOTIFICATIONS_ENABLED: booleanString.default(false),
    EXPO_PUSH_API_URL: z
      .string()
      .url()
      .default('https://exp.host/--/api/v2/push/send'),
    EXPO_PUSH_ACCESS_TOKEN: optionalTrimmedString,
    HYPERWALLET_ENABLED: booleanString.default(false),
    HYPERWALLET_API_URL: z
      .string()
      .url()
      .default('https://uat-api.paylution.com/rest/v4'),
    HYPERWALLET_PORTAL_URL: optionalUrl,
    HYPERWALLET_PROGRAM_TOKEN: optionalTrimmedString,
    HYPERWALLET_USERNAME: optionalTrimmedString,
    HYPERWALLET_PASSWORD: optionalTrimmedString,
    HYPERWALLET_WEBHOOK_USERNAME: optionalTrimmedString,
    HYPERWALLET_WEBHOOK_PASSWORD: optionalTrimmedString,
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.AUTH_MODE !== 'firebase'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'AUTH_MODE must be firebase in production.',
        path: ['AUTH_MODE'],
      });
    }

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

    if (environment.HYPERWALLET_ENABLED) {
      const requiredKeys = [
        'HYPERWALLET_PORTAL_URL',
        'HYPERWALLET_PROGRAM_TOKEN',
        'HYPERWALLET_USERNAME',
        'HYPERWALLET_PASSWORD',
        'HYPERWALLET_WEBHOOK_USERNAME',
        'HYPERWALLET_WEBHOOK_PASSWORD',
      ] as const;

      for (const key of requiredKeys) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            message: `${key} is required when HYPERWALLET_ENABLED is true.`,
            path: [key],
          });
        }
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(config);
}

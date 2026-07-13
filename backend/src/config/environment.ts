import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
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
    AUTH_MODE: z.enum(['firebase', 'test']).default('firebase'),
    FIREBASE_PROJECT_ID: optionalTrimmedString,
    FIREBASE_AUTH_EMULATOR_HOST: optionalTrimmedString,
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://gogymgo:gogymgo@localhost:5432/gogymgo'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    GCP_STORAGE_BUCKET: optionalTrimmedString,
    HYPERWALLET_API_URL: z
      .string()
      .url()
      .default('https://api.sandbox.hyperwallet.com'),
    HYPERWALLET_PROGRAM_TOKEN: optionalTrimmedString,
    HYPERWALLET_USERNAME: optionalTrimmedString,
    HYPERWALLET_PASSWORD: optionalTrimmedString,
    HYPERWALLET_WEBHOOK_SECRET: optionalTrimmedString,
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
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): Environment {
  return environmentSchema.parse(config);
}

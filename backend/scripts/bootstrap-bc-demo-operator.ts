import { Pool } from 'pg';
import {
  assertLocalDatabaseUrl,
  bootstrapBcDemoOperator,
} from '../src/foundation/bc-demo-foundation';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
    throw new Error(
      'The BC demo operator bootstrap runs only with NODE_ENV=development or NODE_ENV=test.',
    );
  }
  if (process.env.CONFIRM_BC_DEMO_OPERATOR_BOOTSTRAP !== 'yes') {
    throw new Error(
      'Set CONFIRM_BC_DEMO_OPERATOR_BOOTSTRAP=yes to authorize the local BC demo operator bootstrap.',
    );
  }

  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const firebaseUid = requiredEnvironment('BC_DEMO_OPERATOR_FIREBASE_UID');
  const reason = requiredEnvironment('BC_DEMO_OPERATOR_REASON');
  assertLocalDatabaseUrl(databaseUrl, 'The BC demo operator bootstrap');

  const pool = new Pool({
    application_name: 'gogymgo-bc-demo-operator-bootstrap',
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  try {
    const result = await bootstrapBcDemoOperator(pool, firebaseUid, reason);
    console.log(JSON.stringify(result, null, 2));
    console.log(
      'Least-privilege BC demo operator access is ready; cash, payout, and Hyperwallet privileges were not granted.',
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'BC demo operator bootstrap failed.',
  );
  process.exitCode = 1;
});

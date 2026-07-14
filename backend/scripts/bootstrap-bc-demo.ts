import { Pool } from 'pg';
import {
  assertLocalDatabaseUrl,
  bootstrapBcDemoFoundation,
  getDefaultBcDemoMonthKey,
} from '../src/foundation/bc-demo-foundation';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
    throw new Error(
      'The BC demo bootstrap runs only with NODE_ENV=development or NODE_ENV=test.',
    );
  }
  if (process.env.CONFIRM_BC_DEMO_BOOTSTRAP !== 'yes') {
    throw new Error(
      'Set CONFIRM_BC_DEMO_BOOTSTRAP=yes to authorize the local BC demo bootstrap.',
    );
  }

  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const reason = requiredEnvironment('BC_DEMO_BOOTSTRAP_REASON');
  const monthKey =
    process.env.BC_DEMO_COMPETITION_MONTH?.trim() || getDefaultBcDemoMonthKey();
  assertLocalDatabaseUrl(databaseUrl, 'The BC demo bootstrap');

  const pool = new Pool({
    application_name: 'gogymgo-bc-demo-bootstrap',
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  try {
    const result = await bootstrapBcDemoFoundation(pool, monthKey, reason);
    console.log(JSON.stringify(result, null, 2));
    console.log(
      'BC non-cash demo registration is available for approved users; prize, winner, payout, and Hyperwallet state remain disabled.',
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'BC demo bootstrap failed.',
  );
  process.exitCode = 1;
});

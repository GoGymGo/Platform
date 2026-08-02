import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.CONFIRM_PILOT_ONBOARDING_RESET !== 'yes') {
    throw new Error(
      'Set CONFIRM_PILOT_ONBOARDING_RESET=yes to authorize this one-time change.',
    );
  }
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const reason = requiredEnvironment('PILOT_ONBOARDING_RESET_REASON');
  if (reason.length < 8 || reason.length > 500) {
    throw new Error(
      'PILOT_ONBOARDING_RESET_REASON must contain 8 to 500 characters.',
    );
  }

  const pool = new Pool({
    application_name: 'gogymgo-pilot-onboarding-reset',
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resetAt = new Date();
    const users = await client.query<{ id: string }>(
      `UPDATE users
       SET pilot_onboarding_reset_at = $1, updated_at = $1
       WHERE status = 'active'
         AND (pilot_onboarding_reset_at IS NULL OR pilot_onboarding_reset_at < $1)
       RETURNING id`,
      [resetAt],
    );
    await client.query(
      `UPDATE competition_enrollments
       SET status = 'withdrawn'
       WHERE status = 'active'`,
    );
    for (const user of users.rows) {
      await client.query(
        `INSERT INTO operator_audit_events
           (actor_user_id, action, entity_type, entity_id, previous_state,
            next_state, reason, request_id)
         VALUES
           (NULL, 'user.pilot_onboarding_reset', 'users', $1, NULL, $2, $3, $4)`,
        [
          user.id,
          JSON.stringify({ resetAt: resetAt.toISOString() }),
          reason,
          `pilot-onboarding-reset:${randomUUID()}`,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Pilot onboarding reset recorded for ${users.rowCount ?? 0} active account(s).`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Pilot onboarding reset failed.',
  );
  process.exitCode = 1;
});

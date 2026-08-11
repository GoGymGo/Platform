import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.CONFIRM_BOOTSTRAP_ADMIN !== 'yes') {
    throw new Error(
      'Set CONFIRM_BOOTSTRAP_ADMIN=yes to authorize this change.',
    );
  }
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const ownerEmail = requiredEnvironment('GOGYMGO_OWNER_EMAIL').toLowerCase();
  const administratorEmail = requiredEnvironment(
    'BOOTSTRAP_ADMIN_EMAIL',
  ).toLowerCase();
  const reason = requiredEnvironment('BOOTSTRAP_ADMIN_REASON');
  if (administratorEmail !== ownerEmail) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL must match the protected GoGymGo owner identity.',
    );
  }
  if (reason.length < 8 || reason.length > 500) {
    throw new Error('BOOTSTRAP_ADMIN_REASON must contain 8 to 500 characters.');
  }

  const pool = new Pool({
    application_name: 'gogymgo-admin-bootstrap',
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query<{ id: string; roles: string[] }>(
      `SELECT id, roles
       FROM users
       WHERE lower(email) = $1
         AND status = 'active'
       FOR UPDATE`,
      [administratorEmail],
    );
    if (user.rowCount !== 1) {
      throw new Error(
        'The configured owner must sign in once before the administrator role can be granted.',
      );
    }
    const current = user.rows[0];
    if (current.roles.includes('admin')) {
      await client.query('COMMIT');
      console.log('Administrator role is already present; no change was made.');
      return;
    }

    const nextRoles = [...new Set([...current.roles, 'admin'])].sort();
    await client.query(
      `UPDATE users
       SET roles = $1, updated_at = current_timestamp
       WHERE id = $2`,
      [nextRoles, current.id],
    );
    await client.query(
      `INSERT INTO operator_audit_events
         (actor_user_id, action, entity_type, entity_id, previous_state,
          next_state, reason, request_id)
       VALUES
         (NULL, 'user.admin_bootstrapped', 'users', $1, $2, $3, $4, $5)`,
      [
        current.id,
        JSON.stringify({ roles: current.roles }),
        JSON.stringify({ roles: nextRoles }),
        reason,
        `bootstrap-admin:${randomUUID()}`,
      ],
    );
    await client.query('COMMIT');
    console.log(
      'Administrator role granted and append-only audit event recorded.',
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
    error instanceof Error ? error.message : 'Admin bootstrap failed.',
  );
  process.exitCode = 1;
});

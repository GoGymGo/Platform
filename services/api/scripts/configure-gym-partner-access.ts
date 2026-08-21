import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadTrustedFirebaseOperatorAccount } from '../src/modules/auth/trusted-operator-account-loader';
import {
  partnerAssignmentNeedsChange,
  rolesForActivePartnerAssignments,
} from '../src/modules/operator/trusted-partner-access';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredChoice<T extends string>(
  name: string,
  choices: readonly T[],
): T {
  const value = requiredEnvironment(name);
  if (!choices.includes(value as T)) {
    throw new Error(`${name} must be one of: ${choices.join(', ')}.`);
  }
  return value as T;
}

async function main(): Promise<void> {
  if (process.env.CONFIRM_PARTNER_ACCESS !== 'yes') {
    throw new Error(
      'Set CONFIRM_PARTNER_ACCESS=yes to authorize this access change.',
    );
  }
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const email = requiredEnvironment('PARTNER_OPERATOR_EMAIL').toLowerCase();
  const gymLocationId = requiredEnvironment('PARTNER_GYM_LOCATION_ID');
  const accessLevel = requiredChoice('PARTNER_ACCESS_LEVEL', [
    'admin',
    'staff',
  ] as const);
  const action = requiredChoice('PARTNER_ACCESS_ACTION', [
    'grant',
    'revoke',
  ] as const);
  const reason = requiredEnvironment('PARTNER_ACCESS_REASON');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      gymLocationId,
    )
  ) {
    throw new Error('PARTNER_GYM_LOCATION_ID must be a valid UUID.');
  }
  if (reason.length < 8 || reason.length > 500) {
    throw new Error('PARTNER_ACCESS_REASON must contain 8 to 500 characters.');
  }

  const pool = new Pool({
    application_name: 'gogymgo-gym-partner-access',
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query<{
      email_verified: boolean;
      firebase_uid: string;
      id: string;
      roles: string[];
    }>(
      `SELECT id, email_verified, firebase_uid, roles
       FROM users
       WHERE lower(email) = $1
         AND status = 'active'
       FOR UPDATE`,
      [email],
    );
    if (userResult.rowCount !== 1) {
      throw new Error(
        'The active partner user must sign in once before access can be configured.',
      );
    }
    const user = userResult.rows[0];
    if (!user.email_verified) {
      throw new Error('The partner user must verify their email first.');
    }
    await loadTrustedFirebaseOperatorAccount({
      email,
      firebaseUid: user.firebase_uid,
    });
    const unexpectedRoles = user.roles.filter(
      (role) =>
        !['user', 'gym_partner_admin', 'gym_partner_staff'].includes(role),
    );
    if (unexpectedRoles.length > 0) {
      throw new Error(
        'A platform or specialist operator role cannot be combined with gym-partner access.',
      );
    }
    const gymResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name
       FROM gym_locations
       WHERE id = $1
         AND (
           $2 = 'revoke'
           OR (active = true AND deleted_at IS NULL)
         )
       FOR SHARE`,
      [gymLocationId, action],
    );
    if (gymResult.rowCount !== 1) {
      throw new Error(
        action === 'grant'
          ? 'The partner gym must exist, be active, and not be deleted.'
          : 'The partner gym must exist before its assignment can be revoked.',
      );
    }
    const previousResult = await client.query<{
      access_level: 'admin' | 'staff';
      active: boolean;
    }>(
      `SELECT access_level, active
       FROM gym_partner_assignments
       WHERE user_id = $1 AND gym_location_id = $2
       FOR UPDATE`,
      [user.id, gymLocationId],
    );
    const previous = previousResult.rows[0] ?? null;

    if (
      action === 'revoke' &&
      previous &&
      previous.active &&
      previous.access_level !== accessLevel
    ) {
      throw new Error(
        `The active assignment is ${previous.access_level}; use that PARTNER_ACCESS_LEVEL to revoke it.`,
      );
    }

    const assignmentChanged = partnerAssignmentNeedsChange({
      accessLevel,
      action,
      previous: previous
        ? { accessLevel: previous.access_level, active: previous.active }
        : null,
    });

    if (action === 'grant' && assignmentChanged) {
      await client.query(
        `INSERT INTO gym_partner_assignments
           (user_id, gym_location_id, access_level, active,
            assigned_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, true, NULL, current_timestamp, current_timestamp)
         ON CONFLICT (user_id, gym_location_id)
         DO UPDATE SET access_level = EXCLUDED.access_level,
                       active = true,
                       updated_at = current_timestamp`,
        [user.id, gymLocationId, accessLevel],
      );
    } else if (action === 'revoke' && assignmentChanged) {
      await client.query(
        `UPDATE gym_partner_assignments
         SET active = false, updated_at = current_timestamp
         WHERE user_id = $1 AND gym_location_id = $2 AND active = true`,
        [user.id, gymLocationId],
      );
    }

    const activeLevels = await client.query<{
      access_level: 'admin' | 'staff';
    }>(
      `SELECT DISTINCT assignment.access_level
       FROM gym_partner_assignments AS assignment
       INNER JOIN gym_locations AS gym
         ON gym.id = assignment.gym_location_id
       WHERE assignment.user_id = $1
         AND assignment.active = true
         AND gym.active = true
         AND gym.deleted_at IS NULL`,
      [user.id],
    );
    const nextRoles = rolesForActivePartnerAssignments(
      user.roles,
      activeLevels.rows.map((row) => row.access_level),
    );
    const rolesChanged =
      JSON.stringify([...user.roles].sort()) !== JSON.stringify(nextRoles);
    if (!assignmentChanged && !rolesChanged) {
      await client.query('COMMIT');
      console.log('Partner access is already in the requested state.');
      return;
    }
    if (rolesChanged) {
      await client.query(
        `UPDATE users
         SET roles = $1, updated_at = current_timestamp
         WHERE id = $2`,
        [nextRoles, user.id],
      );
    }
    await client.query(
      `INSERT INTO operator_audit_events
         (actor_user_id, action, entity_type, entity_id, previous_state,
          next_state, reason, request_id)
       VALUES (NULL, $1, 'gym_partner_assignments', $2, $3, $4, $5, $6)`,
      [
        assignmentChanged
          ? `gym_partner_assignment.${action === 'grant' ? 'granted' : 'revoked'}`
          : 'gym_partner_access.roles_reconciled',
        user.id,
        previous
          ? JSON.stringify({
              accessLevel: previous.access_level,
              active: previous.active,
              gymLocationId,
            })
          : null,
        JSON.stringify({
          accessLevel,
          active: action === 'grant',
          gymLocationId,
          roles: nextRoles,
        }),
        reason,
        `partner-access:${randomUUID()}`,
      ],
    );
    await client.query('COMMIT');
    console.log(
      `Partner ${accessLevel} access ${action === 'grant' ? 'granted' : 'revoked'} for ${gymResult.rows[0].name}.`,
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
    error instanceof Error ? error.message : 'Partner access change failed.',
  );
  process.exitCode = 1;
});

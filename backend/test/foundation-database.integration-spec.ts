import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';

const execFileAsync = promisify(execFile);

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

describeWithDatabase('database migrations', () => {
  jest.setTimeout(120_000);

  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgis/postgis:17-3.5').start();
    const databaseUrl = container.getConnectionUri();
    await execFileAsync(
      process.execPath,
      [
        resolve(
          process.cwd(),
          'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
        ),
        'up',
        '--tsx',
        '--migrations-dir',
        resolve(process.cwd(), 'migrations'),
        '--database-url-var',
        'DATABASE_URL',
      ],
      {
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );
    pool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('creates the identity, region, idempotency, and audit tables with PostGIS', async () => {
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`,
    );
    const names = tables.rows.map((row) => row.table_name);

    expect(names).toEqual(
      expect.arrayContaining([
        'competition_draws',
        'competition_enrollments',
        'competition_progress',
        'competitions',
        'draw_entries',
        'draw_winners',
        'entry_ledger',
        'idempotency_keys',
        'operator_audit_events',
        'partner_applications',
        'payout_claims',
        'payout_payments',
        'payout_state_events',
        'profiles',
        'privacy_request_events',
        'privacy_requests',
        'provider_webhooks',
        'push_devices',
        'region_policies',
        'region_verifications',
        'session_events',
        'users',
        'workout_sessions',
      ]),
    );
    await expect(pool.query('SELECT PostGIS_Version()')).resolves.toBeDefined();
  });

  it('installs append-only triggers for evidence, ledgers, snapshots, and winners', async () => {
    const triggers = await pool.query<{ trigger_name: string }>(
      `SELECT trigger_name
       FROM information_schema.triggers
       WHERE trigger_schema = 'public'
       ORDER BY trigger_name`,
    );

    expect(triggers.rows.map((row) => row.trigger_name)).toEqual(
      expect.arrayContaining([
        'draw_entries_append_only',
        'draw_winners_append_only',
        'entry_ledger_append_only',
        'operator_audit_events_append_only',
        'payout_state_events_append_only',
        'privacy_request_events_append_only',
        'session_events_append_only',
      ]),
    );
  });

  it('rejects mutation of append-only operator audit events', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid)
       VALUES ('integration-user')
       RETURNING id`,
    );
    const audit = await pool.query<{ id: string }>(
      `INSERT INTO operator_audit_events
         (actor_user_id, action, entity_type, entity_id, reason, request_id)
       VALUES ($1, 'integration.created', 'users', $1, 'integration test', 'request-1')
       RETURNING id`,
      [user.rows[0].id],
    );

    await expect(
      pool.query(
        `UPDATE operator_audit_events SET reason = 'changed' WHERE id = $1`,
        [audit.rows[0].id],
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('enforces one active privacy request and immutable state events', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid)
       VALUES ('privacy-integration-user')
       RETURNING id`,
    );
    const privacyRequest = await pool.query<{ id: string }>(
      `INSERT INTO privacy_requests (user_id, request_type)
       VALUES ($1, 'export')
       RETURNING id`,
      [user.rows[0].id],
    );

    await expect(
      pool.query(
        `INSERT INTO privacy_requests (user_id, request_type)
         VALUES ($1, 'delete')`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/privacy_requests_one_active_per_user/i);

    const event = await pool.query<{ id: string }>(
      `INSERT INTO privacy_request_events
         (privacy_request_id, previous_status, next_status, source, source_event_id)
       VALUES ($1, NULL, 'requested', 'integration', 'event-1')
       RETURNING id`,
      [privacyRequest.rows[0].id],
    );
    await expect(
      pool.query(
        `UPDATE privacy_request_events SET source = 'changed' WHERE id = $1`,
        [event.rows[0].id],
      ),
    ).rejects.toThrow(/append-only/i);
  });
});

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

describeWithDatabase('foundation database migration', () => {
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
        'idempotency_keys',
        'operator_audit_events',
        'profiles',
        'region_policies',
        'region_verifications',
        'users',
      ]),
    );
    await expect(pool.query('SELECT PostGIS_Version()')).resolves.toBeDefined();
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
});

import {
  migrateTestDatabase,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const ids = {
  actor: '30000000-0000-4000-8000-000000000001',
  document: '30000000-0000-4000-8000-000000000002',
};

describeWithDatabase('admin configuration versions migration', () => {
  jest.setTimeout(180_000);

  let migrated: MigratedPostgisTestDatabase;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase('1787533200000');

    await migrated.pool.query(
      `INSERT INTO users
         (id, firebase_uid, email, email_verified, roles, status)
       VALUES
         ($1, 'admin-configuration-migration-actor',
          'migration-actor@example.com', TRUE, ARRAY['admin'], 'active')`,
      [ids.actor],
    );
    await migrated.pool.query(
      `INSERT INTO legal_documents
         (id, document_key, jurisdiction_code, locale, version, title, content,
          content_sha256, receipt_requirement, effective_at)
       VALUES
         ($1, 'migration_terms', 'CA-BC', 'en-CA', 'v1',
          'Migration test terms', '{}'::jsonb, repeat('a', 64), 'accept',
          '2026-01-01')`,
      [ids.document],
    );
    await migrated.pool.query(
      `INSERT INTO legal_document_events
         (legal_document_id, previous_state, next_state, actor_user_id, reason,
          request_id, created_at)
       VALUES
         ($1, NULL, 'published', $2, 'Initial publication for testing.',
          'migration-event-later', '2026-01-03'),
         ($1, 'published', 'withdrawn', $2, 'Earlier event for ordering test.',
          'migration-event-earlier', '2026-01-02')`,
      [ids.document, ids.actor],
    );

    await migrateTestDatabase(migrated.databaseUrl, '1787619600000');
  });

  afterAll(async () => {
    await migrated?.stop();
  });

  it('backfills ordered lifecycle versions and restores the append-only guard', async () => {
    const events = await migrated.pool.query<{
      lifecycle_version: number;
      request_id: string;
    }>(
      `SELECT request_id, lifecycle_version
       FROM legal_document_events
       WHERE legal_document_id = $1
       ORDER BY lifecycle_version`,
      [ids.document],
    );
    const trigger = await migrated.pool.query<{ tgenabled: string }>(
      `SELECT tgenabled
       FROM pg_trigger
       WHERE tgname = 'legal_document_events_append_only'
         AND tgrelid = 'legal_document_events'::regclass
         AND NOT tgisinternal`,
    );

    expect(events.rows).toEqual([
      { request_id: 'migration-event-earlier', lifecycle_version: 1 },
      { request_id: 'migration-event-later', lifecycle_version: 2 },
    ]);
    expect(trigger.rows).toEqual([{ tgenabled: 'O' }]);

    await expect(
      migrated.pool.query(
        `UPDATE legal_document_events
         SET reason = reason
         WHERE legal_document_id = $1`,
        [ids.document],
      ),
    ).rejects.toThrow(/append-only/i);
  });
});

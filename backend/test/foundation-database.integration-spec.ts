import { Pool } from 'pg';
import {
  MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

describeWithDatabase('database migrations', () => {
  jest.setTimeout(120_000);

  let database: MigratedPostgisTestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    database = await startMigratedPostgisTestDatabase();
    pool = database.pool;
  });

  afterAll(async () => {
    await database?.stop();
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
        'account_legal_receipt_bundles',
        'account_legal_receipts',
        'competition_draws',
        'competition_enrollments',
        'competition_progress',
        'competitions',
        'draw_entries',
        'draw_winners',
        'entry_ledger',
        'idempotency_keys',
        'legal_document_events',
        'legal_documents',
        'operator_audit_events',
        'partner_applications',
        'payout_claims',
        'payout_payments',
        'payout_state_events',
        'profile_media',
        'profiles',
        'privacy_request_events',
        'privacy_requests',
        'provider_webhooks',
        'push_devices',
        'region_policies',
        'region_verifications',
        'session_events',
        'users',
        'worker_heartbeats',
        'workout_sessions',
      ]),
    );
    await expect(pool.query('SELECT PostGIS_Version()')).resolves.toBeDefined();
    await expect(
      pool.query(
        "SELECT extname FROM pg_extension WHERE extname = 'btree_gist'",
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('constrains the durable worker heartbeat status', async () => {
    await expect(
      pool.query(
        `INSERT INTO worker_heartbeats
           (worker_name, instance_id, status)
         VALUES ('operations', 'integration-instance', 'running')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      pool.query(
        `UPDATE worker_heartbeats
         SET status = 'unknown'
         WHERE worker_name = 'operations'`,
      ),
    ).rejects.toThrow(/worker_heartbeats_status_valid/i);
  });

  it('allows adjacent region versions while rejecting overlapping validity windows', async () => {
    const insertRegion = (
      policyVersion: string,
      validFrom: string,
      validTo: string,
    ) =>
      pool.query(
        `INSERT INTO region_policies
           (code, country_code, subdivision_code, metro_name, currency,
            timezone, language_codes, minimum_age, competition_enabled,
            payout_enabled, boundary_version, policy_version, boundary,
            valid_from, valid_to)
         VALUES
           ('integration-region', 'CA', 'BC', 'Integration Region', 'CAD',
            'America/Vancouver', ARRAY['en-CA'], 19, TRUE, TRUE,
            'boundary-v1', $1,
            ST_GeogFromText('SRID=4326;MULTIPOLYGON(((-123.5 48.3,-123.2 48.3,-123.2 48.6,-123.5 48.3)))'),
            $2, $3)`,
        [policyVersion, validFrom, validTo],
      );

    await expect(
      insertRegion(
        'policy-v1',
        '2026-01-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
      ),
    ).resolves.toBeDefined();
    await expect(
      insertRegion(
        'policy-v2',
        '2026-02-01T00:00:00.000Z',
        '2026-03-01T00:00:00.000Z',
      ),
    ).resolves.toBeDefined();
    await expect(
      insertRegion(
        'policy-overlap',
        '2026-01-15T00:00:00.000Z',
        '2026-02-15T00:00:00.000Z',
      ),
    ).rejects.toThrow(/region_policies_no_overlapping_validity/i);
  });

  it('defaults configuration versions to one and rejects non-positive versions', async () => {
    const region = await pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          payout_enabled, boundary_version, policy_version, valid_from)
       VALUES
         ('version-region', 'US', 'WA', 'Version Region', 'USD',
          'America/Los_Angeles', ARRAY['en-US'], 18, TRUE, TRUE,
          'boundary-v1', 'policy-v1', '2026-01-01T00:00:00.000Z')
       RETURNING id`,
    );
    const competition = await pool.query<{
      configuration_version: number;
      id: string;
    }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, currency, rules_version, rules,
          registration_opens_at, registration_closes_at, starts_at, ends_at)
       VALUES
         ($1, '2026-09', 'Version Test', 'USD', 'rules-v1', '{}'::jsonb,
          '2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z',
          '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
       RETURNING id, configuration_version`,
      [region.rows[0].id],
    );
    const workout = await pool.query<{ id: string; version: number }>(
      `INSERT INTO creator_workouts
         (title, creator_name, video_url, duration_minutes, workout_style,
          region_codes)
       VALUES
         ('Version Workout', 'Creator', 'https://example.com/video', 30,
          'Strength', ARRAY['version-region'])
       RETURNING id, version`,
    );

    expect(competition.rows[0].configuration_version).toBe(1);
    expect(workout.rows[0].version).toBe(1);
    await expect(
      pool.query(
        'UPDATE competitions SET configuration_version = 0 WHERE id = $1',
        [competition.rows[0].id],
      ),
    ).rejects.toThrow(/competitions_configuration_version_positive/i);
    await expect(
      pool.query('UPDATE creator_workouts SET version = 0 WHERE id = $1', [
        workout.rows[0].id,
      ]),
    ).rejects.toThrow(/creator_workouts_version_positive/i);
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
        'account_legal_receipt_bundles_append_only',
        'account_legal_receipts_append_only',
        'account_legal_receipts_validate',
        'draw_entries_append_only',
        'draw_winners_append_only',
        'entry_ledger_append_only',
        'legal_document_events_append_only',
        'legal_documents_append_only',
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

  it('constrains profile-media sizes and moderated states', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid)
       VALUES ('profile-media-constraint-user')
       RETURNING id`,
    );
    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, status, expires_at)
         VALUES ($1, 'too-large', 'avatars/too-large.jpg', 'image/jpeg',
                 5242881, 'pending_upload', current_timestamp + interval '5 minutes')`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/profile_media_expected_size_valid/i);
    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, status, expires_at, reviewed_at,
            reviewed_by_user_id, decision_reason)
         VALUES ($1, 'invalid-approval', 'avatars/invalid-approval.jpg', 'image/jpeg',
                 512, 'approved', current_timestamp + interval '5 minutes',
                 current_timestamp, $1, 'constraint test decision')`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/profile_media_completion_consistent/i);

    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, actual_size_bytes, storage_generation,
            status, expires_at, completed_at, reviewed_at,
            reviewed_by_user_id, decision_reason)
         VALUES ($1, 'approved-one', 'avatars/approved-one.jpg', 'image/jpeg',
                 512, 512, 'generation-one', 'approved',
                 current_timestamp + interval '5 minutes', current_timestamp,
                 current_timestamp, $1, 'constraint test approval')`,
        [user.rows[0].id],
      ),
    ).resolves.toBeDefined();
    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, actual_size_bytes, storage_generation,
            status, expires_at, completed_at, reviewed_at,
            reviewed_by_user_id, decision_reason)
         VALUES ($1, 'approved-two', 'avatars/approved-two.jpg', 'image/jpeg',
                 512, 512, 'generation-two', 'approved',
                 current_timestamp + interval '5 minutes', current_timestamp,
                 current_timestamp, $1, 'constraint test approval')`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/profile_media_one_approved_per_user/i);
  });
});

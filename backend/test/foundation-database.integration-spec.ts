import { Pool } from 'pg';
import { demoDataCleanupSql } from '../migrations/1784170800000_remove_demo_data';
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
        'entry_ledger',
        'friend_requests',
        'friendships',
        'idempotency_keys',
        'legal_document_events',
        'legal_documents',
        'operator_audit_events',
        'partner_applications',
        'profile_media',
        'profiles',
        'privacy_request_events',
        'privacy_requests',
        'push_devices',
        'region_policies',
        'region_verifications',
        'reward_awards',
        'reward_catalog_items',
        'reward_coupon_codes',
        'session_events',
        'social_challenge_checkins',
        'social_challenge_members',
        'social_challenges',
        'users',
        'worker_heartbeats',
        'workout_sessions',
      ]),
    );
    expect(names).not.toContain('demo_verification_checkpoints');
    await expect(pool.query('SELECT PostGIS_Version()')).resolves.toBeDefined();
    await expect(
      pool.query(
        "SELECT extname FROM pg_extension WHERE extname = 'btree_gist'",
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('removes persisted demo records and restores demo-granted roles', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (firebase_uid, email_verified, roles)
         VALUES ('cleanup-migration-user', TRUE, ARRAY['operator', 'user'])
         RETURNING id`,
      );
      const userId = user.rows[0].id;
      await client.query(
        `INSERT INTO operator_audit_events
           (actor_user_id, action, entity_type, entity_id, previous_state,
            next_state, reason, request_id)
         VALUES
           ($1, 'user.bc_demo_operator_bootstrapped', 'users', $1,
            '{"roles":["user"]}'::jsonb,
            '{"roles":["operator","user"]}'::jsonb,
            'Integration cleanup migration verification',
            'cleanup-migration-role')`,
        [userId],
      );
      const region = await client.query<{ id: string }>(
        `INSERT INTO region_policies
           (code, country_code, subdivision_code, metro_name, currency,
            timezone, language_codes, minimum_age, competition_enabled,
            boundary_version, policy_version, boundary, valid_from)
         VALUES
           ('CA-BC-DEMO-CLEANUP', 'CA', 'BC', 'Cleanup Demo Region', 'CAD',
            'America/Vancouver', ARRAY['en-CA'], 19, TRUE,
            'cleanup-demo-boundary', 'cleanup-demo-policy',
            ST_Multi(ST_GeomFromText(
              'POLYGON((-123.2 49.2,-123.0 49.2,-123.0 49.4,-123.2 49.4,-123.2 49.2))',
              4326
            ))::geography,
            current_timestamp)
         RETURNING id`,
      );
      const competition = await client.query<{ id: string }>(
        `INSERT INTO competitions
           (region_policy_id, month_key, name, status, rules_version, rules,
            minimum_entrants, registration_opens_at, registration_closes_at,
            starts_at, ends_at)
         VALUES
           ($1, '2099-09', 'Cleanup Demo Competition', 'registration',
            'cleanup-demo-rules', '{}'::jsonb, 100,
            '2099-08-01T00:00:00Z', '2099-09-01T00:00:00Z',
            '2099-09-01T00:00:00Z', '2099-10-01T00:00:00Z')
         RETURNING id`,
        [region.rows[0].id],
      );
      const reward = await client.query<{ id: string }>(
        `INSERT INTO reward_catalog_items
           (competition_id, sponsor_name, title, description, reward_type,
            status, fulfillment_instructions, inventory_total)
         VALUES
           ($1, 'Cleanup Sponsor', 'Cleanup Reward',
            'Migration cleanup verification reward.', 'physical', 'published',
            'Demo pickup instructions.', 1)
         RETURNING id`,
        [competition.rows[0].id],
      );
      const gymApplication = await client.query<{ id: string }>(
        `INSERT INTO partner_applications
           (application_type, contact_email, payload, region, status)
         VALUES
           ('gym', 'cleanup-gym@example.invalid',
            '{"gymName":"Iron District","gymAddress":"King St","managerName":"Cleanup"}'::jsonb,
            'Toronto', 'submitted')
         RETURNING id`,
      );

      await client.query(demoDataCleanupSql);

      await expect(
        client.query<{ roles: string[] }>(
          'SELECT roles FROM users WHERE id = $1',
          [userId],
        ),
      ).resolves.toMatchObject({ rows: [{ roles: ['user'] }] });
      await expect(
        client.query(
          `SELECT id FROM region_policies WHERE id = $1
           UNION ALL SELECT id FROM competitions WHERE id = $2
           UNION ALL SELECT id FROM reward_catalog_items WHERE id = $3`,
          [region.rows[0].id, competition.rows[0].id, reward.rows[0].id],
        ),
      ).resolves.toMatchObject({ rowCount: 0 });
      await expect(
        client.query('SELECT id FROM partner_applications WHERE id = $1', [
          gymApplication.rows[0].id,
        ]),
      ).resolves.toMatchObject({ rowCount: 0 });
      await expect(
        client.query(
          `SELECT id FROM operator_audit_events
           WHERE action = 'user.bc_demo_operator_bootstrapped'
             AND actor_user_id = $1`,
          [userId],
        ),
      ).resolves.toMatchObject({ rowCount: 0 });

      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  it('installs social identity, consent, and challenge constraints', async () => {
    const profileColumn = await pool.query<{
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'profiles'
         AND column_name = 'screen_name'`,
    );
    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'profiles_screen_name_unique',
           'friend_requests_one_pending_pair'
         )`,
    );
    const constraints = await pool.query<{ conname: string }>(
      `SELECT conname
       FROM pg_constraint
       WHERE conname IN (
         'friend_requests_distinct_users',
         'friendships_canonical_pair',
         'social_challenge_owner_accepted',
         'social_challenge_checkins_unique_day',
         'social_challenges_dates_valid',
         'social_challenges_name_valid'
       )`,
    );

    expect(profileColumn.rows).toEqual([
      { data_type: 'USER-DEFINED', is_nullable: 'NO' },
    ]);
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'friend_requests_one_pending_pair',
        'profiles_screen_name_unique',
      ]),
    );
    expect(constraints.rows.map((row) => row.conname)).toEqual(
      expect.arrayContaining([
        'friend_requests_distinct_users',
        'friendships_canonical_pair',
        'social_challenge_checkins_unique_day',
        'social_challenge_owner_accepted',
        'social_challenges_dates_valid',
        'social_challenges_name_valid',
      ]),
    );
  });

  it('installs the verified gym-log index used by streak queries', async () => {
    const index = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'workout_sessions_user_verified_eligible_date_idx'`,
    );

    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toMatch(
      /\(user_id, eligible_date DESC\).*WHERE \(status = 'verified'/i,
    );
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
             boundary_version, policy_version, boundary,
            valid_from, valid_to)
         VALUES
           ('integration-region', 'CA', 'BC', 'Integration Region', 'CAD',
             'America/Vancouver', ARRAY['en-CA'], 19, TRUE,
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
           boundary_version, policy_version, valid_from)
       VALUES
         ('version-region', 'US', 'WA', 'Version Region', 'USD',
           'America/Los_Angeles', ARRAY['en-US'], 18, TRUE,
          'boundary-v1', 'policy-v1', '2026-01-01T00:00:00.000Z')
       RETURNING id`,
    );
    const competition = await pool.query<{
      configuration_version: number;
      id: string;
    }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, rules_version, rules,
          registration_opens_at, registration_closes_at, starts_at, ends_at)
       VALUES
         ($1, '2026-09', 'Version Test', 'rules-v1', '{}'::jsonb,
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

  it('installs append-only and reward-inventory integrity triggers', async () => {
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
        'entry_ledger_append_only',
        'legal_document_events_append_only',
        'legal_documents_append_only',
        'operator_audit_events_append_only',
        'reward_awards_inventory_guard',
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

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
        'competition_settlement_inputs',
        'competitions',
        'draw_entries',
        'entry_ledger',
        'friend_requests',
        'friendships',
        'challenge_contact_invitations',
        'gym_locations',
        'gym_partner_assignments',
        'gym_qr_credentials',
        'gym_scan_events',
        'idempotency_keys',
        'interest_submissions',
        'legal_document_events',
        'legal_documents',
        'notification_deliveries',
        'operator_audit_events',
        'partner_applications',
        'partner_competition_proposals',
        'profile_media',
        'profiles',
        'privacy_request_events',
        'privacy_requests',
        'push_devices',
        'region_policies',
        'region_waitlist_entries',
        'region_verifications',
        'reward_awards',
        'reward_catalog_items',
        'reward_coupon_codes',
        'session_events',
        'social_challenge_checkins',
        'social_challenge_members',
        'social_challenges',
        'social_relationship_events',
        'user_blocks',
        'users',
        'worker_heartbeats',
        'workout_sessions',
        'cash_fulfillments',
        'competition_gym_locations',
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

  it('installs the privacy-preserving static QR pilot schema', async () => {
    const scanColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'gym_scan_events'
       ORDER BY column_name`,
    );
    const names = scanColumns.rows.map((row) => row.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'client_event_hash',
        'credential_version',
        'gym_location_id',
        'outcome',
        'scan_type',
        'server_timestamp',
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining(['accuracy_meters', 'latitude', 'longitude']),
    );

    const userReset = await pool.query<{ data_type: string }>(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'pilot_onboarding_reset_at'`,
    );
    expect(userReset.rows).toEqual([{ data_type: 'timestamp with time zone' }]);
  });

  it('installs tenant-scoped gym partner access and proposal constraints', async () => {
    const constraints = await pool.query<{ conname: string }>(
      `SELECT conname
       FROM pg_constraint
       WHERE conname IN (
         'competitions_region_month_unique',
         'gym_partner_assignments_access_level',
         'gym_partner_assignments_pk',
         'partner_competition_proposals_lifecycle_complete',
         'partner_competition_proposals_month_key_format',
         'partner_competition_proposals_status',
         'partner_competition_proposals_version_positive'
       )`,
    );
    const names = constraints.rows.map((row) => row.conname);

    expect(names).toEqual(
      expect.arrayContaining([
        'gym_partner_assignments_access_level',
        'gym_partner_assignments_pk',
        'partner_competition_proposals_lifecycle_complete',
        'partner_competition_proposals_month_key_format',
        'partner_competition_proposals_status',
        'partner_competition_proposals_version_positive',
      ]),
    );
    expect(names).not.toContain('competitions_region_month_unique');

    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'partner_competition_proposals_active_gym_month_unique',
           'partner_competition_proposals_portal_page_idx'
         )`,
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'partner_competition_proposals_active_gym_month_unique',
        'partner_competition_proposals_portal_page_idx',
      ]),
    );

    const provenanceTrigger = await pool.query<{ tgname: string }>(
      `SELECT tgname
       FROM pg_trigger
       WHERE tgname = 'partner_competition_proposals_provenance_immutable'
         AND NOT tgisinternal`,
    );
    expect(provenanceTrigger.rows).toEqual([
      { tgname: 'partner_competition_proposals_provenance_immutable' },
    ]);
  });

  it('keeps obsolete demo and payment schema out of the release baseline', async () => {
    const obsoleteTables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [
        [
          'demo_verification_checkpoints',
          'draw_winners',
          'hyperwallet_users',
          'payout_claims',
          'payout_payments',
          'payout_release_control',
          'payout_state_events',
          'provider_webhooks',
        ],
      ],
    );
    const obsoleteColumns = await pool.query<{
      column_name: string;
      table_name: string;
    }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'competitions' AND column_name IN ('currency', 'mode'))
           OR
           (table_name = 'region_policies' AND column_name = 'payout_enabled')
         )`,
    );
    const obsoleteTypes = await pool.query<{ typname: string }>(
      `SELECT typname
       FROM pg_type
       WHERE typname = ANY($1::text[])`,
      [['competition_mode', 'payout_claim_status', 'provider_webhook_state']],
    );

    expect(obsoleteTables.rows).toEqual([]);
    expect(obsoleteColumns.rows).toEqual([]);
    expect(obsoleteTypes.rows).toEqual([]);
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
           'profiles_screen_name_trgm_idx',
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
          'social_challenges_name_valid',
          'profiles_screen_name_not_reserved',
          'challenge_contact_invitation_integrity',
          'challenge_contact_invitation_creation_key_unique',
          'user_blocks_distinct_users',
          'user_blocks_unique_pair'
       )`,
    );

    expect(profileColumn.rows).toEqual([
      { data_type: 'USER-DEFINED', is_nullable: 'NO' },
    ]);
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'friend_requests_one_pending_pair',
        'profiles_screen_name_trgm_idx',
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
        'profiles_screen_name_not_reserved',
        'challenge_contact_invitation_integrity',
        'challenge_contact_invitation_creation_key_unique',
        'user_blocks_distinct_users',
        'user_blocks_unique_pair',
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

  it('installs the notification-delivery lease contract', async () => {
    const columns = await pool.query<{
      column_name: string;
      data_type: string;
    }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'notification_deliveries'
         AND column_name IN ('lease_expires_at', 'lease_token')
       ORDER BY column_name`,
    );
    const constraint = await pool.query<{ conname: string }>(
      `SELECT conname
       FROM pg_constraint
       WHERE conname = 'notification_deliveries_lease_pair'`,
    );
    const index = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'notification_deliveries_claimable_idx'`,
    );

    expect(columns.rows).toEqual([
      {
        column_name: 'lease_expires_at',
        data_type: 'timestamp with time zone',
      },
      { column_name: 'lease_token', data_type: 'uuid' },
    ]);
    expect(constraint.rows).toEqual([
      { conname: 'notification_deliveries_lease_pair' },
    ]);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toMatch(
      /\(status, scheduled_at, lease_expires_at\).*WHERE.*attempt_count < 5/i,
    );
  });

  it('installs notification device lifecycle and duplicate-suppression constraints', async () => {
    const deviceColumns = await pool.query<{
      column_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'push_devices'
         AND column_name IN (
           'disabled_at', 'installation_id', 'last_registered_at', 'push_token'
         )
       ORDER BY column_name`,
    );
    const deliveryColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'notification_deliveries'
         AND column_name IN (
           'completed_device_ids', 'dedupe_key', 'delivered_count',
           'target_device_ids'
         )
       ORDER BY column_name`,
    );
    const constraints = await pool.query<{ conname: string }>(
      `SELECT conname
       FROM pg_constraint
       WHERE conname IN (
         'notification_deliveries_attempt_bounded',
         'notification_deliveries_device_progress_valid',
         'push_devices_enabled_token_state'
       )`,
    );
    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'notification_deliveries_user_dedupe_unique',
           'push_devices_active_token_unique',
           'push_devices_user_installation_unique'
         )`,
    );

    expect(deviceColumns.rows).toEqual([
      { column_name: 'disabled_at', is_nullable: 'YES' },
      { column_name: 'installation_id', is_nullable: 'NO' },
      { column_name: 'last_registered_at', is_nullable: 'NO' },
      { column_name: 'push_token', is_nullable: 'YES' },
    ]);
    expect(deliveryColumns.rows.map((row) => row.column_name)).toEqual([
      'completed_device_ids',
      'dedupe_key',
      'delivered_count',
      'target_device_ids',
    ]);
    expect(constraints.rows.map((row) => row.conname)).toEqual(
      expect.arrayContaining([
        'notification_deliveries_attempt_bounded',
        'notification_deliveries_device_progress_valid',
        'push_devices_enabled_token_state',
      ]),
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'notification_deliveries_user_dedupe_unique',
        'push_devices_active_token_unique',
        'push_devices_user_installation_unique',
      ]),
    );
  });

  it('enforces private device state and notification deduplication at the database boundary', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid)
       VALUES ('notification-lifecycle-user')
       RETURNING id`,
    );
    const installationId = 'a0000000-0000-4000-8000-000000000001';
    const pushToken = 'ExponentPushToken[integration-device-one]';
    const device = await pool.query<{ id: string }>(
      `INSERT INTO push_devices
         (user_id, provider, platform, push_token, installation_id,
          last_registered_at)
       VALUES ($1, 'expo', 'ios', $2, $3, current_timestamp)
       RETURNING id`,
      [user.rows[0].id, pushToken, installationId],
    );

    await expect(
      pool.query(
        `INSERT INTO push_devices
           (user_id, provider, platform, push_token, installation_id,
            last_registered_at)
         VALUES ($1, 'expo', 'ios', $2, $3, current_timestamp)`,
        [
          user.rows[0].id,
          'ExponentPushToken[integration-device-two]',
          installationId,
        ],
      ),
    ).rejects.toThrow(/push_devices_user_installation_unique/i);
    await expect(
      pool.query(
        `UPDATE push_devices
         SET enabled = FALSE
         WHERE id = $1`,
        [device.rows[0].id],
      ),
    ).rejects.toThrow(/push_devices_enabled_token_state/i);
    await pool.query(
      `UPDATE push_devices
       SET enabled = FALSE, push_token = NULL, disabled_at = current_timestamp
       WHERE id = $1`,
      [device.rows[0].id],
    );

    await pool.query(
      `INSERT INTO notification_deliveries
         (user_id, template, payload, dedupe_key, scheduled_at)
       VALUES (
         $1, 'competition_cancelled', '{}', 'competition:one:cancelled',
         current_timestamp
       )`,
      [user.rows[0].id],
    );
    await expect(
      pool.query(
        `INSERT INTO notification_deliveries
           (user_id, template, payload, dedupe_key, scheduled_at)
         VALUES (
           $1, 'competition_cancelled', '{}', 'competition:one:cancelled',
           current_timestamp
         )`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/notification_deliveries_user_dedupe_unique/i);
    await expect(
      pool.query(
        `INSERT INTO notification_deliveries
           (user_id, template, payload, dedupe_key, attempt_count, scheduled_at)
         VALUES (
           $1, 'competition_cancelled', '{}', 'competition:two:cancelled', 6,
           current_timestamp
         )`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/notification_deliveries_attempt_bounded/i);
  });

  it('installs partial indexes for bounded worker queue scans', async () => {
    const indexes = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'profile_media_cleanup_queue_idx',
           'workout_sessions_competition_date_unresolved_idx',
           'workout_sessions_competition_date_verified_idx'
         )`,
    );

    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'profile_media_cleanup_queue_idx',
        'workout_sessions_competition_date_unresolved_idx',
        'workout_sessions_competition_date_verified_idx',
      ]),
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
           boundary_version, policy_version, boundary, valid_from)
       VALUES
         ('version-region', 'US', 'WA', 'Version Region', 'USD',
           'America/Los_Angeles', ARRAY['en-US'], 18, TRUE,
          'boundary-v1', 'policy-v1',
          ST_GeogFromText(
            'SRID=4326;MULTIPOLYGON(((-122.6 47.4,-122.0 47.4,-122.0 47.9,-122.6 47.9,-122.6 47.4)))'
          ),
          '2026-01-01T00:00:00.000Z')
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
        'competition_settlement_inputs_append_only',
        'entry_ledger_append_only',
        'entry_ledger_verified_session_source',
        'legal_document_events_append_only',
        'legal_documents_append_only',
        'operator_audit_events_append_only',
        'reward_award_row_integrity',
        'reward_award_settled_draw_integrity',
        'reward_awards_inventory_guard',
        'reward_catalog_publication_integrity',
        'reward_catalog_row_integrity',
        'reward_coupon_code_integrity',
        'privacy_request_events_append_only',
        'privacy_request_transition_integrity',
        'session_events_append_only',
        'workout_sessions_scoring_identity',
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
      `INSERT INTO privacy_requests
         (user_id, request_type, confirmation_code, confirmed_at)
       VALUES ($1, 'export', 'EXPORT_MY_DATA', current_timestamp)
       RETURNING id`,
      [user.rows[0].id],
    );

    await expect(
      pool.query(
        `INSERT INTO privacy_requests
           (user_id, request_type, confirmation_code, confirmed_at)
         VALUES ($1, 'delete', 'DELETE_MY_ACCOUNT', current_timestamp)`,
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

  it('requires exact privacy confirmation and versioned lifecycle transitions', async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid)
       VALUES ('privacy-confirmation-user')
       RETURNING id`,
    );
    await expect(
      pool.query(
        `INSERT INTO privacy_requests
           (user_id, request_type, confirmation_code, confirmed_at)
         VALUES ($1, 'delete', 'EXPORT_MY_DATA', current_timestamp)`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/privacy_requests_confirmation_matches_operation/i);

    const request = await pool.query<{ id: string }>(
      `INSERT INTO privacy_requests
         (user_id, request_type, confirmation_code, confirmed_at)
       VALUES ($1, 'delete', 'DELETE_MY_ACCOUNT', current_timestamp)
       RETURNING id`,
      [user.rows[0].id],
    );
    await expect(
      pool.query(
        `UPDATE privacy_requests SET status = 'processing' WHERE id = $1`,
        [request.rows[0].id],
      ),
    ).rejects.toThrow(/status transition must advance version/i);
    await pool.query(
      `UPDATE privacy_requests
       SET status = 'processing', version = version + 1
       WHERE id = $1`,
      [request.rows[0].id],
    );
    await pool.query(
      `UPDATE privacy_requests
       SET status = 'rejected', version = version + 1
       WHERE id = $1`,
      [request.rows[0].id],
    );
    await expect(
      pool.query(
        `UPDATE privacy_requests
         SET status = 'processing', version = version + 1
         WHERE id = $1`,
        [request.rows[0].id],
      ),
    ).rejects.toThrow(/terminal privacy request status is immutable/i);
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
         VALUES ($1, 'too-large', 'avatars/' || $1::uuid::text || '/too-large.jpg', 'image/jpeg',
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
         VALUES ($1, 'invalid-approval', 'avatars/' || $1::uuid::text || '/invalid-approval.jpg', 'image/jpeg',
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
            status, expires_at, completed_at)
         VALUES ($1, 'uninspected-review',
                 'avatars/' || $1::uuid::text || '/uninspected-review.jpg', 'image/jpeg',
                 512, 512, 'generation-uninspected', 'pending_review',
                 current_timestamp + interval '5 minutes', current_timestamp)`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/profile_media_review_state_inspected/i);

    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, actual_size_bytes, storage_generation,
            content_sha256, image_height, image_width, inspection_version,
            status, expires_at, completed_at, reviewed_at,
            reviewed_by_user_id, decision_reason)
         VALUES ($1, 'approved-one', 'avatars/' || $1::uuid::text || '/approved-one.jpg', 'image/jpeg',
                 512, 512, 'generation-one', repeat('a', 64), 640, 640,
                 'avatar-image-v1', 'approved',
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
            content_sha256, image_height, image_width, inspection_version,
            status, expires_at, completed_at, reviewed_at,
            reviewed_by_user_id, decision_reason)
         VALUES ($1, 'approved-two', 'avatars/' || $1::uuid::text || '/approved-two.jpg', 'image/jpeg',
                 512, 512, 'generation-two', repeat('b', 64), 640, 640,
                 'avatar-image-v1', 'approved',
                 current_timestamp + interval '5 minutes', current_timestamp,
                 current_timestamp, $1, 'constraint test approval')`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/profile_media_one_approved_per_user/i);

    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, status, expires_at)
         VALUES ($1, 'pending-one', 'avatars/' || $1::uuid::text || '/pending-one.jpg',
                 'image/jpeg', 512, 'pending_upload',
                 current_timestamp + interval '5 minutes')`,
        [user.rows[0].id],
      ),
    ).resolves.toBeDefined();
    await expect(
      pool.query(
        `INSERT INTO profile_media
           (user_id, request_key, object_key, content_type,
            expected_size_bytes, status, expires_at)
         VALUES ($1, 'pending-two', 'avatars/' || $1::uuid::text || '/pending-two.jpg',
                 'image/jpeg', 512, 'pending_upload',
                 current_timestamp + interval '5 minutes')`,
        [user.rows[0].id],
      ),
    ).rejects.toThrow(/profile_media_one_live_candidate_per_user/i);
  });
});

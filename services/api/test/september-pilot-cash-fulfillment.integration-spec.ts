import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import { GymsService } from '../src/modules/gyms/gyms.service';
import type { LedgerService } from '../src/modules/ledger/ledger.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  award: '10000000-0000-4000-8000-000000000002',
  competition: '10000000-0000-4000-8000-000000000003',
  draw: '10000000-0000-4000-8000-000000000004',
  region: '10000000-0000-4000-8000-000000000005',
  reward: '10000000-0000-4000-8000-000000000006',
  winner: '10000000-0000-4000-8000-000000000007',
};

const principal: AuthenticatedPrincipal = {
  email: 'cash-admin@example.test',
  emailVerified: true,
  firebaseUid: 'cash-admin-integration',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const request = {
  amountCents: 10_000,
  currency: 'CAD',
  expectedVersion: 1,
  reason: 'Cash handed to the settled winner in person.',
  rewardAwardId: ids.award,
};

describeWithDatabase('September pilot manual cash fulfillment', () => {
  jest.setTimeout(120_000);

  let migrated: MigratedPostgisTestDatabase;
  let database: DatabaseService;
  let service: GymsService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const profiles = new ProfilesService(database);
    const authorization = new AdminAuthorizationService(profiles);
    service = new GymsService(
      database,
      new IdempotencyService(database),
      {} as LedgerService,
      profiles,
      authorization,
    );
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  beforeEach(async () => {
    await seedSettledPilotAward(migrated);
  });

  it('records once, returns a stable body-bound replay, and keeps audit private and minimized', async () => {
    const first = await service.recordCashFulfillment(
      principal,
      'cash-stable-replay',
      request,
    );
    const replay = await service.recordCashFulfillment(
      principal,
      'cash-stable-replay',
      request,
    );

    expect(replay).toEqual(first);
    await expect(
      service.recordCashFulfillment(principal, 'cash-stable-replay', {
        ...request,
        reason: 'A different handoff body must not replay.',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });
    const evidence = await migrated.pool.query<{
      award_count: string;
      audit_count: string;
      fulfillment_count: string;
      next_state: Record<string, unknown>;
      status: string;
      version: number;
    }>(
      `SELECT
         (SELECT count(*) FROM reward_awards WHERE id = $1)::text AS award_count,
         (SELECT count(*) FROM cash_fulfillments WHERE reward_award_id = $1)::text AS fulfillment_count,
         (SELECT count(*) FROM operator_audit_events
           WHERE entity_type = 'cash_fulfillments'
             AND action = 'cash_fulfillment.recorded')::text AS audit_count,
         award.status::text, award.version, audit.next_state
       FROM reward_awards AS award
       JOIN cash_fulfillments AS cash ON cash.reward_award_id = award.id
       JOIN operator_audit_events AS audit
         ON audit.entity_id = cash.id
        AND audit.entity_type = 'cash_fulfillments'
       WHERE award.id = $1`,
      [ids.award],
    );
    expect(evidence.rows[0]).toMatchObject({
      audit_count: '1',
      award_count: '1',
      fulfillment_count: '1',
      status: 'fulfilled',
      version: 2,
    });
    expect(evidence.rows[0]?.next_state).toEqual({
      amountCents: 10_000,
      currency: 'CAD',
      recordedHandoffOnly: true,
      rewardAwardId: ids.award,
      rewardAwardVersion: 2,
    });
  });

  it('serializes concurrent attempts so only one handoff can commit', async () => {
    const attempts = await Promise.allSettled([
      service.recordCashFulfillment(principal, 'cash-concurrent-a', request),
      service.recordCashFulfillment(principal, 'cash-concurrent-b', request),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(1);
    await expect(
      migrated.pool.query(
        'SELECT id FROM cash_fulfillments WHERE reward_award_id = $1',
        [ids.award],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('fails closed for a non-admin, wrong value, and stale Award version', async () => {
    await expect(
      service.recordCashFulfillment(
        { ...principal, firebaseUid: 'not-an-admin' },
        'cash-no-admin',
        request,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ADMIN_REQUIRED' }),
    });
    await expect(
      service.recordCashFulfillment(principal, 'cash-wrong-value', {
        ...request,
        amountCents: 9_999,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PILOT_CASH_AMOUNT_INVALID' }),
    });
    await expect(
      service.recordCashFulfillment(principal, 'cash-stale-version', {
        ...request,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'REWARD_AWARD_VERSION_CONFLICT',
      }),
    });
    await expect(
      migrated.pool.query('SELECT id FROM cash_fulfillments'),
    ).resolves.toMatchObject({ rowCount: 0 });
  });

  it('rolls back a failed audit and permits recovery with the same key', async () => {
    await migrated.pool.query(`
      CREATE FUNCTION ggg_test_reject_cash_audit() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'cash_fulfillment.recorded' THEN
          RAISE EXCEPTION 'test cash audit failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER ggg_test_reject_cash_audit
      BEFORE INSERT ON operator_audit_events
      FOR EACH ROW EXECUTE FUNCTION ggg_test_reject_cash_audit();
    `);
    try {
      await expect(
        service.recordCashFulfillment(principal, 'cash-recovery', request),
      ).rejects.toThrow(/test cash audit failure/i);
    } finally {
      await migrated.pool.query(`
        DROP TRIGGER IF EXISTS ggg_test_reject_cash_audit ON operator_audit_events;
        DROP FUNCTION IF EXISTS ggg_test_reject_cash_audit();
      `);
    }
    const rolledBack = await migrated.pool.query<{
      award_status: string;
      fulfillment_count: string;
      key_count: string;
    }>(
      `SELECT award.status::text AS award_status,
              (SELECT count(*) FROM cash_fulfillments)::text AS fulfillment_count,
              (SELECT count(*) FROM idempotency_keys)::text AS key_count
       FROM reward_awards AS award WHERE award.id = $1`,
      [ids.award],
    );
    expect(rolledBack.rows[0]).toEqual({
      award_status: 'awarded',
      fulfillment_count: '0',
      key_count: '0',
    });

    await expect(
      service.recordCashFulfillment(principal, 'cash-recovery', request),
    ).resolves.toMatchObject({ rewardAwardId: ids.award });
  });

  it('rejects wrong-owner evidence and makes committed fulfillment immutable', async () => {
    await expect(
      migrated.pool.query(
        `UPDATE reward_catalog_items
         SET status = 'archived', version = version + 1
         WHERE id = $1`,
        [ids.reward],
      ),
    ).rejects.toMatchObject({
      constraint: 'september_pilot_exact_cash_reward',
    });
    await expect(
      migrated.pool.query(
        `INSERT INTO cash_fulfillments
           (reward_award_id, reward_award_version, competition_id,
            winner_user_id, amount_cents, currency, fulfilled_by_user_id,
            fulfilled_at, fulfillment_note, created_at)
         VALUES ($1, 1, $2, gen_random_uuid(), 10000, 'CAD', $3,
                 now(), 'Wrong winner must fail closed.', now())`,
        [ids.award, ids.competition, ids.admin],
      ),
    ).rejects.toMatchObject({
      constraint: 'cash_fulfillment_settled_award_integrity',
    });

    const fulfilled = await service.recordCashFulfillment(
      principal,
      'cash-immutable',
      request,
    );
    await expect(
      migrated.pool.query(
        'UPDATE cash_fulfillments SET fulfillment_note = $1 WHERE id = $2',
        ['Changed evidence is forbidden.', fulfilled.id],
      ),
    ).rejects.toMatchObject({ constraint: 'cash_fulfillments_append_only' });
    await expect(
      migrated.pool.query('DELETE FROM cash_fulfillments WHERE id = $1', [
        fulfilled.id,
      ]),
    ).rejects.toMatchObject({ constraint: 'cash_fulfillments_append_only' });
  });
});

async function seedSettledPilotAward(
  migrated: MigratedPostgisTestDatabase,
): Promise<void> {
  const client = await migrated.pool.connect();
  try {
    await client.query(`
      TRUNCATE TABLE users, region_policies, competitions,
        reward_catalog_items, competition_draws,
        draw_reward_catalog_snapshots, draw_reward_slots,
        draw_public_identities, reward_awards, cash_fulfillments,
        operator_audit_events, idempotency_keys
      RESTART IDENTITY CASCADE;
    `);
    await client.query("SET session_replication_role = 'replica'");
    await client.query(
      `INSERT INTO users
         (id, firebase_uid, email, email_verified, roles, status)
       VALUES
         ($1, 'cash-admin-integration', 'cash-admin@example.test', true,
          ARRAY['admin'], 'active'),
         ($2, 'cash-winner-integration', 'cash-winner@example.test', true,
          ARRAY['user'], 'active')`,
      [ids.admin, ids.winner],
    );
    await client.query(
      `INSERT INTO region_policies
         (id, code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          boundary_version, policy_version, boundary, valid_from)
       VALUES
         ($1, 'vancouver-island-gulf-islands-bc', 'CA', 'BC',
          'Vancouver Island + Gulf Islands', 'CAD', 'America/Vancouver',
          ARRAY['en-CA'], 19, true, 'cash-test-boundary-v1',
          '2026-09-pilot-v1',
          ST_GeomFromText('MULTIPOLYGON(((-124 48,-123 48,-123 49,-124 49,-124 48)))', 4326),
          '2026-01-01')`,
      [ids.region],
    );
    await client.query(
      `INSERT INTO competitions
         (id, region_policy_id, month_key, name, status, rules_version, rules,
          minimum_entrants, registration_opens_at, registration_closes_at,
          starts_at, ends_at)
       VALUES
         ($1, $2, '2026-09', 'GoGymGo September 2026 Island Pilot',
          'settled', '2026-09-pilot-v1', '{}'::jsonb, 1,
          '2026-08-01T07:00:00Z', '2026-09-01T07:00:00Z',
          '2026-09-01T07:00:00Z', '2026-10-01T07:00:00Z')`,
      [ids.competition, ids.region],
    );
    await client.query(
      `INSERT INTO reward_catalog_items
         (id, competition_id, sponsor_name, title, description, reward_type,
          cash_amount_cents, cash_currency, status, image_url, terms_url,
          fulfillment_instructions, inventory_total, display_order, version)
       VALUES
         ($1, $2, 'GoGymGo', 'GoGymGo $100 CAD Cash Reward',
          'Approved integration cash reward.', 'cash', 10000, 'CAD',
          'published', 'https://cdn.gogymgo.test/cash.jpg',
          'https://gogymgo.test/rules/cash',
          'Hand cash to the settled winner in person.', 1, 1, 2)`,
      [ids.reward, ids.competition],
    );
    await client.query(
      `INSERT INTO competition_draws
         (id, competition_id, status, rules_version, seed_commitment,
          seed_reveal, entrant_snapshot_hash, scoring_snapshot_hash,
          reward_snapshot_hash, public_result_snapshot_hash, entrant_count,
          total_entries, reward_slot_count, locked_at,
          snapshot_finalized_at, settled_at)
       VALUES
         ($1, $2, 'settled', '2026-09-pilot-v1', repeat('a', 64),
          repeat('b', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64),
          repeat('f', 64), 1, 1, 1, '2026-10-02', '2026-10-02',
          '2026-10-02')`,
      [ids.draw, ids.competition],
    );
    await client.query(
      `INSERT INTO draw_reward_catalog_snapshots
         (draw_id, reward_catalog_item_id, catalog_version, sponsor_name,
          title, reward_type, cash_amount_cents, cash_currency, inventory_total,
          display_order, available_slot_count)
       VALUES
         ($1, $2, 2, 'GoGymGo', 'GoGymGo $100 CAD Cash Reward', 'cash',
          10000, 'CAD', 1, 1, 1)`,
      [ids.draw, ids.reward],
    );
    await client.query(
      `INSERT INTO draw_reward_slots
         (draw_id, slot_position, reward_catalog_item_id,
          catalog_slot_position)
       VALUES ($1, 1, $2, 1)`,
      [ids.draw, ids.reward],
    );
    await client.query(
      `INSERT INTO draw_public_identities
         (draw_id, user_id, alias, streak_daily, streak_weekly,
          streak_monthly, streak_yearly, streak_projection_version)
       VALUES ($1, $2, 'CASH_WINNER', 1, 1, 1, 1, 'streaks-v1')`,
      [ids.draw, ids.winner],
    );
    await client.query(
      `INSERT INTO reward_awards
         (id, draw_id, reward_catalog_item_id, user_id, award_rank, status,
          awarded_at, version)
       VALUES ($1, $2, $3, $4, 1, 'awarded', '2026-10-02', 1)`,
      [ids.award, ids.draw, ids.reward, ids.winner],
    );
  } finally {
    await client.query("SET session_replication_role = 'origin'");
    client.release();
  }
}

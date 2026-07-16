import type { Pool, PoolClient } from 'pg';

export const BC_DEMO_REGION_CODE = 'CA-BC-DEMO';
export const BC_DEMO_POLICY_VERSION = 'bc-brand-rewards-v1';
export const BC_DEMO_RULES_VERSION = 'bc-brand-rewards-v1';

const REGION_LOCK_KEY = 'gogymgo:bc-brand-rewards-foundation';
const OPERATOR_LOCK_KEY = 'gogymgo:bc-demo-operator';
const REGION_VALID_FROM = new Date('2026-01-01T08:00:00.000Z');
const COMPETITION_NAME = 'BC Brand Rewards Challenge';
const REWARD_TITLE = 'GoGymGo Starter Pack';
const GOAL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const RULES = {
  minHeartRateSamples: 0,
  minSessionMinutes: 10,
  requireDeviceAttestation: false,
  requireFaceCheck: false,
  requireGymQr: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
} as const;

export interface BcDemoFoundationResult {
  competitionCreated: boolean;
  competitionId: string;
  competitionStatus: 'registration';
  monthKey: string;
  regionCreated: boolean;
  regionPolicyId: string;
  rewardCreated: boolean;
  rewardId: string;
  safety: {
    brandRewardsOnly: true;
    competitionEnabled: true;
  };
}

export interface BcDemoOperatorResult {
  changed: boolean;
  roles: ['operator', 'user'];
}

export function assertLocalDatabaseUrl(
  databaseUrl: string,
  operation: string,
): void {
  const hostname = new URL(databaseUrl).hostname;
  if (!['127.0.0.1', '::1', 'localhost'].includes(hostname)) {
    throw new Error(
      `${operation} is local-only and refuses a remote database host.`,
    );
  }
}

export function getDefaultBcDemoMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: 'America/Vancouver',
    year: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export async function bootstrapBcDemoFoundation(
  pool: Pool,
  monthKey: string,
  reason: string,
): Promise<BcDemoFoundationResult> {
  assertMonthKey(monthKey);
  assertReason(reason);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      REGION_LOCK_KEY,
    ]);

    const regionResult = await client.query<{ id: string }>(
      `SELECT id FROM region_policies WHERE code = $1 ORDER BY valid_from DESC LIMIT 1`,
      [BC_DEMO_REGION_CODE],
    );
    const regionCreated = regionResult.rowCount === 0;
    const regionPolicyId = regionCreated
      ? await createRegion(client)
      : regionResult.rows[0].id;

    if (!regionCreated) {
      const state = await client.query<{
        competition_enabled: boolean;
        valid_to: Date | null;
      }>(
        `SELECT competition_enabled, valid_to FROM region_policies WHERE id = $1`,
        [regionPolicyId],
      );
      if (!state.rows[0]?.competition_enabled || state.rows[0].valid_to) {
        throw new Error(
          'The existing BC demo region is not in the required active brand-reward state.',
        );
      }
    }

    const competitionResult = await client.query<{
      id: string;
      status: 'registration';
    }>(
      `SELECT id, status
       FROM competitions
       WHERE region_policy_id = $1 AND month_key = $2`,
      [regionPolicyId, monthKey],
    );
    const competitionCreated = competitionResult.rowCount === 0;
    const competition = competitionCreated
      ? await createCompetition(client, regionPolicyId, monthKey)
      : competitionResult.rows[0];
    if (competition.status !== 'registration') {
      throw new Error(
        'The existing BC demo competition is not open for registration.',
      );
    }

    const rewardResult = await client.query<{ id: string }>(
      `SELECT id
       FROM reward_catalog_items
       WHERE competition_id = $1 AND title = $2`,
      [competition.id, REWARD_TITLE],
    );
    const rewardCreated = rewardResult.rowCount === 0;
    const rewardId = rewardCreated
      ? await createReward(client, competition.id)
      : rewardResult.rows[0].id;

    await client.query(
      `INSERT INTO operator_audit_events
         (actor_user_id, action, entity_type, entity_id,
          previous_state, next_state, reason, request_id)
       VALUES
         (NULL, 'foundation.brand_rewards_ready', 'competitions', $1,
          NULL, $2::jsonb, $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        competition.id,
        JSON.stringify({ regionCode: BC_DEMO_REGION_CODE, rewardId }),
        reason.trim(),
        `foundation:brand-rewards:${monthKey}`,
      ],
    );
    await client.query('COMMIT');
    return {
      competitionCreated,
      competitionId: competition.id,
      competitionStatus: 'registration',
      monthKey,
      regionCreated,
      regionPolicyId,
      rewardCreated,
      rewardId,
      safety: { brandRewardsOnly: true, competitionEnabled: true },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function bootstrapBcDemoOperator(
  pool: Pool,
  firebaseUid: string,
  reason: string,
): Promise<BcDemoOperatorResult> {
  assertReason(reason);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      OPERATOR_LOCK_KEY,
    ]);
    const userResult = await client.query<{
      email_verified: boolean;
      id: string;
      roles: string[];
      status: string;
    }>(
      `SELECT id, email_verified, roles, status
       FROM users
       WHERE firebase_uid = $1
       FOR UPDATE`,
      [firebaseUid.trim()],
    );
    const user = userResult.rows[0];
    if (!user || !user.email_verified || user.status !== 'active') {
      throw new Error(
        'BC demo operator bootstrap requires an active, email-verified existing user.',
      );
    }
    const roles: ['operator', 'user'] = ['operator', 'user'];
    const changed =
      user.roles.length !== roles.length ||
      roles.some((role) => !user.roles.includes(role));
    if (changed) {
      await client.query(
        `UPDATE users SET roles = $1, updated_at = NOW() WHERE id = $2`,
        [roles, user.id],
      );
      await client.query(
        `INSERT INTO operator_audit_events
           (actor_user_id, action, entity_type, entity_id,
            previous_state, next_state, reason, request_id)
         VALUES ($1, 'user.bc_demo_operator_bootstrapped', 'users', $1,
                 $2::jsonb, $3::jsonb, $4, $5)`,
        [
          user.id,
          JSON.stringify({ roles: user.roles }),
          JSON.stringify({ roles }),
          reason.trim(),
          `foundation:bc-demo-operator:${user.id}`,
        ],
      );
    }
    await client.query('COMMIT');
    return { changed, roles };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createRegion(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO region_policies
       (code, country_code, subdivision_code, metro_name, currency, timezone,
        language_codes, minimum_age, competition_enabled, boundary_version,
        policy_version, boundary, valid_from, valid_to)
     VALUES
       ($1, 'CA', 'BC', 'British Columbia Demo', 'CAD', 'America/Vancouver',
        ARRAY['en-CA'], 19, TRUE, 'bc-demo-boundary-v1', $2,
        ST_GeogFromText('POLYGON((-139 48,-114 48,-114 60,-139 60,-139 48))'),
        $3, NULL)
     RETURNING id`,
    [BC_DEMO_REGION_CODE, BC_DEMO_POLICY_VERSION, REGION_VALID_FROM],
  );
  return result.rows[0].id;
}

async function createCompetition(
  client: PoolClient,
  regionPolicyId: string,
  monthKey: string,
): Promise<{ id: string; status: 'registration' }> {
  const { startsAt, endsAt, registrationOpensAt, registrationClosesAt } =
    competitionDates(monthKey);
  const result = await client.query<{ id: string; status: 'registration' }>(
    `INSERT INTO competitions
       (region_policy_id, month_key, name, status, rules_version, rules,
        minimum_entrants, entrant_cap, registration_opens_at,
        registration_closes_at, starts_at, ends_at)
     VALUES ($1, $2, $3, 'registration', $4, $5::jsonb,
             100, 10000, $6, $7, $8, $9)
     RETURNING id, status`,
    [
      regionPolicyId,
      monthKey,
      COMPETITION_NAME,
      BC_DEMO_RULES_VERSION,
      JSON.stringify(RULES),
      registrationOpensAt,
      registrationClosesAt,
      startsAt,
      endsAt,
    ],
  );
  await client.query(
    `INSERT INTO competition_goal_brackets
       (competition_id, goal_days, label)
     SELECT $1, goal_day, goal_day || ' days per week'
     FROM unnest($2::smallint[]) AS goal_day`,
    [result.rows[0].id, GOAL_DAYS],
  );
  return result.rows[0];
}

async function createReward(
  client: PoolClient,
  competitionId: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO reward_catalog_items
       (competition_id, sponsor_name, title, description, reward_type, status,
        image_url, terms_url, claim_url, fulfillment_instructions,
        inventory_total, display_order, version)
     VALUES
       ($1, 'GoGymGo Partner', $2,
        'A demo bundle of gym accessories supplied by a participating brand.',
        'physical', 'published', NULL, NULL, NULL,
        'The local demo operator will coordinate pickup. No banking details are required.',
        25, 1, 1)
     RETURNING id`,
    [competitionId, REWARD_TITLE],
  );
  return result.rows[0].id;
}

function competitionDates(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const startsAt = new Date(Date.UTC(year, month - 1, 1, 8));
  const endsAt = new Date(Date.UTC(year, month, 1, 8));
  return {
    endsAt,
    registrationClosesAt: startsAt,
    registrationOpensAt: new Date(startsAt.getTime() - 28 * 86_400_000),
    startsAt,
  };
}

function assertMonthKey(monthKey: string): void {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new Error('BC demo competition month must use YYYY-MM format.');
  }
}

function assertReason(reason: string): void {
  if (reason.trim().length < 12 || reason.trim().length > 500) {
    throw new Error(
      'A bootstrap reason between 12 and 500 characters is required.',
    );
  }
}

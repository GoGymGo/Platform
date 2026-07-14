import type { Pool, PoolClient } from 'pg';
import { parseCompetitionRules } from '../modules/competitions/competition-rules';

export const BC_DEMO_REGION_CODE = 'CA-BC-DEMO';
export const BC_DEMO_POLICY_VERSION = 'bc-demo-foundation-v1';
export const BC_DEMO_RULES_VERSION = 'bc-demo-non-cash-v1';

const REGION_LOCK_KEY = 'gogymgo:bc-demo-foundation';
const REGION_VALID_FROM = new Date('2026-01-01T08:00:00.000Z');
const COMPETITION_NAME = 'BC NON-CASH DEMO - NO PRIZES';
const LEGACY_COMPETITION_NAME = 'BC SAFE DEMO DRAFT - DO NOT PUBLISH';
const LEGACY_RULES_VERSION = 'bc-demo-disabled-v1';
const GOAL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const RULES = {
  minSessionMinutes: 10,
  minHeartRateSamples: 0,
  requireDeviceAttestation: false,
  requireFaceCheck: false,
  requireGymQr: false,
  signupPrizeDrawEntries: 0,
  verifiedSessionCategoryScore: 0,
  verifiedSessionPrizeDrawEntries: 0,
  payoutPoolAmountMinor: 0,
  payoutWinnerCount: 0,
  payoutExponent: 0,
} as const;

interface RegionRow {
  boundary_is_null: boolean;
  boundary_version: string;
  code: string;
  competition_enabled: boolean;
  country_code: string;
  currency: string;
  id: string;
  language_codes: string[];
  metro_name: string;
  minimum_age: number;
  payout_enabled: boolean;
  policy_version: string;
  subdivision_code: string;
  timezone: string;
  valid_to: Date | null;
}

interface CompetitionRow {
  currency: string;
  id: string;
  minimum_entrants: number;
  mode: string;
  name: string;
  rules: unknown;
  rules_version: string;
  status: string;
}

export interface BcDemoFoundationResult {
  competitionCreated: boolean;
  competitionId: string;
  competitionStatus: 'registration';
  competitionUpdated: boolean;
  monthKey: string;
  regionCreated: boolean;
  regionPolicyId: string;
  safety: {
    competitionEnabled: false;
    payoutEnabled: false;
  };
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
  if (reason.trim().length < 8 || reason.length > 500) {
    throw new Error('The bootstrap reason must contain 8 to 500 characters.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      REGION_LOCK_KEY,
    ]);

    let regionCreated = false;
    let region = await findRegion(client, BC_DEMO_REGION_CODE);
    if (!region) {
      const inserted = await client.query<RegionRow>(
        `INSERT INTO region_policies
           (code, country_code, subdivision_code, metro_name, currency,
            timezone, language_codes, minimum_age, competition_enabled,
            payout_enabled, boundary_version, policy_version, boundary,
            valid_from, valid_to)
         VALUES
           ($1, 'CA', 'BC', 'British Columbia Demo', 'CAD',
            'America/Vancouver', ARRAY['en-CA']::text[], 19, false,
            false, 'not-configured-demo-v1', $2, NULL, $3, NULL)
         RETURNING *, boundary IS NULL AS boundary_is_null`,
        [BC_DEMO_REGION_CODE, BC_DEMO_POLICY_VERSION, REGION_VALID_FROM],
      );
      region = inserted.rows[0];
      regionCreated = true;
      await insertAuditEvent(client, {
        action: 'foundation.bc_demo_region_created',
        entityId: region.id,
        entityType: 'region_policies',
        nextState: {
          code: region.code,
          competitionEnabled: false,
          payoutEnabled: false,
          policyVersion: region.policy_version,
        },
        reason,
      });
    }
    assertSafeRegion(region);

    let competitionCreated = false;
    let competitionUpdated = false;
    let competition = await findCompetition(client, region.id, monthKey);
    if (!competition) {
      const periods = buildDraftPeriods(monthKey);
      const inserted = await client.query<CompetitionRow>(
        `INSERT INTO competitions
           (region_policy_id, month_key, name, status, mode, currency, rules_version,
            rules, minimum_entrants, entrant_cap, registration_opens_at,
            registration_closes_at, starts_at, ends_at)
         VALUES
           ($1, $2, $3, 'registration', 'non_cash_demo', 'CAD', $4, $5::jsonb, 100, 100,
            $6, $7, $8, $9)
         RETURNING id, currency, minimum_entrants, mode, name, rules,
                   rules_version, status`,
        [
          region.id,
          monthKey,
          COMPETITION_NAME,
          BC_DEMO_RULES_VERSION,
          JSON.stringify(RULES),
          periods.registrationOpensAt,
          periods.registrationClosesAt,
          periods.startsAt,
          periods.endsAt,
        ],
      );
      competition = inserted.rows[0];
      competitionCreated = true;

      for (const goalDays of GOAL_DAYS) {
        await client.query(
          `INSERT INTO competition_goal_brackets
             (competition_id, goal_days, label)
           VALUES ($1, $2, $3)`,
          [competition.id, goalDays, `${goalDays} days per week`],
        );
      }
      await insertAuditEvent(client, {
        action: 'foundation.bc_demo_competition_created',
        entityId: competition.id,
        entityType: 'competitions',
        nextState: {
          monthKey,
          regionPolicyId: region.id,
          rulesVersion: BC_DEMO_RULES_VERSION,
          mode: 'non_cash_demo',
          status: 'registration',
        },
        reason,
      });
    } else if (isLegacyDisabledDraft(competition)) {
      const upgraded = await client.query<CompetitionRow>(
        `UPDATE competitions
         SET name = $2,
             status = 'registration',
             mode = 'non_cash_demo',
             rules_version = $3,
             rules = $4::jsonb,
             updated_at = now()
         WHERE id = $1
         RETURNING id, currency, minimum_entrants, mode, name, rules,
                   rules_version, status`,
        [
          competition.id,
          COMPETITION_NAME,
          BC_DEMO_RULES_VERSION,
          JSON.stringify(RULES),
        ],
      );
      competition = upgraded.rows[0];
      competitionUpdated = true;
      await insertAuditEvent(client, {
        action: 'foundation.bc_demo_competition_upgraded',
        entityId: competition.id,
        entityType: 'competitions',
        nextState: {
          mode: 'non_cash_demo',
          rulesVersion: BC_DEMO_RULES_VERSION,
          status: 'registration',
        },
        reason,
      });
    }
    assertSafeCompetition(competition);
    await assertGoalBrackets(client, competition.id);

    await client.query('COMMIT');
    return {
      competitionCreated,
      competitionId: competition.id,
      competitionStatus: 'registration',
      competitionUpdated,
      monthKey,
      regionCreated,
      regionPolicyId: region.id,
      safety: {
        competitionEnabled: false,
        payoutEnabled: false,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

type DatabaseClient = PoolClient;

async function findRegion(
  client: DatabaseClient,
  code: string,
): Promise<RegionRow | undefined> {
  const result = await client.query<RegionRow>(
    `SELECT *, boundary IS NULL AS boundary_is_null
     FROM region_policies
     WHERE code = $1 AND policy_version = $2
     FOR UPDATE`,
    [code, BC_DEMO_POLICY_VERSION],
  );
  return result.rows[0];
}

async function findCompetition(
  client: DatabaseClient,
  regionPolicyId: string,
  monthKey: string,
): Promise<CompetitionRow | undefined> {
  const result = await client.query<CompetitionRow>(
    `SELECT id, currency, minimum_entrants, mode, name, rules,
            rules_version, status
     FROM competitions
     WHERE region_policy_id = $1 AND month_key = $2
     FOR UPDATE`,
    [regionPolicyId, monthKey],
  );
  return result.rows[0];
}

function assertSafeRegion(region: RegionRow): void {
  const valid =
    region.code === BC_DEMO_REGION_CODE &&
    region.country_code === 'CA' &&
    region.subdivision_code === 'BC' &&
    region.metro_name === 'British Columbia Demo' &&
    region.currency === 'CAD' &&
    region.timezone === 'America/Vancouver' &&
    region.language_codes.length === 1 &&
    region.language_codes[0] === 'en-CA' &&
    region.minimum_age === 19 &&
    !region.competition_enabled &&
    !region.payout_enabled &&
    region.boundary_version === 'not-configured-demo-v1' &&
    region.policy_version === BC_DEMO_POLICY_VERSION &&
    region.boundary_is_null &&
    region.valid_to === null;

  if (!valid) {
    throw new Error(
      'The existing BC demo region is not in the required disabled state. No changes were made.',
    );
  }
}

function assertSafeCompetition(competition: CompetitionRow): void {
  const parsedRules = parseCompetitionRules(
    competition.rules as never,
    'non_cash_demo',
  );
  const valid =
    competition.status === 'registration' &&
    competition.mode === 'non_cash_demo' &&
    competition.name === COMPETITION_NAME &&
    competition.currency === 'CAD' &&
    competition.rules_version === BC_DEMO_RULES_VERSION &&
    competition.minimum_entrants === 100 &&
    Object.entries(RULES).every(
      ([key, value]) => parsedRules[key as keyof typeof parsedRules] === value,
    );

  if (!valid) {
    throw new Error(
      'The existing BC demo competition is not the expected safe non-cash demo. No changes were made.',
    );
  }
}

function isLegacyDisabledDraft(competition: CompetitionRow): boolean {
  if (
    competition.status !== 'draft' ||
    competition.mode !== 'cash' ||
    competition.name !== LEGACY_COMPETITION_NAME ||
    competition.currency !== 'CAD' ||
    competition.rules_version !== LEGACY_RULES_VERSION ||
    competition.minimum_entrants !== 100
  ) {
    return false;
  }

  try {
    const legacy = parseCompetitionRules(competition.rules as never, 'cash');
    return (
      legacy.signupPrizeDrawEntries === 1 &&
      legacy.payoutPoolAmountMinor === 1 &&
      legacy.payoutWinnerCount === 1 &&
      legacy.payoutExponent === 1 &&
      legacy.verifiedSessionCategoryScore === 0 &&
      legacy.verifiedSessionPrizeDrawEntries === 0
    );
  } catch {
    return false;
  }
}

async function assertGoalBrackets(
  client: DatabaseClient,
  competitionId: string,
): Promise<void> {
  const result = await client.query<{ goal_days: number }>(
    `SELECT goal_days
     FROM competition_goal_brackets
     WHERE competition_id = $1
     ORDER BY goal_days`,
    [competitionId],
  );
  if (
    result.rows.length !== GOAL_DAYS.length ||
    result.rows.some((row, index) => row.goal_days !== GOAL_DAYS[index])
  ) {
    throw new Error(
      'The existing BC demo competition has unexpected goal brackets. No changes were made.',
    );
  }
}

async function insertAuditEvent(
  client: DatabaseClient,
  event: {
    action: string;
    entityId: string;
    entityType: string;
    nextState: Record<string, boolean | string>;
    reason: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO operator_audit_events
       (actor_user_id, action, entity_type, entity_id, previous_state,
        next_state, reason, request_id)
     VALUES (NULL, $1, $2, $3, NULL, $4::jsonb, $5, $6)`,
    [
      event.action,
      event.entityType,
      event.entityId,
      JSON.stringify(event.nextState),
      event.reason,
      `bootstrap-bc-demo:${event.action}`,
    ],
  );
}

function assertMonthKey(monthKey: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new Error('BC_DEMO_COMPETITION_MONTH must use YYYY-MM format.');
  }
}

function buildDraftPeriods(monthKey: string): {
  endsAt: Date;
  registrationClosesAt: Date;
  registrationOpensAt: Date;
  startsAt: Date;
} {
  const [year, month] = monthKey.split('-').map(Number);
  const startsAt = new Date(Date.UTC(year, month - 1, 1, 8));
  const endsAt = new Date(Date.UTC(year, month, 1, 8));
  const registrationOpensAt = new Date(Date.UTC(year, month - 2, 1, 8));

  return {
    endsAt,
    registrationClosesAt: startsAt,
    registrationOpensAt,
    startsAt,
  };
}

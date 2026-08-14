import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import type { StreakSummaryResponseDto } from './dto/streak.dto';
import {
  STREAK_PROJECTION_VERSION,
  type StreakCounts,
} from './streak-calculation';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

interface StreakQueryRow {
  as_of_date: string;
  daily: number;
  monthly: number;
  timezone: string;
  user_id: string;
  weekly: number;
  yearly: number;
}

export const MAX_STREAK_SUBJECTS_PER_QUERY = 100;

export async function loadStreakSummaries(
  executor: DatabaseExecutor,
  userIds: readonly string[],
  now = new Date(),
): Promise<Map<string, StreakSummaryResponseDto>> {
  const summaries = new Map<string, StreakSummaryResponseDto>();

  for (const batch of batchStreakSubjectIds(userIds)) {
    const requestedValues = sql.join(
      batch.map((userId) => sql`(${userId}::uuid)`),
      sql`, `,
    );
    const result = await sql<StreakQueryRow>`
      WITH requested(user_id) AS (
        VALUES ${requestedValues}
      ),
      current_regions AS (
        SELECT DISTINCT ON (verification.user_id)
          verification.user_id,
          region.timezone
        FROM region_verifications AS verification
        INNER JOIN requested
          ON requested.user_id = verification.user_id
        INNER JOIN region_policies AS region
          ON region.id = verification.region_policy_id
        WHERE verification.method = 'device_location'
          AND verification.status = 'approved'
          AND verification.verified_at IS NOT NULL
          AND verification.expires_at IS NOT NULL
          AND verification.expires_at > ${now}
          AND verification.policy_version = region.policy_version
          AND region.deleted_at IS NULL
          AND region.competition_enabled = TRUE
          AND region.valid_from <= ${now}
          AND (region.valid_to IS NULL OR region.valid_to > ${now})
        ORDER BY verification.user_id,
          verification.verified_at DESC,
          verification.created_at DESC
      ),
      authoritative_sessions AS (
        SELECT
          session.eligible_date,
          session.started_at,
          session.user_id,
          region.timezone
        FROM workout_sessions AS session
        INNER JOIN requested
          ON requested.user_id = session.user_id
        INNER JOIN users AS member
          ON member.id = session.user_id
         AND member.status = 'active'
        INNER JOIN competition_enrollments AS enrollment
          ON enrollment.id = session.enrollment_id
         AND enrollment.competition_id = session.competition_id
         AND enrollment.user_id = session.user_id
        INNER JOIN competitions AS competition
          ON competition.id = session.competition_id
        INNER JOIN region_policies AS region
          ON region.id = competition.region_policy_id
        WHERE session.status = 'verified'
          AND session.completed_at IS NOT NULL
          AND session.started_at <= ${now}
          AND enrollment.status = 'active'
          AND competition.status IN ('active', 'settling', 'settled')
          AND competition.deleted_at IS NULL
          AND session.started_at >= enrollment.enrolled_at
          AND session.started_at >= competition.starts_at
          AND session.started_at < competition.ends_at
          AND session.policy_version = competition.rules_version
          AND session.gym_location_id IS NOT DISTINCT FROM enrollment.gym_location_id
          AND session.gym_credential_version IS NOT DISTINCT FROM enrollment.gym_credential_version
          AND session.eligible_date =
            (session.started_at AT TIME ZONE region.timezone)::date
          AND to_char(session.eligible_date, 'YYYY-MM') = competition.month_key
      ),
      latest_session_regions AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          timezone
        FROM authoritative_sessions
        ORDER BY user_id, eligible_date DESC, started_at DESC
      ),
      subjects AS (
        SELECT
          requested.user_id,
          COALESCE(current_regions.timezone, latest_session_regions.timezone, 'UTC')
            AS timezone,
          (${now} AT TIME ZONE COALESCE(
            current_regions.timezone,
            latest_session_regions.timezone,
            'UTC'
          ))::date AS as_of_date
        FROM requested
        LEFT JOIN current_regions
          ON current_regions.user_id = requested.user_id
        LEFT JOIN latest_session_regions
          ON latest_session_regions.user_id = requested.user_id
      ),
      eligible_dates AS (
        SELECT DISTINCT session.user_id, session.eligible_date
        FROM authoritative_sessions AS session
        INNER JOIN subjects ON subjects.user_id = session.user_id
        WHERE session.eligible_date <= subjects.as_of_date
      ),
      periods AS (
        SELECT
          dates.user_id,
          'daily'::text AS kind,
          (dates.eligible_date - DATE '1970-01-01')::integer AS period_index,
          (subjects.as_of_date - DATE '1970-01-01')::integer AS current_index
        FROM eligible_dates AS dates
        INNER JOIN subjects ON subjects.user_id = dates.user_id
        UNION ALL
        SELECT
          dates.user_id,
          'weekly'::text,
          floor((dates.eligible_date - DATE '1970-01-05') / 7.0)::integer,
          floor((subjects.as_of_date - DATE '1970-01-05') / 7.0)::integer
        FROM eligible_dates AS dates
        INNER JOIN subjects ON subjects.user_id = dates.user_id
        UNION ALL
        SELECT
          dates.user_id,
          'monthly'::text,
          (extract(year FROM dates.eligible_date)::integer * 12) +
            extract(month FROM dates.eligible_date)::integer - 1,
          (extract(year FROM subjects.as_of_date)::integer * 12) +
            extract(month FROM subjects.as_of_date)::integer - 1
        FROM eligible_dates AS dates
        INNER JOIN subjects ON subjects.user_id = dates.user_id
        UNION ALL
        SELECT
          dates.user_id,
          'yearly'::text,
          extract(year FROM dates.eligible_date)::integer,
          extract(year FROM subjects.as_of_date)::integer
        FROM eligible_dates AS dates
        INNER JOIN subjects ON subjects.user_id = dates.user_id
      ),
      distinct_periods AS (
        SELECT DISTINCT user_id, kind, period_index, current_index
        FROM periods
      ),
      ranked_periods AS (
        SELECT
          user_id,
          kind,
          period_index,
          current_index,
          max(period_index) OVER (PARTITION BY user_id, kind) AS latest_index,
          row_number() OVER (
            PARTITION BY user_id, kind
            ORDER BY period_index DESC
          )::integer AS position
        FROM distinct_periods
      ),
      active_counts AS (
        SELECT
          user_id,
          kind,
          count(*)::integer AS value
        FROM ranked_periods
        WHERE latest_index IN (current_index, current_index - 1)
          AND period_index = latest_index - position + 1
        GROUP BY user_id, kind
      )
      SELECT
        subjects.user_id,
        subjects.as_of_date::text,
        subjects.timezone,
        COALESCE(max(value) FILTER (WHERE kind = 'daily'), 0)::integer AS daily,
        COALESCE(max(value) FILTER (WHERE kind = 'weekly'), 0)::integer AS weekly,
        COALESCE(max(value) FILTER (WHERE kind = 'monthly'), 0)::integer AS monthly,
        COALESCE(max(value) FILTER (WHERE kind = 'yearly'), 0)::integer AS yearly
      FROM subjects
      LEFT JOIN active_counts ON active_counts.user_id = subjects.user_id
      GROUP BY subjects.user_id, subjects.as_of_date, subjects.timezone
    `.execute(executor);

    for (const row of result.rows) {
      summaries.set(row.user_id, {
        asOfDate: row.as_of_date,
        streaks: toStreakCounts(row),
        timezone: row.timezone,
      });
    }
  }

  return summaries;
}

export function batchStreakSubjectIds(userIds: readonly string[]): string[][] {
  const uniqueUserIds = [...new Set(userIds)];
  const batches: string[][] = [];
  for (let offset = 0; offset < uniqueUserIds.length;) {
    const batch = uniqueUserIds.slice(
      offset,
      offset + MAX_STREAK_SUBJECTS_PER_QUERY,
    );
    batches.push(batch);
    offset += batch.length;
  }
  return batches;
}

function toStreakCounts(
  row: Pick<StreakQueryRow, 'daily' | 'monthly' | 'weekly' | 'yearly'>,
): StreakCounts {
  return {
    daily: row.daily,
    monthly: row.monthly,
    projectionVersion: STREAK_PROJECTION_VERSION,
    weekly: row.weekly,
    yearly: row.yearly,
  };
}

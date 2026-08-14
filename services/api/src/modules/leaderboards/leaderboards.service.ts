import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  competitionMonthEndDateKey,
  dateKeyInTimezone,
} from '../competitions/competition-calendar';
import {
  longestConsecutiveDateStreak,
  rankCategoryStandings,
} from '../competitions/competition-scoring';
import { ProfilesService } from '../profiles/profiles.service';
import { currentRegionVerificationPredicate } from '../regions/current-region-verification';
import { loadPublicStreaks } from '../streaks/public-streaks';
import type { StreakCounts } from '../streaks/streak-calculation';
import type {
  CategoryLeaderboardDto,
  CompetitionProgressResponseDto,
} from './dto/leaderboard.dto';

@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly profiles: ProfilesService,
  ) {}

  async getCurrentLeaderboard(
    principal: AuthenticatedPrincipal,
    goalDays: number,
    now = new Date(),
  ): Promise<CategoryLeaderboardDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const competition = await transaction
          .selectFrom('region_verifications as verification')
          .innerJoin(
            'competitions as competition',
            'competition.region_policy_id',
            'verification.region_policy_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.id',
            'competition.ends_at',
            'competition.month_key',
            'competition.rules_version',
            'competition.starts_at',
            'region.timezone',
          ])
          .where('verification.user_id', '=', user.id)
          .where(
            currentRegionVerificationPredicate('verification', 'region', now),
          )
          .where('competition.status', '=', 'active')
          .where('competition.starts_at', '<=', now)
          .where('competition.ends_at', '>', now)
          .where('competition.deleted_at', 'is', null)
          .orderBy('competition.starts_at', 'desc')
          .executeTakeFirst();
        if (!competition) {
          return null;
        }

        const enrollments = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'profiles as profile',
            'profile.user_id',
            'enrollment.user_id',
          )
          .select([
            'enrollment.id as enrollment_id',
            'enrollment.user_id',
            'profile.callsign',
            'profile.public_identity_mode',
            'profile.public_name',
          ])
          .where('enrollment.competition_id', '=', competition.id)
          .where('enrollment.goal_days', '=', goalDays)
          .where('enrollment.status', '=', 'active')
          .execute();
        const enrollmentIds = enrollments.map((row) => row.enrollment_id);
        const userIds = enrollments.map((row) => row.user_id);
        const [ledgerRows, verifiedSessions, publicStreaks, settledMatches] =
          enrollmentIds.length === 0
            ? [[], [], new Map<string, StreakCounts>(), []]
            : await Promise.all([
                transaction
                  .selectFrom('entry_ledger')
                  .select((expression) => [
                    'user_id',
                    expression.fn
                      .sum<number>('category_score_delta')
                      .as('category_score'),
                  ])
                  .where('competition_id', '=', competition.id)
                  .where('enrollment_id', 'in', enrollmentIds)
                  .groupBy('user_id')
                  .execute(),
                transaction
                  .selectFrom('workout_sessions as session')
                  .innerJoin('competition_enrollments as enrollment', (join) =>
                    join
                      .onRef('enrollment.id', '=', 'session.enrollment_id')
                      .onRef(
                        'enrollment.competition_id',
                        '=',
                        'session.competition_id',
                      )
                      .onRef('enrollment.user_id', '=', 'session.user_id'),
                  )
                  .select(['session.eligible_date', 'session.user_id'])
                  .distinct()
                  .where('session.competition_id', '=', competition.id)
                  .where('session.enrollment_id', 'in', enrollmentIds)
                  .where('session.status', '=', 'verified')
                  .whereRef(
                    'session.started_at',
                    '>=',
                    'enrollment.enrolled_at',
                  )
                  .where('session.started_at', '>=', competition.starts_at)
                  .where('session.started_at', '<', competition.ends_at)
                  .where(
                    'session.policy_version',
                    '=',
                    competition.rules_version,
                  )
                  .where(
                    sql<boolean>`session.gym_location_id IS NOT DISTINCT FROM enrollment.gym_location_id`,
                  )
                  .where(
                    sql<boolean>`session.gym_credential_version IS NOT DISTINCT FROM enrollment.gym_credential_version`,
                  )
                  .where(
                    'session.eligible_date',
                    '>=',
                    `${competition.month_key}-01`,
                  )
                  .where(
                    'session.eligible_date',
                    '<=',
                    competitionMonthEndDateKey(competition.month_key),
                  )
                  .execute(),
                loadPublicStreaks(transaction, userIds),
                transaction
                  .selectFrom('competition_matches')
                  .select('period_index')
                  .distinct()
                  .where('competition_id', '=', competition.id)
                  .where('status', '=', 'settled')
                  .execute(),
              ]);
        const ledgerByUser = new Map(
          ledgerRows.map((row) => [
            row.user_id,
            Number(row.category_score ?? 0),
          ]),
        );
        const datesByUser = new Map<string, string[]>();
        for (const session of verifiedSessions) {
          const dates = datesByUser.get(session.user_id) ?? [];
          dates.push(normalizeDateKey(session.eligible_date));
          datesByUser.set(session.user_id, dates);
        }
        const enrollmentByUser = new Map(
          enrollments.map((enrollment) => [enrollment.user_id, enrollment]),
        );
        const standings = rankCategoryStandings(
          competition.id,
          competition.rules_version,
          enrollments.map((enrollment) => {
            const dateKeys = datesByUser.get(enrollment.user_id) ?? [];
            return {
              categoryScore: ledgerByUser.get(enrollment.user_id) ?? 0,
              goalDays,
              longestStreak: longestConsecutiveDateStreak(dateKeys),
              userId: enrollment.user_id,
              verifiedDays: dateKeys.length,
            };
          }),
        );

        return {
          competitionId: competition.id,
          goal: goalDays,
          rows: standings.slice(0, 100).map((standing) => {
            const enrollment = enrollmentByUser.get(standing.userId)!;
            return {
              alias:
                enrollment.public_identity_mode === 'private'
                  ? enrollment.callsign
                  : (enrollment.public_name ?? enrollment.callsign),
              categoryEntries: standing.categoryScore,
              isCurrentUser: standing.userId === user.id,
              rank: standing.rank,
              streaks: publicStreaks.get(standing.userId) ?? {
                daily: 0,
                monthly: 0,
                projectionVersion: 'streaks-v1',
                weekly: 0,
                yearly: 0,
              },
              verifiedDays: standing.verifiedDays,
            };
          }),
          rulesVersion: competition.rules_version,
          scoringStatus: 'provisional',
          serverTime: now.toISOString(),
          settledPeriodCount: settledMatches.length,
        };
      });
  }

  async getMyProgress(
    principal: AuthenticatedPrincipal,
    now = new Date(),
  ): Promise<CompetitionProgressResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const enrollment = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'enrollment.competition_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.id as competition_id',
            'competition.ends_at',
            'competition.month_key',
            'competition.rules_version',
            'competition.starts_at',
            'competition.status as competition_status',
            'enrollment.enrolled_at',
            'enrollment.goal_days',
            'enrollment.gym_credential_version',
            'enrollment.gym_location_id',
            'enrollment.id as enrollment_id',
            'region.timezone',
          ])
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .where('competition.status', 'in', [
            'registration',
            'active',
            'settling',
            'settled',
          ])
          .where('competition.deleted_at', 'is', null)
          .orderBy('competition.starts_at', 'desc')
          .executeTakeFirst();
        if (!enrollment) {
          return null;
        }
        const competitionStatus =
          enrollment.competition_status as CompetitionProgressResponseDto['competitionStatus'];

        const [ledger, sessions, verifiedSessions, settledMatches, banked] =
          await Promise.all([
            transaction
              .selectFrom('entry_ledger')
              .select((expression) => [
                expression.fn
                  .sum<number>('category_score_delta')
                  .as('category_score'),
                expression.fn
                  .sum<number>('prize_draw_entries_delta')
                  .as('prize_draw_entries'),
                expression.fn.max<Date>('created_at').as('updated_at'),
              ])
              .where('competition_id', '=', enrollment.competition_id)
              .where('enrollment_id', '=', enrollment.enrollment_id)
              .where('user_id', '=', user.id)
              .executeTakeFirstOrThrow(),
            transaction
              .selectFrom('workout_sessions')
              .select([
                'completed_at',
                'eligible_date',
                'id',
                'started_at',
                'status',
              ])
              .where('competition_id', '=', enrollment.competition_id)
              .where('enrollment_id', '=', enrollment.enrollment_id)
              .where('user_id', '=', user.id)
              .where('started_at', '>=', enrollment.enrolled_at)
              .where('started_at', '>=', enrollment.starts_at)
              .where('started_at', '<', enrollment.ends_at)
              .where('policy_version', '=', enrollment.rules_version)
              .orderBy('started_at', 'desc')
              .limit(100)
              .execute(),
            transaction
              .selectFrom('workout_sessions')
              .select('eligible_date')
              .distinct()
              .where('competition_id', '=', enrollment.competition_id)
              .where('enrollment_id', '=', enrollment.enrollment_id)
              .where('user_id', '=', user.id)
              .where('started_at', '>=', enrollment.enrolled_at)
              .where('started_at', '>=', enrollment.starts_at)
              .where('started_at', '<', enrollment.ends_at)
              .where('policy_version', '=', enrollment.rules_version)
              .where(
                sql<boolean>`gym_location_id IS NOT DISTINCT FROM ${enrollment.gym_location_id}`,
              )
              .where(
                sql<boolean>`gym_credential_version IS NOT DISTINCT FROM ${enrollment.gym_credential_version}`,
              )
              .where('status', '=', 'verified')
              .where('eligible_date', '>=', `${enrollment.month_key}-01`)
              .where(
                'eligible_date',
                '<=',
                competitionMonthEndDateKey(enrollment.month_key),
              )
              .orderBy('eligible_date')
              .execute(),
            transaction
              .selectFrom('competition_matches')
              .select('period_index')
              .distinct()
              .where('competition_id', '=', enrollment.competition_id)
              .where('status', '=', 'settled')
              .where((expression) =>
                expression.or([
                  expression('user_a_id', '=', user.id),
                  expression('user_b_id', '=', user.id),
                ]),
              )
              .execute(),
            competitionStatus === 'settling' || competitionStatus === 'settled'
              ? Promise.resolve(null)
              : transaction
                  .selectFrom('entry_ledger as entry')
                  .select(
                    sql<number>`COALESCE(SUM(
                      CASE
                        WHEN entry.reason <> 'verified_session' THEN entry.prize_draw_entries_delta
                        WHEN EXISTS (
                          SELECT 1
                          FROM workout_sessions AS session
                          INNER JOIN competition_matches AS match
                            ON match.competition_id = session.competition_id
                           AND match.status = 'settled'
                           AND session.eligible_date BETWEEN match.period_start_date AND match.period_end_date
                           AND session.user_id IN (match.user_a_id, match.user_b_id)
                          WHERE session.id = entry.source_event_id
                            AND session.enrollment_id = entry.enrollment_id
                            AND session.user_id = entry.user_id
                        ) THEN entry.prize_draw_entries_delta
                        ELSE 0
                      END
                    ), 0)`.as('prize_draw_entries'),
                  )
                  .where('entry.competition_id', '=', enrollment.competition_id)
                  .where('entry.enrollment_id', '=', enrollment.enrollment_id)
                  .where('entry.user_id', '=', user.id)
                  .executeTakeFirstOrThrow(),
          ]);
        const projectedPrizeDrawEntries = Number(
          ledger.prize_draw_entries ?? 0,
        );
        const bankedPrizeDrawEntries =
          competitionStatus === 'settling' || competitionStatus === 'settled'
            ? projectedPrizeDrawEntries
            : Number(banked?.prize_draw_entries ?? 0);
        const verifiedDateKeys = verifiedSessions.map(({ eligible_date }) =>
          normalizeDateKey(eligible_date),
        );
        const scoringStatus =
          competitionStatus === 'settling' || competitionStatus === 'settled'
            ? 'final'
            : 'provisional';

        return {
          bankedPrizeDrawEntries,
          categoryScore: Number(ledger.category_score ?? 0),
          competitionId: enrollment.competition_id,
          competitionStatus,
          enrolledDateKey: dateKeyInTimezone(
            enrollment.enrolled_at,
            enrollment.timezone,
          ),
          goalDays: enrollment.goal_days,
          monthKey: enrollment.month_key,
          prizeDrawEntries: bankedPrizeDrawEntries,
          projectedPrizeDrawEntries,
          referenceDateKey: dateKeyInTimezone(now, enrollment.timezone),
          rulesVersion: enrollment.rules_version,
          scoringStatus,
          serverTime: now.toISOString(),
          sessions: sessions.map((session) => ({
            completedAt: session.completed_at?.toISOString() ?? null,
            eligibleDate: normalizeDateKey(session.eligible_date),
            id: session.id,
            startedAt: session.started_at.toISOString(),
            status: session.status,
          })),
          settledPeriodCount: settledMatches.length,
          updatedAt: (
            ledger.updated_at ?? enrollment.enrolled_at
          ).toISOString(),
          verifiedDateKeys,
          verifiedDays: verifiedDateKeys.length,
        };
      });
  }
}

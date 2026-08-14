import { Injectable } from '@nestjs/common';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { ProfilesService } from '../profiles/profiles.service';
import { currentRegionVerificationPredicate } from '../regions/current-region-verification';
import { calculateStreaks } from '../streaks/streak-calculation';
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
  ): Promise<CategoryLeaderboardDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
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
          .select(['competition.id', 'region.timezone'])
          .where('verification.user_id', '=', user.id)
          .where(
            currentRegionVerificationPredicate('verification', 'region', now),
          )
          .where('competition.status', '=', 'active')
          .where('competition.starts_at', '<=', now)
          .where('competition.ends_at', '>', now)
          .orderBy('competition.starts_at', 'desc')
          .executeTakeFirst();
        if (!competition) {
          return null;
        }

        const progressRows = await transaction
          .selectFrom('competition_progress as progress')
          .innerJoin(
            'profiles as profile',
            'profile.user_id',
            'progress.user_id',
          )
          .select([
            'profile.callsign',
            'profile.public_identity_mode',
            'profile.public_name',
            'progress.category_score',
            'progress.user_id',
            'progress.verified_days',
          ])
          .where('progress.competition_id', '=', competition.id)
          .where('progress.goal_days', '=', goalDays)
          .orderBy('progress.category_score', 'desc')
          .orderBy('progress.verified_days', 'desc')
          .orderBy('progress.user_id')
          .limit(100)
          .execute();

        const verifiedSessions =
          progressRows.length === 0
            ? []
            : await transaction
                .selectFrom('workout_sessions as session')
                .select(['session.eligible_date', 'session.user_id'])
                .distinct()
                .where(
                  'session.user_id',
                  'in',
                  progressRows.map((row) => row.user_id),
                )
                .where('session.status', '=', 'verified')
                .execute();
        const verifiedDatesByUser = new Map<string, string[]>();
        for (const session of verifiedSessions) {
          const dates = verifiedDatesByUser.get(session.user_id) ?? [];
          dates.push(normalizeDateKey(session.eligible_date));
          verifiedDatesByUser.set(session.user_id, dates);
        }
        const asOfDate = dateKeyInTimezone(now, competition.timezone);

        return {
          goal: goalDays,
          rows: progressRows.map((row, index) => ({
            alias:
              row.public_identity_mode === 'private'
                ? row.callsign
                : row.public_name || row.callsign,
            categoryEntries: row.category_score,
            rank: index + 1,
            streaks: calculateStreaks(
              verifiedDatesByUser.get(row.user_id) ?? [],
              asOfDate,
            ),
            verifiedDays: row.verified_days,
          })),
        };
      });
  }

  async getMyProgress(
    principal: AuthenticatedPrincipal,
  ): Promise<CompetitionProgressResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const progress = await transaction
          .selectFrom('competition_progress as progress')
          .innerJoin(
            'competition_enrollments as enrollment',
            'enrollment.id',
            'progress.enrollment_id',
          )
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'progress.competition_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.month_key',
            'enrollment.enrolled_at',
            'progress.category_score',
            'progress.competition_id',
            'progress.goal_days',
            'progress.prize_draw_entries',
            'progress.updated_at',
            'progress.verified_days',
            'region.timezone',
          ])
          .where('progress.user_id', '=', user.id)
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.ends_at', '>', now)
          .orderBy('competition.starts_at')
          .executeTakeFirst();
        if (!progress) {
          return null;
        }

        const sessions = await transaction
          .selectFrom('workout_sessions')
          .select([
            'completed_at',
            'eligible_date',
            'id',
            'started_at',
            'status',
          ])
          .where('competition_id', '=', progress.competition_id)
          .where('user_id', '=', user.id)
          .orderBy('started_at', 'desc')
          .limit(100)
          .execute();

        return {
          categoryScore: progress.category_score,
          competitionId: progress.competition_id,
          enrolledDateKey: dateKeyInTimezone(
            progress.enrolled_at,
            progress.timezone,
          ),
          goalDays: progress.goal_days,
          monthKey: progress.month_key,
          prizeDrawEntries: progress.prize_draw_entries,
          updatedAt: progress.updated_at.toISOString(),
          verifiedDays: progress.verified_days,
          verifiedDateKeys: sessions
            .filter(({ status }) => status === 'verified')
            .map(({ eligible_date }) => normalizeDateKey(eligible_date)),
          sessions: sessions.map((session) => ({
            completedAt: session.completed_at?.toISOString() ?? null,
            eligibleDate: normalizeDateKey(session.eligible_date),
            id: session.id,
            startedAt: session.started_at.toISOString(),
            status: session.status,
          })),
        };
      });
  }
}

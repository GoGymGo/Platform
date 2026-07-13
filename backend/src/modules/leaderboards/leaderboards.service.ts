import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
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
          .select('competition.id')
          .where('verification.user_id', '=', user.id)
          .where('verification.status', '=', 'approved')
          .where((expression) =>
            expression.or([
              expression('verification.expires_at', 'is', null),
              expression('verification.expires_at', '>', now),
            ]),
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

        return {
          goal: goalDays,
          rows: progressRows.map((row, index) => ({
            alias:
              row.public_identity_mode === 'private'
                ? row.callsign
                : row.public_name || row.callsign,
            categoryEntries: row.category_score,
            rank: index + 1,
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
            'competitions as competition',
            'competition.id',
            'progress.competition_id',
          )
          .select([
            'progress.category_score',
            'progress.competition_id',
            'progress.goal_days',
            'progress.prize_draw_entries',
            'progress.updated_at',
            'progress.verified_days',
          ])
          .where('progress.user_id', '=', user.id)
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.ends_at', '>', now)
          .orderBy('competition.starts_at')
          .executeTakeFirst();
        if (!progress) {
          return null;
        }

        return {
          categoryScore: progress.category_score,
          competitionId: progress.competition_id,
          goalDays: progress.goal_days,
          prizeDrawEntries: progress.prize_draw_entries,
          updatedAt: progress.updated_at.toISOString(),
          verifiedDays: progress.verified_days,
        };
      });
  }
}

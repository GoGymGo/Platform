import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { CategoryLeaderboardDto } from '../leaderboards/dto/leaderboard.dto';
import { ProfilesService } from '../profiles/profiles.service';
import { loadPublicStreaks } from '../streaks/public-streaks';
import type {
  ParticipantCompetitionResultsResponseDto,
  RewardWinnerResponseDto,
  SettledCompetitionResponseDto,
} from './dto/result.dto';

@Injectable()
export class ResultsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly profiles: ProfilesService,
  ) {}

  async getRewardWinners(): Promise<RewardWinnerResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const latestDraw = await this.latestSettledDraw(transaction);
        return latestDraw
          ? this.loadRewardWinners(transaction, latestDraw.id)
          : [];
      });
  }

  async getSettledCompetition(): Promise<SettledCompetitionResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const latestDraw = await this.latestSettledDraw(transaction);
        if (!latestDraw) return null;
        return {
          competitionName: latestDraw.competition_name,
          monthKey: latestDraw.month_key,
          rewardCount: Number(latestDraw.reward_count),
        };
      });
  }

  async getLatestParticipantResults(
    principal: AuthenticatedPrincipal,
  ): Promise<ParticipantCompetitionResultsResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        await this.profiles.ensureProfile(user.id, transaction);
        const competition = await transaction
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
          .leftJoin(
            'competition_draws as draw',
            'draw.competition_id',
            'competition.id',
          )
          .select([
            'competition.ends_at',
            'competition.id',
            'competition.month_key',
            'competition.name',
            'competition.rules_version',
            'competition.status',
            'draw.id as draw_id',
            'draw.settled_at',
            'draw.status as draw_status',
            'enrollment.goal_days',
            'region.code as region_code',
            'region.metro_name as region_name',
          ])
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .where('competition.status', 'in', ['active', 'settling', 'settled'])
          .where('competition.ends_at', '<=', now)
          .orderBy('competition.ends_at', 'desc')
          .orderBy('competition.id')
          .executeTakeFirst();
        if (!competition) return null;

        const settled =
          competition.status === 'settled' &&
          competition.draw_status === 'settled' &&
          competition.draw_id !== null;
        const [categoryLeaderboards, rewardWinners] = settled
          ? await Promise.all([
              this.loadCategoryLeaderboards(
                transaction,
                competition.id,
                competition.rules_version,
                user.id,
                now,
              ),
              this.loadRewardWinners(transaction, competition.draw_id!),
            ])
          : [[], []];

        return {
          categoryLeaderboards,
          competitionId: competition.id,
          competitionName: competition.name,
          endedAt: competition.ends_at.toISOString(),
          monthKey: competition.month_key,
          participantGoalDays: competition.goal_days,
          regionCode: competition.region_code,
          regionName: competition.region_name,
          rewardCount: rewardWinners.length,
          rewardWinners,
          resultsStatus: settled ? 'settled' : 'pending',
          settledAt: competition.settled_at?.toISOString() ?? null,
        };
      });
  }

  private async loadCategoryLeaderboards(
    transaction: Transaction<Database>,
    competitionId: string,
    rulesVersion: string,
    currentUserId: string,
    now: Date,
  ): Promise<CategoryLeaderboardDto[]> {
    const [brackets, settlementInputs] = await Promise.all([
      transaction
        .selectFrom('competition_goal_brackets')
        .select('goal_days')
        .where('competition_id', '=', competitionId)
        .orderBy('goal_days')
        .execute(),
      transaction
        .selectFrom('competition_settlement_inputs as input')
        .innerJoin('profiles as profile', 'profile.user_id', 'input.user_id')
        .select([
          'profile.callsign',
          'profile.public_identity_mode',
          'profile.public_name',
          'input.category_rank',
          'input.category_score',
          'input.goal_days',
          'input.user_id',
          'input.verified_days',
        ])
        .where('input.competition_id', '=', competitionId)
        .orderBy('input.goal_days')
        .orderBy('input.category_rank')
        .execute(),
    ]);
    const streaksByUser = await loadPublicStreaks(
      transaction,
      settlementInputs.map((row) => row.user_id),
    );

    return brackets.map(({ goal_days: goal }) => ({
      competitionId,
      goal,
      rows: settlementInputs
        .filter((row) => row.goal_days === goal)
        .map((row) => ({
          alias:
            row.public_identity_mode === 'private'
              ? row.callsign
              : (row.public_name ?? row.callsign),
          categoryEntries: row.category_score,
          isCurrentUser: row.user_id === currentUserId,
          rank: row.category_rank,
          streaks: streaksByUser.get(row.user_id) ?? {
            daily: 0,
            monthly: 0,
            weekly: 0,
            yearly: 0,
          },
          verifiedDays: row.verified_days,
        })),
      rulesVersion,
      scoringStatus: 'final' as const,
      serverTime: now.toISOString(),
      settledPeriodCount: 4,
    }));
  }

  private async loadRewardWinners(
    transaction: Transaction<Database>,
    drawId: string,
  ): Promise<RewardWinnerResponseDto[]> {
    const winners = await transaction
      .selectFrom('reward_awards as award')
      .innerJoin('profiles as profile', 'profile.user_id', 'award.user_id')
      .innerJoin(
        'reward_catalog_items as reward',
        'reward.id',
        'award.reward_catalog_item_id',
      )
      .select([
        'profile.callsign',
        'profile.public_identity_mode',
        'profile.public_name',
        'award.user_id',
        'award.award_rank',
        'reward.reward_type',
        'reward.sponsor_name',
        'reward.title',
      ])
      .where('award.draw_id', '=', drawId)
      .where('award.status', '!=', 'cancelled')
      .orderBy('award.award_rank')
      .limit(100)
      .execute();
    const streaksByUser = await loadPublicStreaks(
      transaction,
      winners.map((winner) => winner.user_id),
    );

    return winners.map((winner) => ({
      alias:
        winner.public_identity_mode === 'private'
          ? winner.callsign
          : (winner.public_name ?? winner.callsign),
      awardRank: winner.award_rank,
      rewardTitle: winner.title,
      rewardType: winner.reward_type,
      sponsorName: winner.sponsor_name,
      streaks: streaksByUser.get(winner.user_id) ?? {
        daily: 0,
        monthly: 0,
        weekly: 0,
        yearly: 0,
      },
    }));
  }

  private latestSettledDraw(transaction: Transaction<Database>) {
    return transaction
      .selectFrom('competition_draws as draw')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'draw.competition_id',
      )
      .select([
        'competition.month_key',
        'competition.name as competition_name',
        'draw.id',
        'draw.settled_at',
        sql<string>`(
          SELECT COUNT(*)
          FROM reward_awards AS award
          WHERE award.draw_id = draw.id
            AND award.status <> 'cancelled'
        )`.as('reward_count'),
      ])
      .where('draw.status', '=', 'settled')
      .where('competition.status', '=', 'settled')
      .orderBy('draw.settled_at', 'desc')
      .executeTakeFirst();
  }
}

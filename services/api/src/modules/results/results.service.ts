import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { rankCategoryStandings } from '../competitions/competition-scoring';
import type { CategoryLeaderboardDto } from '../leaderboards/dto/leaderboard.dto';
import { ProfilesService } from '../profiles/profiles.service';
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
            'draw.rules_version as draw_rules_version',
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
                competition.draw_id!,
                competition.id,
                competition.draw_rules_version!,
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
    drawId: string,
    competitionId: string,
    rulesVersion: string,
    currentUserId: string,
    now: Date,
  ): Promise<CategoryLeaderboardDto[]> {
    const settlementInputs = await transaction
      .selectFrom('competition_settlement_inputs as input')
      .innerJoin('draw_public_identities as identity', (join) =>
        join
          .onRef('identity.draw_id', '=', 'input.draw_id')
          .onRef('identity.user_id', '=', 'input.user_id'),
      )
      .select([
        'identity.alias',
        'identity.streak_daily',
        'identity.streak_monthly',
        'identity.streak_projection_version',
        'identity.streak_weekly',
        'identity.streak_yearly',
        'input.category_rank',
        'input.category_score',
        'input.goal_days',
        'input.longest_streak',
        'input.user_id',
        'input.verified_days',
      ])
      .where('input.draw_id', '=', drawId)
      .where('input.competition_id', '=', competitionId)
      .orderBy('input.goal_days')
      .orderBy('input.category_rank')
      .orderBy('input.snapshot_position')
      .execute();
    const goals = [
      ...new Set(settlementInputs.map(({ goal_days: goalDays }) => goalDays)),
    ].sort((left, right) => left - right);

    return goals.map((goal) => {
      const goalRows = settlementInputs.filter((row) => row.goal_days === goal);
      const rankByUser = new Map(
        rankCategoryStandings(
          competitionId,
          rulesVersion,
          goalRows.map((row) => ({
            categoryScore: row.category_score,
            goalDays: row.goal_days,
            longestStreak: row.longest_streak,
            userId: row.user_id,
            verifiedDays: row.verified_days,
          })),
        ).map(({ rank, userId }) => [userId, rank]),
      );

      return {
        competitionId,
        goal,
        rows: goalRows.map((row) => ({
          alias: row.alias,
          categoryEntries: row.category_score,
          isCurrentUser: row.user_id === currentUserId,
          rank: rankByUser.get(row.user_id)!,
          streaks: {
            daily: row.streak_daily,
            monthly: row.streak_monthly,
            projectionVersion: row.streak_projection_version,
            weekly: row.streak_weekly,
            yearly: row.streak_yearly,
          },
          verifiedDays: row.verified_days,
        })),
        rulesVersion,
        scoringStatus: 'final' as const,
        serverTime: now.toISOString(),
        settledPeriodCount: 4,
      };
    });
  }

  private async loadRewardWinners(
    transaction: Transaction<Database>,
    drawId: string,
  ): Promise<RewardWinnerResponseDto[]> {
    const winners = await transaction
      .selectFrom('reward_awards as award')
      .innerJoin('draw_reward_slots as slot', (join) =>
        join
          .onRef('slot.draw_id', '=', 'award.draw_id')
          .onRef('slot.slot_position', '=', 'award.award_rank'),
      )
      .innerJoin('draw_reward_catalog_snapshots as reward', (join) =>
        join
          .onRef('reward.draw_id', '=', 'slot.draw_id')
          .onRef(
            'reward.reward_catalog_item_id',
            '=',
            'slot.reward_catalog_item_id',
          ),
      )
      .innerJoin('draw_public_identities as identity', (join) =>
        join
          .onRef('identity.draw_id', '=', 'award.draw_id')
          .onRef('identity.user_id', '=', 'award.user_id'),
      )
      .innerJoin('draw_entries as entry', (join) =>
        join
          .onRef('entry.draw_id', '=', 'award.draw_id')
          .onRef('entry.user_id', '=', 'award.user_id'),
      )
      .select([
        'identity.alias',
        'identity.streak_daily',
        'identity.streak_monthly',
        'identity.streak_projection_version',
        'identity.streak_weekly',
        'identity.streak_yearly',
        'award.award_rank',
        'entry.entry_count',
        'reward.cash_amount_cents',
        'reward.cash_currency',
        'reward.reward_type',
        'reward.sponsor_name',
        'reward.title',
      ])
      .where('award.draw_id', '=', drawId)
      .orderBy('award.award_rank')
      .execute();

    return winners.map((winner) => ({
      alias: winner.alias,
      awardRank: winner.award_rank,
      cashAmountCents: winner.cash_amount_cents,
      cashCurrency: winner.cash_currency,
      prizeDrawEntries: winner.entry_count,
      rewardTitle: winner.title,
      rewardType: winner.reward_type,
      sponsorName: winner.sponsor_name,
      streaks: {
        daily: winner.streak_daily,
        monthly: winner.streak_monthly,
        projectionVersion: winner.streak_projection_version,
        weekly: winner.streak_weekly,
        yearly: winner.streak_yearly,
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
        )`.as('reward_count'),
      ])
      .where('draw.status', '=', 'settled')
      .where('competition.status', '=', 'settled')
      .orderBy('draw.settled_at', 'desc')
      .orderBy('draw.id', 'asc')
      .executeTakeFirst();
  }
}

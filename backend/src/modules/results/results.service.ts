import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type {
  RewardWinnerResponseDto,
  SettledCompetitionResponseDto,
} from './dto/result.dto';
import { loadPublicStreaks } from '../streaks/public-streaks';

@Injectable()
export class ResultsService {
  constructor(private readonly database: DatabaseService) {}

  async getRewardWinners(): Promise<RewardWinnerResponseDto[]> {
    const latestDraw = await this.latestSettledDraw();
    if (!latestDraw) {
      return [];
    }

    const winners = await this.database.connection
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
      .where('award.draw_id', '=', latestDraw.id)
      .where('award.status', '!=', 'cancelled')
      .orderBy('award.award_rank')
      .limit(10)
      .execute();
    const streaksByUser = await loadPublicStreaks(
      this.database.connection,
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

  async getSettledCompetition(): Promise<SettledCompetitionResponseDto | null> {
    const latestDraw = await this.latestSettledDraw();
    if (!latestDraw) {
      return null;
    }

    return {
      competitionName: latestDraw.competition_name,
      monthKey: latestDraw.month_key,
      rewardCount: Number(latestDraw.reward_count),
    };
  }

  private latestSettledDraw() {
    return this.database.connection
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

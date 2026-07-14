import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { parseCompetitionRules } from '../competitions/competition-rules';
import type {
  PayoutWinnerResponseDto,
  SettledCompetitionResponseDto,
} from './dto/result.dto';

@Injectable()
export class ResultsService {
  constructor(private readonly database: DatabaseService) {}

  async getPayoutWinners(): Promise<PayoutWinnerResponseDto[]> {
    const latestDraw = await this.latestSettledDraw();
    if (!latestDraw) {
      return [];
    }

    const winners = await this.database.connection
      .selectFrom('draw_winners as winner')
      .innerJoin('profiles as profile', 'profile.user_id', 'winner.user_id')
      .select([
        'profile.callsign',
        'profile.public_identity_mode',
        'profile.public_name',
        'winner.amount_minor',
        'winner.payout_rank',
      ])
      .where('winner.draw_id', '=', latestDraw.id)
      .orderBy('winner.payout_rank')
      .limit(10)
      .execute();

    return winners.map((winner) => ({
      alias:
        winner.public_identity_mode === 'private'
          ? winner.callsign
          : (winner.public_name ?? winner.callsign),
      amountMinor: this.safeMinorUnits(winner.amount_minor),
      payoutRank: winner.payout_rank,
    }));
  }

  async getSettledCompetition(): Promise<SettledCompetitionResponseDto | null> {
    const latestDraw = await this.latestSettledDraw();
    if (!latestDraw) {
      return null;
    }

    const rules = parseCompetitionRules(latestDraw.rules);
    return {
      payoutExponent: rules.payoutExponent,
      payoutPoolAmountMinor: rules.payoutPoolAmountMinor,
      payoutWinnerCount: rules.payoutWinnerCount,
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
      .select(['competition.rules', 'draw.id', 'draw.settled_at'])
      .where('draw.status', '=', 'settled')
      .where('competition.status', '=', 'settled')
      .orderBy('draw.settled_at', 'desc')
      .executeTakeFirst();
  }

  private safeMinorUnits(value: string): number {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Payout result amount is outside the supported range.');
    }
    return amount;
  }
}

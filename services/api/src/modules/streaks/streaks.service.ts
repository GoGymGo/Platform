import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type { StreakSummaryResponseDto } from './dto/streak.dto';
import { loadStreakSummaries } from './streak-query';

@Injectable()
export class StreaksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly profiles: ProfilesService,
  ) {}

  async getMyStreaks(
    principal: AuthenticatedPrincipal,
    now = new Date(),
  ): Promise<StreakSummaryResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const summary = (
          await loadStreakSummaries(transaction, [user.id], now)
        ).get(user.id);
        if (!summary) {
          throw new Error('Authenticated streak summary was not returned.');
        }
        return summary;
      });
  }
}

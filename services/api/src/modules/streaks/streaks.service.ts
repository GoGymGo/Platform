import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { normalizeDateKey } from '../../database/date-key';
import type { Database } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { ProfilesService } from '../profiles/profiles.service';
import { currentRegionVerificationPredicate } from '../regions/current-region-verification';
import type { StreakSummaryResponseDto } from './dto/streak.dto';
import { calculateStreaks } from './streak-calculation';

@Injectable()
export class StreaksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly profiles: ProfilesService,
  ) {}

  async getMyStreaks(
    principal: AuthenticatedPrincipal,
  ): Promise<StreakSummaryResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const timezone = await this.resolveTimezone(transaction, user.id, now);
        const asOfDate = dateKeyInTimezone(now, timezone);
        const verifiedDates = await transaction
          .selectFrom('workout_sessions')
          .select('eligible_date')
          .distinct()
          .where('user_id', '=', user.id)
          .where('status', '=', 'verified')
          .orderBy('eligible_date', 'desc')
          .execute();

        return {
          asOfDate,
          streaks: calculateStreaks(
            verifiedDates.map(({ eligible_date }) =>
              normalizeDateKey(eligible_date),
            ),
            asOfDate,
          ),
          timezone,
        };
      });
  }

  private async resolveTimezone(
    transaction: Transaction<Database>,
    userId: string,
    now: Date,
  ): Promise<string> {
    const currentRegion = await transaction
      .selectFrom('region_verifications as verification')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'verification.region_policy_id',
      )
      .select('region.timezone')
      .where('verification.user_id', '=', userId)
      .where(currentRegionVerificationPredicate('verification', 'region', now))
      .orderBy('verification.verified_at', 'desc')
      .orderBy('verification.created_at', 'desc')
      .executeTakeFirst();
    if (currentRegion) {
      return currentRegion.timezone;
    }

    const latestSessionRegion = await transaction
      .selectFrom('workout_sessions as session')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'session.competition_id',
      )
      .innerJoin(
        'region_policies as region',
        'region.id',
        'competition.region_policy_id',
      )
      .select('region.timezone')
      .where('session.user_id', '=', userId)
      .where('session.status', '=', 'verified')
      .orderBy('session.eligible_date', 'desc')
      .executeTakeFirst();

    return latestSessionRegion?.timezone ?? 'UTC';
  }
}

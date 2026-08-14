import type { Kysely, Transaction } from 'kysely';
import { normalizeDateKey } from '../../database/date-key';
import type { Database } from '../../database/database.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { calculateStreaks, type StreakCounts } from './streak-calculation';
import { currentRegionVerificationPredicate } from '../regions/current-region-verification';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

export async function loadPublicStreaks(
  executor: DatabaseExecutor,
  userIds: readonly string[],
  now = new Date(),
): Promise<Map<string, StreakCounts>> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const [sessions, regionVerifications] = await Promise.all([
    executor
      .selectFrom('workout_sessions')
      .select(['eligible_date', 'user_id'])
      .distinct()
      .where('user_id', 'in', uniqueUserIds)
      .where('status', '=', 'verified')
      .execute(),
    executor
      .selectFrom('region_verifications as verification')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'verification.region_policy_id',
      )
      .select([
        'region.timezone',
        'verification.created_at',
        'verification.user_id',
        'verification.verified_at',
      ])
      .where('verification.user_id', 'in', uniqueUserIds)
      .where(currentRegionVerificationPredicate('verification', 'region', now))
      .orderBy('verification.verified_at', 'desc')
      .orderBy('verification.created_at', 'desc')
      .execute(),
  ]);

  const timezones = new Map<string, string>();
  for (const verification of regionVerifications) {
    if (!timezones.has(verification.user_id)) {
      timezones.set(verification.user_id, verification.timezone);
    }
  }

  const datesByUser = new Map<string, string[]>();
  for (const session of sessions) {
    const dates = datesByUser.get(session.user_id) ?? [];
    dates.push(normalizeDateKey(session.eligible_date));
    datesByUser.set(session.user_id, dates);
  }

  return new Map(
    uniqueUserIds.map((userId) => {
      const timezone = timezones.get(userId) ?? 'UTC';
      return [
        userId,
        calculateStreaks(
          datesByUser.get(userId) ?? [],
          dateKeyInTimezone(now, timezone),
        ),
      ];
    }),
  );
}

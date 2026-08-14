import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import type { StreakCounts } from './streak-calculation';
import { loadStreakSummaries } from './streak-query';

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

  const visibleProfiles = await executor
    .selectFrom('profiles')
    .innerJoin('users', 'users.id', 'profiles.user_id')
    .select('profiles.user_id')
    .where('profiles.user_id', 'in', uniqueUserIds)
    .where('users.status', '=', 'active')
    .where(
      sql<boolean>`COALESCE((profiles.privacy_settings ->> 'showStats')::boolean, TRUE)`,
    )
    .execute();
  const visibleUserIds = visibleProfiles.map(({ user_id }) => user_id);
  const summaries = await loadStreakSummaries(executor, visibleUserIds, now);

  return new Map(
    [...summaries].map(([userId, summary]) => [userId, summary.streaks]),
  );
}

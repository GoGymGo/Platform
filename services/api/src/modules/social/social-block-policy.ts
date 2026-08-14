import { NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../database/database.types';

export type SocialDatabaseExecutor = Kysely<Database> | Transaction<Database>;

export async function lockSocialPair(
  executor: SocialDatabaseExecutor,
  leftUserId: string,
  rightUserId: string,
): Promise<void> {
  const pairKey = [leftUserId.toLowerCase(), rightUserId.toLowerCase()]
    .sort()
    .join(':');
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`.execute(
    executor,
  );
}

export async function socialPairIsBlocked(
  executor: SocialDatabaseExecutor,
  leftUserId: string,
  rightUserId: string,
): Promise<boolean> {
  const block = await executor
    .selectFrom('user_blocks')
    .select('id')
    .where((expression) =>
      expression.or([
        expression.and([
          expression('blocker_user_id', '=', leftUserId),
          expression('blocked_user_id', '=', rightUserId),
        ]),
        expression.and([
          expression('blocker_user_id', '=', rightUserId),
          expression('blocked_user_id', '=', leftUserId),
        ]),
      ]),
    )
    .executeTakeFirst();
  return Boolean(block);
}

export async function requireSocialPairAvailable(
  executor: SocialDatabaseExecutor,
  leftUserId: string,
  rightUserId: string,
): Promise<void> {
  if (await socialPairIsBlocked(executor, leftUserId, rightUserId)) {
    throw new NotFoundException({
      code: 'SOCIAL_MEMBER_NOT_AVAILABLE',
      message: 'That member is not available.',
    });
  }
}

export async function loadBlockedUserIds(
  executor: SocialDatabaseExecutor,
  userId: string,
): Promise<Set<string>> {
  const blocks = await executor
    .selectFrom('user_blocks')
    .select(['blocked_user_id', 'blocker_user_id'])
    .where((expression) =>
      expression.or([
        expression('blocker_user_id', '=', userId),
        expression('blocked_user_id', '=', userId),
      ]),
    )
    .execute();
  return new Set(
    blocks.map((block) =>
      block.blocker_user_id === userId
        ? block.blocked_user_id
        : block.blocker_user_id,
    ),
  );
}

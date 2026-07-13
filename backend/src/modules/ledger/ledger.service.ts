import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { Transaction } from 'kysely';
import type {
  Database,
  JsonObject,
  LedgerReason,
} from '../../database/database.types';

export interface AppendLedgerEntry {
  categoryScoreDelta: number;
  competitionId: string;
  enrollmentId: string;
  goalDays: number;
  metadata?: JsonObject;
  policyVersion: string;
  prizeDrawEntriesDelta: number;
  reason: LedgerReason;
  sourceEventId: string;
  userId: string;
  verifiedDaysDelta: number;
}

@Injectable()
export class LedgerService {
  async append(
    transaction: Transaction<Database>,
    entry: AppendLedgerEntry,
  ): Promise<boolean> {
    const now = new Date();
    const inserted = await transaction
      .insertInto('entry_ledger')
      .values({
        category_score_delta: entry.categoryScoreDelta,
        competition_id: entry.competitionId,
        created_at: now,
        enrollment_id: entry.enrollmentId,
        metadata: entry.metadata ?? {},
        policy_version: entry.policyVersion,
        prize_draw_entries_delta: entry.prizeDrawEntriesDelta,
        reason: entry.reason,
        source_event_id: entry.sourceEventId,
        user_id: entry.userId,
        verified_days_delta: entry.verifiedDaysDelta,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['competition_id', 'user_id', 'reason', 'source_event_id'])
          .doNothing(),
      )
      .returning('id')
      .executeTakeFirst();
    if (!inserted) {
      return false;
    }

    await transaction
      .insertInto('competition_progress')
      .values({
        category_score: entry.categoryScoreDelta,
        competition_id: entry.competitionId,
        enrollment_id: entry.enrollmentId,
        goal_days: entry.goalDays,
        prize_draw_entries: entry.prizeDrawEntriesDelta,
        updated_at: now,
        user_id: entry.userId,
        verified_days: entry.verifiedDaysDelta,
      })
      .onConflict((conflict) =>
        conflict.columns(['competition_id', 'user_id']).doUpdateSet({
          category_score: sql<number>`competition_progress.category_score + ${entry.categoryScoreDelta}`,
          enrollment_id: entry.enrollmentId,
          goal_days: entry.goalDays,
          prize_draw_entries: sql<number>`competition_progress.prize_draw_entries + ${entry.prizeDrawEntriesDelta}`,
          updated_at: now,
          verified_days: sql<number>`competition_progress.verified_days + ${entry.verifiedDaysDelta}`,
        }),
      )
      .executeTakeFirstOrThrow();

    return true;
  }
}

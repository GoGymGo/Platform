import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import {
  buildCompetitionPeriods,
  type CompetitionPeriod,
} from './competition-calendar';

export interface AutomaticWeeklyMatchInput {
  competitionId: string;
  goalDays: number;
  monthKey: string;
  now: Date;
  timezone: string;
  userId: string;
}

@Injectable()
export class AutomaticWeeklyMatchingService {
  async synchronize(
    transaction: Transaction<Database>,
    input: AutomaticWeeklyMatchInput,
  ): Promise<void> {
    const period = automaticWeeklyMatchPeriod(
      input.monthKey,
      dateKeyInTimezone(input.now, input.timezone),
    );
    if (!period) return;

    await sql<void>`SELECT pg_advisory_xact_lock(
      hashtextextended(
        ${`automatic-weekly-match:${input.competitionId}:${period.index}`},
        0
      )
    )`.execute(transaction);

    const existing = await transaction
      .selectFrom('competition_match_participants')
      .select('match_id')
      .where('competition_id', '=', input.competitionId)
      .where('period_index', '=', period.index)
      .where('user_id', '=', input.userId)
      .where('active', '=', true)
      .executeTakeFirst();
    if (existing) return;

    const pendingDirectRequest = await transaction
      .selectFrom('weekly_challenge_requests')
      .select('id')
      .where('competition_id', '=', input.competitionId)
      .where('period_index', '=', period.index)
      .where('status', '=', 'pending')
      .where((expression) =>
        expression.or([
          expression('requester_user_id', '=', input.userId),
          expression('recipient_user_id', '=', input.userId),
        ]),
      )
      .executeTakeFirst();
    if (pendingDirectRequest) return;

    const candidate = await transaction
      .selectFrom('competition_matches as match')
      .innerJoin('competition_enrollments as enrollment', (join) =>
        join
          .onRef('enrollment.competition_id', '=', 'match.competition_id')
          .onRef('enrollment.user_id', '=', 'match.user_a_id'),
      )
      .select(['match.id', 'match.user_a_id'])
      .where('match.competition_id', '=', input.competitionId)
      .where('match.period_index', '=', period.index)
      .where('match.status', '=', 'searching')
      .where('match.user_b_id', 'is', null)
      .where('match.weekly_challenge_request_id', 'is', null)
      .where('match.user_a_id', '!=', input.userId)
      .where('enrollment.status', '=', 'active')
      .where('enrollment.goal_days', '=', input.goalDays)
      .where(
        sql<boolean>`NOT EXISTS (
          SELECT 1
          FROM user_blocks AS block
          WHERE (block.blocker_user_id = ${input.userId}
                 AND block.blocked_user_id = match.user_a_id)
             OR (block.blocker_user_id = match.user_a_id
                 AND block.blocked_user_id = ${input.userId})
        )`,
      )
      .where(
        sql<boolean>`NOT EXISTS (
          SELECT 1
          FROM weekly_challenge_requests AS request
          WHERE request.competition_id = ${input.competitionId}
            AND request.period_index = ${period.index}
            AND request.status = 'pending'
            AND (
              request.requester_user_id = match.user_a_id
              OR request.recipient_user_id = match.user_a_id
            )
        )`,
      )
      .orderBy('match.created_at')
      .orderBy('match.id')
      .forUpdate('match')
      .skipLocked()
      .executeTakeFirst();

    if (!candidate) {
      await transaction
        .insertInto('competition_matches')
        .values({
          competition_id: input.competitionId,
          created_at: input.now,
          outcome: null,
          period_end_date: period.endDateKey,
          period_index: period.index,
          period_start_date: period.startDateKey,
          settled_at: null,
          status: 'searching',
          user_a_id: input.userId,
          user_b_id: null,
          weekly_challenge_request_id: null,
        })
        .executeTakeFirstOrThrow();
      return;
    }

    await transaction
      .updateTable('competition_matches')
      .set({ status: 'matched', user_b_id: input.userId })
      .where('id', '=', candidate.id)
      .where('status', '=', 'searching')
      .where('user_b_id', 'is', null)
      .executeTakeFirstOrThrow();

    await transaction
      .updateTable('weekly_challenge_requests')
      .set({
        cancellation_reason: 'automatic_match_created',
        responded_at: input.now,
        status: 'cancelled',
      })
      .where('competition_id', '=', input.competitionId)
      .where('period_index', '=', period.index)
      .where('status', '=', 'pending')
      .where((expression) =>
        expression.or([
          expression('requester_user_id', 'in', [
            candidate.user_a_id,
            input.userId,
          ]),
          expression('recipient_user_id', 'in', [
            candidate.user_a_id,
            input.userId,
          ]),
        ]),
      )
      .execute();
  }
}

export function automaticWeeklyMatchPeriod(
  monthKey: string,
  regionalDateKey: string,
): CompetitionPeriod | null {
  const periods = buildCompetitionPeriods(monthKey);
  if (regionalDateKey < periods[0].startDateKey) return periods[0];
  return (
    periods.find(
      (period) =>
        regionalDateKey >= period.startDateKey &&
        regionalDateKey <= period.endDateKey,
    ) ?? null
  );
}

function dateKeyInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

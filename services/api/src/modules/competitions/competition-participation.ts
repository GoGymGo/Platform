import type { Transaction } from 'kysely';
import type { Database } from '../../database/database.types';

export interface ClosedCompetitionEnrollment {
  id: string;
  userId: string;
}

export async function closeCompetitionParticipation(
  transaction: Transaction<Database>,
  competitionId: string,
  closedAt: Date,
): Promise<ClosedCompetitionEnrollment[]> {
  const enrollments = await transaction
    .updateTable('competition_enrollments')
    .set({ status: 'withdrawn' })
    .where('competition_id', '=', competitionId)
    .where('status', '=', 'active')
    .returning(['id', 'user_id'])
    .execute();

  await transaction
    .updateTable('workout_sessions')
    .set({
      completed_at: closedAt,
      status: 'cancelled',
      updated_at: closedAt,
    })
    .where('competition_id', '=', competitionId)
    .where('status', '=', 'active')
    .execute();
  await transaction
    .updateTable('weekly_challenge_requests')
    .set({
      cancellation_reason: 'competition_cancelled',
      responded_at: closedAt,
      status: 'cancelled',
    })
    .where('competition_id', '=', competitionId)
    .where('status', 'in', ['accepted', 'pending'])
    .execute();
  await transaction
    .updateTable('competition_matches')
    .set({ settled_at: closedAt, status: 'cancelled' })
    .where('competition_id', '=', competitionId)
    .where('status', 'in', ['matched', 'searching'])
    .execute();

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    userId: enrollment.user_id,
  }));
}

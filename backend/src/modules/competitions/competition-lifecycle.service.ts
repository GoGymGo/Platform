import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveCompetitionStart } from './competition-lifecycle';

export interface CompetitionLifecycleResult {
  activated: number;
  cancelled: number;
}

@Injectable()
export class CompetitionLifecycleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async processDueStarts(limit = 50): Promise<CompetitionLifecycleResult> {
    const now = new Date();
    const due = await this.database.connection
      .selectFrom('competitions')
      .select('id')
      .where('status', '=', 'registration')
      .where('starts_at', '<=', now)
      .orderBy('starts_at')
      .limit(limit)
      .execute();
    const result: CompetitionLifecycleResult = { activated: 0, cancelled: 0 };

    for (const candidate of due) {
      const transition = await this.database.connection
        .transaction()
        .execute(async (transaction) => {
          const competition = await transaction
            .selectFrom('competitions')
            .select([
              'configuration_version',
              'id',
              'minimum_entrants',
              'starts_at',
              'status',
            ])
            .where('id', '=', candidate.id)
            .forUpdate()
            .executeTakeFirst();
          if (
            !competition ||
            competition.status !== 'registration' ||
            competition.starts_at > now
          ) {
            return null;
          }

          const enrollmentCount = await transaction
            .selectFrom('competition_enrollments as enrollment')
            .innerJoin('users as user', 'user.id', 'enrollment.user_id')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('enrollment.competition_id', '=', competition.id)
            .where('enrollment.status', '=', 'active')
            .where('user.email', 'is not', null)
            .where('user.email_verified', '=', true)
            .where('user.status', '=', 'active')
            .executeTakeFirstOrThrow();
          const activeEntrants = Number(enrollmentCount.count);
          const nextStatus = resolveCompetitionStart(
            competition.minimum_entrants,
            activeEntrants,
          );

          await transaction
            .updateTable('competitions')
            .set({
              configuration_version: sql<number>`configuration_version + 1`,
              status: nextStatus,
              updated_at: now,
            })
            .where('id', '=', competition.id)
            .where('status', '=', 'registration')
            .executeTakeFirstOrThrow();

          if (nextStatus === 'cancelled') {
            const enrollments = await transaction
              .selectFrom('competition_enrollments')
              .select(['id', 'user_id'])
              .where('competition_id', '=', competition.id)
              .where('status', '=', 'active')
              .execute();
            await transaction
              .updateTable('competition_enrollments')
              .set({ status: 'withdrawn' })
              .where('competition_id', '=', competition.id)
              .where('status', '=', 'active')
              .execute();
            for (const enrollment of enrollments) {
              await this.notifications.enqueue(
                transaction,
                enrollment.user_id,
                'competition_cancelled',
                { competitionId: competition.id },
              );
            }
          }

          await transaction
            .insertInto('operator_audit_events')
            .values({
              action:
                nextStatus === 'active'
                  ? 'competition.activated'
                  : 'competition.cancelled_under_minimum',
              actor_user_id: null,
              created_at: now,
              entity_id: competition.id,
              entity_type: 'competitions',
              next_state: {
                activeEntrants,
                status: nextStatus,
                version: competition.configuration_version + 1,
              },
              previous_state: {
                status: competition.status,
                version: competition.configuration_version,
              },
              reason:
                nextStatus === 'active'
                  ? 'Scheduled competition start reached.'
                  : 'Minimum entrant threshold was not reached.',
              request_id: `worker:competition-start:${competition.id}`,
            })
            .executeTakeFirstOrThrow();
          return nextStatus;
        });

      if (transition === 'active') result.activated += 1;
      if (transition === 'cancelled') result.cancelled += 1;
    }

    return result;
  }
}

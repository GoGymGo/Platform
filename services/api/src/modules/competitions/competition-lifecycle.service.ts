import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  resolveCompetitionStart,
  type CompetitionStartResolution,
} from './competition-lifecycle';
import { closeCompetitionParticipation } from './competition-participation';
import { CompetitionScoringService } from './competition-scoring.service';

export interface CompetitionLifecycleResult {
  activated: number;
  cancelled: number;
}

@Injectable()
export class CompetitionLifecycleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly scoring: CompetitionScoringService,
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
      const transition = await this.processDueStart(candidate.id, now);

      if (transition === 'active') result.activated += 1;
      if (transition === 'cancelled') result.cancelled += 1;
    }

    return result;
  }

  processDueStart(
    competitionId: string,
    now = new Date(),
  ): Promise<CompetitionStartResolution | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const competition = await transaction
          .selectFrom('competitions')
          .select([
            'configuration_version',
            'id',
            'minimum_entrants',
            'month_key',
            'starts_at',
            'status',
          ])
          .where('id', '=', competitionId)
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
          .select((expression) => expression.fn.countAll<number>().as('count'))
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
        let closedEnrollments = 0;

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

        if (nextStatus === 'active') {
          await this.scoring.ensureWeeklyChallengeMatches(
            transaction,
            competition.id,
            competition.month_key,
            now,
          );
        }

        if (nextStatus === 'cancelled') {
          const enrollments = await closeCompetitionParticipation(
            transaction,
            competition.id,
            now,
          );
          closedEnrollments = enrollments.length;
          for (const enrollment of enrollments) {
            await this.notifications.enqueue(
              transaction,
              enrollment.userId,
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
              closedEnrollments,
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
            request_id: `competition-start:${competition.id}`,
          })
          .executeTakeFirstOrThrow();
        return nextStatus;
      });
  }
}

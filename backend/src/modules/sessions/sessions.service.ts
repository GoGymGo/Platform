import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { Database, JsonObject } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { stableJson } from '../../common/idempotency/stable-json';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { parseCompetitionRules } from '../competitions/competition-rules';
import { LedgerService } from '../ledger/ledger.service';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  AppendSessionEventDto,
  CompleteSessionDto,
  CreateSessionDto,
  SessionCompletionResponseDto,
  SessionEventResponseDto,
  SessionResponseDto,
} from './dto/session.dto';
import { assessSessionSubmission } from './session-assessment';
import { buildSessionEventPayload } from './session-event-payload';

interface SessionJson extends JsonObject {
  completedAt: string | null;
  competitionId: string;
  eligibleDate: string;
  id: string;
  policyVersion: string;
  startedAt: string;
  status: 'active' | 'pending_review' | 'rejected';
}

interface SessionEventJson extends JsonObject {
  eventId: string;
  eventType:
    'device_attestation' | 'face_check' | 'gym_qr_scan' | 'heart_rate_sample';
  id: string;
  receivedAt: string;
}

interface CompletionJson extends SessionJson {
  eligibleForReview: boolean;
  violations: string[];
}

export interface VerifySessionInput {
  operatorUserId: string;
  reason: string;
  requestId: string;
  sessionId: string;
  trustedEvidenceSummary: JsonObject;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly profiles: ProfilesService,
  ) {}

  async create(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    request: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    return this.idempotency.execute<SessionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          clientStartedAt: request.clientStartedAt ?? null,
          competitionId: request.competitionId,
        },
        responseCode: 201,
        scope: 'sessions:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const enrollment = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'enrollment.competition_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.ends_at',
            'competition.rules_version',
            'competition.starts_at',
            'competition.status as competition_status',
            'enrollment.id as enrollment_id',
            'region.timezone',
          ])
          .where('enrollment.competition_id', '=', request.competitionId)
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .executeTakeFirst();
        if (!enrollment) {
          throw new NotFoundException({
            code: 'ACTIVE_ENROLLMENT_NOT_FOUND',
            message:
              'An active enrollment is required to start a competition session.',
          });
        }
        if (
          enrollment.competition_status !== 'active' ||
          now < enrollment.starts_at ||
          now > enrollment.ends_at
        ) {
          throw new ConflictException({
            code: 'COMPETITION_NOT_ACTIVE',
            message:
              'The competition is not currently accepting workout sessions.',
          });
        }

        const existingActiveSession = await transaction
          .selectFrom('workout_sessions')
          .select('id')
          .where('user_id', '=', user.id)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (existingActiveSession) {
          throw new ConflictException({
            code: 'ACTIVE_SESSION_EXISTS',
            message:
              'Complete or cancel the current workout session before starting another.',
          });
        }

        const session = await transaction
          .insertInto('workout_sessions')
          .values({
            client_started_at: request.clientStartedAt
              ? new Date(request.clientStartedAt)
              : null,
            competition_id: request.competitionId,
            created_at: now,
            eligible_date: dateKeyInTimezone(now, enrollment.timezone),
            enrollment_id: enrollment.enrollment_id,
            policy_version: enrollment.rules_version,
            started_at: now,
            status: 'active',
            updated_at: now,
            user_id: user.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return this.sessionJson(session);
      },
    );
  }

  async appendEvent(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    idempotencyKey: string,
    event: AppendSessionEventDto,
  ): Promise<SessionEventResponseDto> {
    const eventPayload = buildSessionEventPayload(event);
    return this.idempotency.execute<SessionEventJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          eventId: event.eventId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          payload: eventPayload,
          sessionId,
        },
        responseCode: 201,
        scope: 'session-events:append',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const session = await transaction
          .selectFrom('workout_sessions')
          .selectAll()
          .where('id', '=', sessionId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (!session) {
          throw new NotFoundException({
            code: 'SESSION_NOT_FOUND',
            message: 'The workout session was not found.',
          });
        }
        if (session.status !== 'active') {
          throw new ConflictException({
            code: 'SESSION_NOT_ACTIVE',
            message: 'Evidence can only be appended to an active session.',
          });
        }

        const occurredAt = new Date(event.occurredAt);
        const receivedAt = new Date();
        if (
          occurredAt.getTime() < session.started_at.getTime() - 5 * 60_000 ||
          occurredAt.getTime() > receivedAt.getTime() + 5 * 60_000
        ) {
          throw new UnprocessableEntityException({
            code: 'SESSION_EVENT_TIME_INVALID',
            message:
              'Session evidence occurred outside the accepted server-time window.',
          });
        }

        let stored = await transaction
          .insertInto('session_events')
          .values({
            client_event_id: event.eventId,
            event_type: event.eventType,
            occurred_at: occurredAt,
            payload: eventPayload,
            received_at: receivedAt,
            session_id: session.id,
          })
          .onConflict((conflict) =>
            conflict.columns(['session_id', 'client_event_id']).doNothing(),
          )
          .returningAll()
          .executeTakeFirst();
        if (!stored) {
          stored = await transaction
            .selectFrom('session_events')
            .selectAll()
            .where('session_id', '=', session.id)
            .where('client_event_id', '=', event.eventId)
            .executeTakeFirstOrThrow();
          if (
            stored.event_type !== event.eventType ||
            stored.occurred_at.getTime() !== occurredAt.getTime() ||
            stableJson(stored.payload) !== stableJson(eventPayload)
          ) {
            throw new ConflictException({
              code: 'SESSION_EVENT_REPLAY_MISMATCH',
              message:
                'This session event identifier was already used for different evidence.',
            });
          }
        }

        return {
          eventId: stored.client_event_id,
          eventType: stored.event_type,
          id: stored.id,
          receivedAt: stored.received_at.toISOString(),
        };
      },
    );
  }

  async complete(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    idempotencyKey: string,
    request: CompleteSessionDto,
  ): Promise<SessionCompletionResponseDto> {
    return this.idempotency.execute<CompletionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          clientCompletedAt: request.clientCompletedAt ?? null,
          sessionId,
        },
        scope: 'sessions:complete',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const session = await transaction
          .selectFrom('workout_sessions as session')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'session.competition_id',
          )
          .select([
            'competition.rules',
            'session.competition_id',
            'session.eligible_date',
            'session.id',
            'session.policy_version',
            'session.started_at',
            'session.status',
          ])
          .where('session.id', '=', sessionId)
          .where('session.user_id', '=', user.id)
          .executeTakeFirst();
        if (!session) {
          throw new NotFoundException({
            code: 'SESSION_NOT_FOUND',
            message: 'The session was not found.',
          });
        }
        if (session.status !== 'active') {
          throw new ConflictException({
            code: 'SESSION_NOT_ACTIVE',
            message: 'Only an active workout session can be completed.',
          });
        }

        const completedAt = new Date();
        const events = await transaction
          .selectFrom('session_events')
          .select(['event_type', 'occurred_at'])
          .where('session_id', '=', session.id)
          .orderBy('occurred_at')
          .execute();
        const assessment = assessSessionSubmission(
          session.started_at,
          completedAt,
          events.map((event) => ({
            eventType: event.event_type,
            occurredAt: event.occurred_at,
          })),
          parseCompetitionRules(session.rules),
        );
        await transaction
          .updateTable('workout_sessions')
          .set({
            completed_at: completedAt,
            status: assessment.status,
            updated_at: completedAt,
            verification_summary: {
              clientCompletedAt: request.clientCompletedAt ?? null,
              durationMinutes: assessment.durationMinutes,
              eligibleForReview: assessment.eligibleForReview,
              evidenceTrust: 'unverified',
              violations: assessment.violations,
            },
          })
          .where('id', '=', session.id)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();

        return {
          completedAt: completedAt.toISOString(),
          competitionId: session.competition_id,
          eligibleDate: session.eligible_date,
          eligibleForReview: assessment.eligibleForReview,
          id: session.id,
          policyVersion: session.policy_version,
          startedAt: session.started_at.toISOString(),
          status: assessment.status,
          violations: assessment.violations,
        };
      },
    );
  }

  async verifySession(input: VerifySessionInput): Promise<boolean> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const session = await transaction
          .selectFrom('workout_sessions as session')
          .innerJoin(
            'competition_enrollments as enrollment',
            'enrollment.id',
            'session.enrollment_id',
          )
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'session.competition_id',
          )
          .select([
            'competition.rules',
            'competition.rules_version',
            'enrollment.goal_days',
            'enrollment.status as enrollment_status',
            'session.competition_id',
            'session.eligible_date',
            'session.enrollment_id',
            'session.id',
            'session.status',
            'session.user_id',
          ])
          .where('session.id', '=', input.sessionId)
          .forUpdate()
          .executeTakeFirst();
        if (!session) {
          throw new NotFoundException({
            code: 'SESSION_NOT_FOUND',
            message: 'The session was not found.',
          });
        }
        if (session.status === 'verified') {
          return false;
        }
        if (session.status !== 'pending_review') {
          throw new ConflictException({
            code: 'SESSION_NOT_REVIEWABLE',
            message: 'Only a pending-review session can be verified.',
          });
        }
        if (session.enrollment_status !== 'active') {
          throw new ConflictException({
            code: 'ACTIVE_ENROLLMENT_REQUIRED',
            message:
              'A session cannot be verified after its competition enrollment is no longer active.',
          });
        }

        const alreadyVerified = await transaction
          .selectFrom('workout_sessions')
          .select('id')
          .where('competition_id', '=', session.competition_id)
          .where('user_id', '=', session.user_id)
          .where('eligible_date', '=', session.eligible_date)
          .where('status', '=', 'verified')
          .executeTakeFirst();
        if (alreadyVerified) {
          throw new ConflictException({
            code: 'VERIFIED_DAY_ALREADY_AWARDED',
            message:
              'This user already has a verified competition session for the eligible date.',
          });
        }

        const now = new Date();
        await transaction
          .updateTable('workout_sessions')
          .set({
            status: 'verified',
            updated_at: now,
            verification_summary: input.trustedEvidenceSummary,
          })
          .where('id', '=', session.id)
          .where('status', '=', 'pending_review')
          .executeTakeFirstOrThrow();
        const rules = parseCompetitionRules(session.rules);
        await this.ledger.append(transaction, {
          categoryScoreDelta: rules.verifiedSessionCategoryScore,
          competitionId: session.competition_id,
          enrollmentId: session.enrollment_id,
          goalDays: session.goal_days,
          metadata: {
            eligibleDate: session.eligible_date,
            reviewReason: input.reason,
          },
          policyVersion: session.rules_version,
          prizeDrawEntriesDelta: rules.verifiedSessionPrizeDrawEntries,
          reason: 'verified_session',
          sourceEventId: session.id,
          userId: session.user_id,
          verifiedDaysDelta: 1,
        });
        await this.appendOperatorAudit(transaction, input, session.user_id);
        return true;
      });
  }

  private appendOperatorAudit(
    transaction: Transaction<Database>,
    input: VerifySessionInput,
    subjectUserId: string,
  ): Promise<unknown> {
    return transaction
      .insertInto('operator_audit_events')
      .values({
        action: 'session.verified',
        actor_user_id: input.operatorUserId,
        created_at: new Date(),
        entity_id: input.sessionId,
        entity_type: 'workout_sessions',
        next_state: { status: 'verified', subjectUserId },
        previous_state: { status: 'pending_review' },
        reason: input.reason,
        request_id: input.requestId,
      })
      .executeTakeFirstOrThrow();
  }

  private sessionJson(session: {
    completed_at: Date | null;
    competition_id: string;
    eligible_date: string;
    id: string;
    policy_version: string;
    started_at: Date;
    status: 'active' | 'cancelled' | 'pending_review' | 'rejected' | 'verified';
  }): SessionJson {
    if (!['active', 'pending_review', 'rejected'].includes(session.status)) {
      throw new Error('Unexpected session state in client session response.');
    }
    return {
      completedAt: session.completed_at?.toISOString() ?? null,
      competitionId: session.competition_id,
      eligibleDate: session.eligible_date,
      id: session.id,
      policyVersion: session.policy_version,
      startedAt: session.started_at.toISOString(),
      status: session.status as SessionJson['status'],
    };
  }
}

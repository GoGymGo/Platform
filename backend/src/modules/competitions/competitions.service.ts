import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql } from 'kysely';
import type { JsonObject } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { LedgerService } from '../ledger/ledger.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  assertMonthKey,
  buildCompetitionPeriods,
} from './competition-calendar';
import { parseCompetitionRules } from './competition-rules';
import type {
  CompetitionMatchResponseDto,
  CompetitionResponseDto,
  CreateEnrollmentDto,
  EnrollmentResponseDto,
} from './dto/competition.dto';

interface EnrollmentJson extends JsonObject {
  competitionId: string;
  enrolledAt: string;
  goalDays: number;
  id: string;
  status: 'active';
}

@Injectable()
export class CompetitionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly profiles: ProfilesService,
  ) {}

  async getCurrent(
    principal: AuthenticatedPrincipal,
  ): Promise<CompetitionResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const competition = await transaction
          .selectFrom('region_verifications as verification')
          .innerJoin(
            'competitions as competition',
            'competition.region_policy_id',
            'verification.region_policy_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.currency',
            'competition.ends_at',
            'competition.id',
            'competition.month_key',
            'competition.name',
            'competition.registration_closes_at',
            'competition.registration_opens_at',
            'competition.rules',
            'competition.rules_version',
            'competition.starts_at',
            'competition.status',
            'region.code as region_code',
            'region.metro_name as region_name',
          ])
          .where('verification.user_id', '=', user.id)
          .where('verification.status', '=', 'approved')
          .where((expression) =>
            expression.or([
              expression('verification.expires_at', 'is', null),
              expression('verification.expires_at', '>', now),
            ]),
          )
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.ends_at', '>', now)
          .orderBy('competition.starts_at')
          .executeTakeFirst();
        if (!competition) {
          return null;
        }

        const brackets = await transaction
          .selectFrom('competition_goal_brackets')
          .select('goal_days')
          .where('competition_id', '=', competition.id)
          .orderBy('goal_days')
          .execute();

        return {
          currency: competition.currency,
          endsAt: competition.ends_at.toISOString(),
          goalDays: brackets.map((bracket) => bracket.goal_days),
          id: competition.id,
          monthKey: competition.month_key,
          name: competition.name,
          regionCode: competition.region_code,
          regionName: competition.region_name,
          registrationClosesAt:
            competition.registration_closes_at.toISOString(),
          registrationOpensAt: competition.registration_opens_at.toISOString(),
          rules: parseCompetitionRules(competition.rules),
          rulesVersion: competition.rules_version,
          startsAt: competition.starts_at.toISOString(),
          status: competition.status,
        };
      });
  }

  async enroll(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    request: CreateEnrollmentDto,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.idempotency.execute<EnrollmentJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          ageEligibilityAttested: request.ageEligibilityAttested,
          competitionId,
          goalDays: request.goalDays,
          regionVerificationId: request.regionVerificationId,
          rulesAccepted: request.rulesAccepted,
        },
        responseCode: 201,
        scope: 'competition-enrollments:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const competition = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', competitionId)
          .executeTakeFirst();
        if (!competition) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        if (
          !['registration', 'active'].includes(competition.status) ||
          now < competition.registration_opens_at ||
          now > competition.registration_closes_at
        ) {
          throw new ConflictException({
            code: 'COMPETITION_REGISTRATION_CLOSED',
            message: 'Registration is not open for this competition.',
          });
        }

        const [bracket, verification, enrollmentCount] = await Promise.all([
          transaction
            .selectFrom('competition_goal_brackets')
            .select('goal_days')
            .where('competition_id', '=', competition.id)
            .where('goal_days', '=', request.goalDays)
            .executeTakeFirst(),
          transaction
            .selectFrom('region_verifications')
            .selectAll()
            .where('id', '=', request.regionVerificationId)
            .where('user_id', '=', user.id)
            .where('region_policy_id', '=', competition.region_policy_id)
            .where('status', '=', 'approved')
            .where((expression) =>
              expression.or([
                expression('expires_at', 'is', null),
                expression('expires_at', '>', now),
              ]),
            )
            .executeTakeFirst(),
          transaction
            .selectFrom('competition_enrollments')
            .select((expression) =>
              expression.fn.countAll<number>().as('count'),
            )
            .where('competition_id', '=', competition.id)
            .where('status', '=', 'active')
            .executeTakeFirstOrThrow(),
        ]);
        if (!bracket) {
          throw new UnprocessableEntityException({
            code: 'GOAL_BRACKET_UNAVAILABLE',
            message: 'The selected goal bracket is not available.',
          });
        }
        if (!verification) {
          throw new UnprocessableEntityException({
            code: 'APPROVED_REGION_VERIFICATION_REQUIRED',
            message:
              'An approved, current verification for the competition region is required.',
          });
        }
        if (
          competition.entrant_cap !== null &&
          Number(enrollmentCount.count) >= competition.entrant_cap
        ) {
          throw new ConflictException({
            code: 'COMPETITION_FULL',
            message: 'The competition has reached its entrant cap.',
          });
        }

        const acceptance = await transaction
          .insertInto('competition_rule_acceptances')
          .values({
            accepted_at: now,
            age_eligibility_attested: request.ageEligibilityAttested,
            competition_id: competition.id,
            metadata: { source: 'mobile' },
            rules_version: competition.rules_version,
            user_id: user.id,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['competition_id', 'user_id', 'rules_version'])
              .doUpdateSet({
                age_eligibility_attested: request.ageEligibilityAttested,
              }),
          )
          .returning('id')
          .executeTakeFirstOrThrow();
        let enrollment = await transaction
          .insertInto('competition_enrollments')
          .values({
            competition_id: competition.id,
            enrolled_at: now,
            goal_days: request.goalDays,
            region_verification_id: verification.id,
            rules_acceptance_id: acceptance.id,
            status: 'active',
            user_id: user.id,
          })
          .onConflict((conflict) =>
            conflict.columns(['competition_id', 'user_id']).doNothing(),
          )
          .returningAll()
          .executeTakeFirst();
        enrollment ??= await transaction
          .selectFrom('competition_enrollments')
          .selectAll()
          .where('competition_id', '=', competition.id)
          .where('user_id', '=', user.id)
          .executeTakeFirstOrThrow();

        const rules = parseCompetitionRules(competition.rules);
        await this.ledger.append(transaction, {
          categoryScoreDelta: 0,
          competitionId: competition.id,
          enrollmentId: enrollment.id,
          goalDays: enrollment.goal_days,
          metadata: { source: 'competition_enrollment' },
          policyVersion: competition.rules_version,
          prizeDrawEntriesDelta: rules.signupPrizeDrawEntries,
          reason: 'enrollment',
          sourceEventId: enrollment.id,
          userId: user.id,
          verifiedDaysDelta: 0,
        });

        return {
          competitionId: competition.id,
          enrolledAt: enrollment.enrolled_at.toISOString(),
          goalDays: enrollment.goal_days,
          id: enrollment.id,
          status: 'active',
        };
      },
    );

    return result;
  }

  async getEnrollmentCount(monthKey: string, region: string): Promise<number> {
    assertMonthKey(monthKey);
    const row = await this.database.connection
      .selectFrom('competition_enrollments as enrollment')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'enrollment.competition_id',
      )
      .innerJoin(
        'region_policies as policy',
        'policy.id',
        'competition.region_policy_id',
      )
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('competition.month_key', '=', monthKey)
      .where('enrollment.status', '=', 'active')
      .where(
        sql<boolean>`(lower(policy.code) = lower(${region}) OR lower(policy.metro_name) = lower(${region}))`,
      )
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async getMatches(
    principal: AuthenticatedPrincipal,
    monthKey: string,
    goalDays: number,
    region: string,
  ): Promise<CompetitionMatchResponseDto[]> {
    assertMonthKey(monthKey);
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const competition = await transaction
          .selectFrom('competitions as competition')
          .innerJoin(
            'region_policies as policy',
            'policy.id',
            'competition.region_policy_id',
          )
          .select(['competition.id', 'policy.metro_name'])
          .where('competition.month_key', '=', monthKey)
          .where(
            sql<boolean>`(lower(policy.code) = lower(${region}) OR lower(policy.metro_name) = lower(${region}))`,
          )
          .executeTakeFirst();
        if (!competition) {
          return [];
        }

        const enrollment = await transaction
          .selectFrom('competition_enrollments')
          .select('id')
          .where('competition_id', '=', competition.id)
          .where('user_id', '=', user.id)
          .where('goal_days', '=', goalDays)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!enrollment) {
          return [];
        }

        const matches = await transaction
          .selectFrom('competition_matches')
          .selectAll()
          .where('competition_id', '=', competition.id)
          .where((expression) =>
            expression.or([
              expression('user_a_id', '=', user.id),
              expression('user_b_id', '=', user.id),
            ]),
          )
          .execute();
        const matchesByPeriod = new Map(
          matches.map((match) => [match.period_index, match]),
        );

        return Promise.all(
          buildCompetitionPeriods(monthKey).map(async (period) => {
            const match = matchesByPeriod.get(period.index);
            const opponentId =
              match?.user_a_id === user.id
                ? match.user_b_id
                : (match?.user_a_id ?? null);
            if (!match || !opponentId) {
              return {
                availability:
                  match?.status === 'settled' ? 'solo' : 'searching',
                opponentAlias: 'MATCH_PENDING',
                opponentVerifiedDateKeys: [],
                periodIndex: period.index,
                region: competition.metro_name.toUpperCase(),
              };
            }

            const [opponent, verifiedSessions] = await Promise.all([
              transaction
                .selectFrom('profiles')
                .select(['callsign', 'public_identity_mode', 'public_name'])
                .where('user_id', '=', opponentId)
                .executeTakeFirstOrThrow(),
              transaction
                .selectFrom('workout_sessions')
                .select('eligible_date')
                .where('competition_id', '=', competition.id)
                .where('user_id', '=', opponentId)
                .where('status', '=', 'verified')
                .where('eligible_date', '>=', period.startDateKey)
                .where('eligible_date', '<=', period.endDateKey)
                .orderBy('eligible_date')
                .execute(),
            ]);

            return {
              availability: 'matched',
              opponentAlias:
                opponent.public_identity_mode === 'private'
                  ? opponent.callsign
                  : opponent.public_name || opponent.callsign,
              opponentVerifiedDateKeys: verifiedSessions.map(
                (session) => session.eligible_date,
              ),
              periodIndex: period.index,
              region: competition.metro_name.toUpperCase(),
            };
          }),
        );
      });
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { Database, JsonObject } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import { normalizeDateKey } from '../../database/date-key';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  hashOpaqueValue,
  isAcceptableLocationAccuracy,
  isWithinGymGeofence,
} from '../gyms/gym-scan-policy';
import { LedgerService } from '../ledger/ledger.service';
import { LegalDocumentsService } from '../legal/legal-documents.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  lockSocialPair,
  loadBlockedUserIds,
  requireSocialPairAvailable,
} from '../social/social-block-policy';
import { currentRegionVerificationPredicate } from '../regions/current-region-verification';
import type { StreakCounts } from '../streaks/streak-calculation';
import { loadPublicStreaks } from '../streaks/public-streaks';
import {
  assertMonthKey,
  buildCompetitionPeriods,
  dateKeyInTimezone,
} from './competition-calendar';
import {
  availableRegistrationGoalDays,
  competitionRegistrationAvailability,
} from './competition-registration';
import { CompetitionLifecycleService } from './competition-lifecycle.service';
import { parseCompetitionRules } from './competition-rules';
import { calculateWeeklyScore } from './competition-scoring';
import type {
  CompetitionMatchResponseDto,
  CompetitionResponseDto,
  CreateEnrollmentDto,
  CurrentCompetitionQueryDto,
  CreateWeeklyChallengeRequestDto,
  EligibleWeeklyChallengePartnerDto,
  EnrollmentResponseDto,
  WeeklyChallengePeriodQueryDto,
  WeeklyChallengeRequestResponseDto,
} from './dto/competition.dto';

interface EnrollmentJson extends JsonObject {
  competitionId: string;
  enrolledAt: string;
  goalDays: number;
  gymCredentialVersion: number | null;
  gymLocationId: string | null;
  gymName: string | null;
  id: string;
  status: 'active';
}

interface EnrollmentWithdrawalJson extends JsonObject {
  competitionId: string;
  enrolledAt: string;
  goalDays: number;
  gymCredentialVersion: number | null;
  gymLocationId: string | null;
  gymName: string | null;
  id: string;
  status: 'withdrawn';
}

interface WeeklyChallengeRequestJson extends JsonObject {
  id: string;
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  goalDays: number;
  partnerAlias: string;
  partnerStreaks: StreakCountsJson;
  periodIndex: 1 | 2 | 3 | 4;
  status: 'accepted' | 'cancelled' | 'declined' | 'pending';
}

interface StreakCountsJson extends JsonObject {
  daily: number;
  monthly: number;
  projectionVersion: 'streaks-v1';
  weekly: number;
  yearly: number;
}

@Injectable()
export class CompetitionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly legalDocuments: LegalDocumentsService,
    private readonly profiles: ProfilesService,
    private readonly lifecycle: CompetitionLifecycleService,
  ) {}

  getCurrent(
    principal: AuthenticatedPrincipal,
    query: CurrentCompetitionQueryDto = {},
  ): Promise<CompetitionResponseDto | null> {
    return this.findCurrentCompetition(principal, query);
  }

  resolveGymQrCompetition(
    principal: AuthenticatedPrincipal,
    credential: string,
  ): Promise<CompetitionResponseDto | null> {
    return this.findCurrentCompetition(
      principal,
      {},
      hashOpaqueValue(credential),
    );
  }

  private async findCurrentCompetition(
    principal: AuthenticatedPrincipal,
    query: CurrentCompetitionQueryDto,
    credentialHash?: string,
    synchronizeDueStart = true,
  ): Promise<CompetitionResponseDto | null> {
    const now = new Date();
    const competition = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        let competitionQuery = transaction
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
          .leftJoin('competition_enrollments as current_enrollment', (join) =>
            join
              .onRef('current_enrollment.competition_id', '=', 'competition.id')
              .on('current_enrollment.user_id', '=', user.id)
              .on('current_enrollment.status', '=', 'active'),
          )
          .select([
            'competition.ends_at',
            'competition.entrant_cap',
            'competition.id',
            'competition.minimum_entrants',
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
          .where(
            currentRegionVerificationPredicate('verification', 'region', now),
          )
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.deleted_at', 'is', null)
          .where('competition.ends_at', '>', now)
          .where((expression) =>
            expression.or([
              expression('current_enrollment.id', 'is not', null),
              expression.and([
                expression('competition.registration_opens_at', '<=', now),
                expression('competition.registration_closes_at', '>', now),
              ]),
            ]),
          )
          .orderBy(
            sql<number>`CASE WHEN current_enrollment.id IS NULL THEN 1 ELSE 0 END`,
          )
          .orderBy('competition.starts_at')
          .orderBy('competition.id');
        if (query.monthKey) {
          assertMonthKey(query.monthKey);
          competitionQuery = competitionQuery.where(
            'competition.month_key',
            '=',
            query.monthKey,
          );
        }
        if (query.region) {
          competitionQuery = competitionQuery.where(
            'region.code',
            '=',
            query.region,
          );
        }
        if (credentialHash) {
          competitionQuery = competitionQuery
            .innerJoin(
              'gym_qr_credentials as resolved_credential',
              'resolved_credential.competition_id',
              'competition.id',
            )
            .innerJoin(
              'competition_gym_locations as resolved_assignment',
              (join) =>
                join
                  .onRef(
                    'resolved_assignment.competition_id',
                    '=',
                    'competition.id',
                  )
                  .onRef(
                    'resolved_assignment.gym_location_id',
                    '=',
                    'resolved_credential.gym_location_id',
                  ),
            )
            .innerJoin('gym_locations as resolved_gym', (join) =>
              join
                .onRef(
                  'resolved_gym.id',
                  '=',
                  'resolved_credential.gym_location_id',
                )
                .onRef(
                  'resolved_gym.region_policy_id',
                  '=',
                  'competition.region_policy_id',
                ),
            )
            .where('resolved_credential.token_hash', '=', credentialHash)
            .where('resolved_credential.status', '=', 'active')
            .where('resolved_credential.expires_at', '>', now)
            .where('resolved_gym.active', '=', true)
            .where('resolved_gym.deleted_at', 'is', null);
        }
        const competition = await competitionQuery.executeTakeFirst();
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
          endsAt: competition.ends_at.toISOString(),
          entrantCap: competition.entrant_cap,
          goalDays: availableRegistrationGoalDays({
            configuredGoalDays: brackets.map((bracket) => bracket.goal_days),
          }),
          id: competition.id,
          minimumEntrants: competition.minimum_entrants,
          monthKey: competition.month_key,
          name: competition.name,
          regionCode: competition.region_code,
          regionName: competition.region_name,
          registrationClosesAt:
            competition.registration_closes_at.toISOString(),
          registrationOpensAt: competition.registration_opens_at.toISOString(),
          rules: parseCompetitionRules(competition.rules),
          rulesVersion: competition.rules_version,
          serverTime: now.toISOString(),
          startsAt: competition.starts_at.toISOString(),
          status: competition.status,
        };
      });

    if (
      synchronizeDueStart &&
      competition?.status === 'registration' &&
      new Date(competition.startsAt) <= now
    ) {
      await this.lifecycle.processDueStart(competition.id, now);
      return this.findCurrentCompetition(
        principal,
        query,
        credentialHash,
        false,
      );
    }

    return competition;
  }

  async getCurrentEnrollment(
    principal: AuthenticatedPrincipal,
    competitionId?: string,
  ): Promise<EnrollmentResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        let enrollmentQuery = transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'enrollment.competition_id',
          )
          .leftJoin(
            'gym_locations as gym',
            'gym.id',
            'enrollment.gym_location_id',
          )
          .select([
            'competition.id as competition_id',
            'enrollment.enrolled_at',
            'enrollment.goal_days',
            'enrollment.gym_credential_version',
            'enrollment.gym_location_id',
            'enrollment.id',
            'enrollment.status as enrollment_status',
            'gym.name as gym_name',
          ])
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.ends_at', '>', new Date())
          .orderBy('competition.starts_at')
          .orderBy('competition.id');
        if (competitionId) {
          enrollmentQuery = enrollmentQuery.where(
            'competition.id',
            '=',
            competitionId,
          );
        }
        const enrollment = await enrollmentQuery.executeTakeFirst();

        return enrollment
          ? {
              competitionId: enrollment.competition_id,
              enrolledAt: enrollment.enrolled_at.toISOString(),
              goalDays: enrollment.goal_days,
              gymCredentialVersion: enrollment.gym_credential_version,
              gymLocationId: enrollment.gym_location_id,
              gymName: enrollment.gym_name,
              id: enrollment.id,
              status: enrollment.enrollment_status,
            }
          : null;
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
          legalReceiptBundleId: request.legalReceiptBundleId ?? null,
          regionVerificationId: request.regionVerificationId,
          rulesAccepted: request.rulesAccepted,
          gymPresence: {
            credentialHash: hashOpaqueValue(request.gymPresence.credential),
          },
        },
        responseCode: 201,
        scope: 'competition-enrollments:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        this.profiles.requireVerifiedEmail(user);
        const now = new Date();
        const competition = await transaction
          .selectFrom('competitions as competition')
          .selectAll('competition')
          .where('competition.id', '=', competitionId)
          .forUpdate()
          .executeTakeFirst();
        if (!competition) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        const registrationAvailability = competitionRegistrationAvailability({
          endsAt: competition.ends_at,
          now,
          registrationClosesAt: competition.registration_closes_at,
          registrationOpensAt: competition.registration_opens_at,
          status: competition.status,
        });
        if (registrationAvailability !== 'open') {
          throw new ConflictException({
            code:
              registrationAvailability === 'not_open'
                ? 'COMPETITION_REGISTRATION_NOT_OPEN'
                : 'COMPETITION_REGISTRATION_CLOSED',
            message:
              registrationAvailability === 'not_open'
                ? 'Registration for this contest has not opened yet.'
                : 'Registration for this contest is closed.',
          });
        }
        if (!request.legalReceiptBundleId) {
          throw new UnprocessableEntityException({
            code: 'LEGAL_RECEIPT_BUNDLE_REQUIRED',
            message:
              'A current legal receipt bundle is required for contest enrollment.',
          });
        }

        const existingEnrollment = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competition_rule_acceptances as acceptance',
            'acceptance.id',
            'enrollment.rules_acceptance_id',
          )
          .leftJoin(
            'gym_locations as enrolled_gym',
            'enrolled_gym.id',
            'enrollment.gym_location_id',
          )
          .selectAll('enrollment')
          .select([
            'acceptance.account_legal_receipt_bundle_id as legal_receipt_bundle_id',
            'enrolled_gym.name as gym_name',
          ])
          .where('enrollment.competition_id', '=', competition.id)
          .where('enrollment.user_id', '=', user.id)
          .executeTakeFirst();
        if (existingEnrollment) {
          const requestedCredential = await transaction
            .selectFrom('gym_qr_credentials as credential')
            .innerJoin(
              'gym_locations as gym',
              'gym.id',
              'credential.gym_location_id',
            )
            .innerJoin('competition_gym_locations as assignment', (join) =>
              join
                .onRef(
                  'assignment.competition_id',
                  '=',
                  'credential.competition_id',
                )
                .onRef(
                  'assignment.gym_location_id',
                  '=',
                  'credential.gym_location_id',
                ),
            )
            .select([
              'credential.credential_version',
              'credential.gym_location_id',
            ])
            .where(
              'credential.token_hash',
              '=',
              hashOpaqueValue(request.gymPresence.credential),
            )
            .where('credential.competition_id', '=', competition.id)
            .where('credential.status', '=', 'active')
            .where('credential.expires_at', '>', now)
            .where('gym.active', '=', true)
            .where('gym.deleted_at', 'is', null)
            .where('gym.region_policy_id', '=', competition.region_policy_id)
            .executeTakeFirst();
          if (!requestedCredential) {
            throw new UnprocessableEntityException({
              code: 'GYM_QR_INVALID',
              message: `Scan the active ${competition.name} QR poster at a Partner gym to confirm your gym location for enrollment.`,
            });
          }
          if (existingEnrollment.status !== 'active') {
            throw new ConflictException({
              code: 'COMPETITION_ENROLLMENT_INACTIVE',
              message:
                'This competition enrollment is no longer active and cannot be recreated.',
            });
          }
          if (
            existingEnrollment.goal_days !== request.goalDays ||
            existingEnrollment.region_verification_id !==
              request.regionVerificationId ||
            existingEnrollment.legal_receipt_bundle_id !==
              (request.legalReceiptBundleId ?? null) ||
            existingEnrollment.gym_location_id !==
              requestedCredential.gym_location_id ||
            existingEnrollment.gym_credential_version !==
              requestedCredential.credential_version
          ) {
            throw new ConflictException({
              code: 'COMPETITION_ENROLLMENT_ALREADY_EXISTS',
              message:
                'This account is already enrolled with different enrollment details.',
            });
          }
          return {
            competitionId: competition.id,
            enrolledAt: existingEnrollment.enrolled_at.toISOString(),
            goalDays: existingEnrollment.goal_days,
            gymCredentialVersion: existingEnrollment.gym_credential_version,
            gymLocationId: existingEnrollment.gym_location_id,
            gymName: existingEnrollment.gym_name,
            id: existingEnrollment.id,
            status: 'active',
          };
        }

        const gymPresence = await transaction
          .selectFrom('gym_qr_credentials as credential')
          .innerJoin(
            'gym_locations as gym',
            'gym.id',
            'credential.gym_location_id',
          )
          .innerJoin('competition_gym_locations as assignment', (join) =>
            join
              .onRef(
                'assignment.competition_id',
                '=',
                'credential.competition_id',
              )
              .onRef(
                'assignment.gym_location_id',
                '=',
                'credential.gym_location_id',
              ),
          )
          .select([
            'credential.competition_id',
            'credential.credential_version',
            'credential.status as credential_status',
            'gym.active as gym_active',
            'gym.id as gym_id',
            'gym.name as gym_name',
            'gym.region_policy_id as gym_region_policy_id',
            sql<number>`LEAST(${sql.ref('gym.radius_meters')}, 75)`.as(
              'presence_radius_meters',
            ),
            sql<number>`ST_Distance(
              ${sql.ref('gym.coordinates')},
              ST_SetSRID(ST_MakePoint(${request.gymPresence.longitude}, ${request.gymPresence.latitude}), 4326)::geography
            )`.as('distance_meters'),
          ])
          .where(
            'credential.token_hash',
            '=',
            hashOpaqueValue(request.gymPresence.credential),
          )
          .where('credential.competition_id', '=', competition.id)
          .where('credential.status', '=', 'active')
          .where('credential.expires_at', '>', now)
          .where('gym.deleted_at', 'is', null)
          .executeTakeFirst();
        if (!gymPresence || gymPresence.credential_status !== 'active') {
          throw new UnprocessableEntityException({
            code: 'GYM_QR_INVALID',
            message: `Scan the active ${competition.name} QR poster at a Partner gym to confirm your gym location for enrollment.`,
          });
        }
        if (!gymPresence.gym_active) {
          throw new ConflictException({
            code: 'GYM_INACTIVE',
            message: 'This Partner gym is not currently active.',
          });
        }
        if (gymPresence.gym_region_policy_id !== competition.region_policy_id) {
          throw new UnprocessableEntityException({
            code: 'GYM_NOT_ELIGIBLE_FOR_COMPETITION',
            message:
              'This Partner gym is not eligible for the current regional Contest.',
          });
        }
        const withinGeofence = isWithinGymGeofence(
          gymPresence.distance_meters,
          gymPresence.presence_radius_meters,
          request.gymPresence.accuracyMeters,
        );
        if (
          !withinGeofence &&
          !isAcceptableLocationAccuracy(request.gymPresence.accuracyMeters)
        ) {
          throw new UnprocessableEntityException({
            code: 'GYM_LOCATION_INACCURATE',
            message:
              'Your location is not accurate enough to confirm gym presence. Move closer to the poster or a window, then try again.',
          });
        }
        if (!withinGeofence) {
          throw new UnprocessableEntityException({
            code: 'OUTSIDE_GYM_GEOFENCE',
            message: `You must be within ${gymPresence.presence_radius_meters} metres of ${gymPresence.gym_name} to enroll.`,
          });
        }
        const eligibleGym = await transaction
          .selectFrom('competition_gym_locations')
          .select('gym_location_id')
          .where('competition_id', '=', competition.id)
          .where('gym_location_id', '=', gymPresence.gym_id)
          .executeTakeFirst();
        if (!eligibleGym) {
          throw new UnprocessableEntityException({
            code: 'GYM_NOT_ELIGIBLE_FOR_COMPETITION',
            message:
              'This Partner gym is not eligible for the current regional Contest.',
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
            .selectFrom('region_verifications as verification')
            .innerJoin(
              'region_policies as policy',
              'policy.id',
              'verification.region_policy_id',
            )
            .select([
              'verification.id',
              'policy.country_code',
              'policy.subdivision_code',
            ])
            .where('verification.id', '=', request.regionVerificationId)
            .where('verification.user_id', '=', user.id)
            .where(
              'verification.region_policy_id',
              '=',
              competition.region_policy_id,
            )
            .where(
              currentRegionVerificationPredicate('verification', 'policy', now),
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
        const availableGoalDays = availableRegistrationGoalDays({
          configuredGoalDays: [bracket.goal_days],
        });
        if (!availableGoalDays.includes(request.goalDays)) {
          throw new UnprocessableEntityException({
            code: 'GOAL_UNAVAILABLE_FOR_REGISTRATION',
            message: 'That Weekly Goal is not available in this competition.',
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
        await this.legalDocuments.assertCurrentReceiptBundle(
          transaction,
          user.id,
          `${verification.country_code}-${verification.subdivision_code}`,
          request.legalReceiptBundleId,
        );

        const acceptance = await transaction
          .insertInto('competition_rule_acceptances')
          .values({
            accepted_at: now,
            account_legal_receipt_bundle_id: request.legalReceiptBundleId,
            age_eligibility_attested: request.ageEligibilityAttested,
            competition_id: competition.id,
            metadata: {
              contestType: 'brand_rewards',
              gymCredentialVersion: gymPresence.credential_version,
              gymLocationId: gymPresence.gym_id,
              presenceVerification: 'gym_qr_geofence',
              source: 'mobile',
            },
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
        const enrollment = await transaction
          .insertInto('competition_enrollments')
          .values({
            competition_id: competition.id,
            enrolled_at: now,
            goal_days: request.goalDays,
            gym_credential_version: gymPresence.credential_version,
            gym_location_id: gymPresence.gym_id,
            region_verification_id: verification.id,
            rules_acceptance_id: acceptance.id,
            status: 'active',
            user_id: user.id,
          })
          .returningAll()
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
          gymCredentialVersion: enrollment.gym_credential_version,
          gymLocationId: enrollment.gym_location_id,
          gymName: gymPresence.gym_name,
          id: enrollment.id,
          status: 'active',
        };
      },
    );

    return result;
  }

  async withdrawEnrollment(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
  ): Promise<EnrollmentResponseDto> {
    return this.idempotency.execute<EnrollmentWithdrawalJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { competitionId },
        responseCode: 200,
        scope: 'competition-enrollments:withdraw',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const enrollment = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .leftJoin(
            'gym_locations as gym',
            'gym.id',
            'enrollment.gym_location_id',
          )
          .select([
            'enrollment.competition_id',
            'enrollment.enrolled_at',
            'enrollment.goal_days',
            'enrollment.gym_credential_version',
            'enrollment.gym_location_id',
            'enrollment.id',
            'enrollment.status',
            'gym.name as gym_name',
          ])
          .where('enrollment.competition_id', '=', competitionId)
          .where('enrollment.user_id', '=', user.id)
          .forUpdate('enrollment')
          .executeTakeFirst();
        if (!enrollment) {
          throw new NotFoundException({
            code: 'COMPETITION_ENROLLMENT_NOT_FOUND',
            message: 'No Contest enrollment was found to withdraw.',
          });
        }
        if (enrollment.status === 'disqualified') {
          throw new ConflictException({
            code: 'COMPETITION_ENROLLMENT_DISQUALIFIED',
            message:
              'A disqualified Contest enrollment cannot be changed by the member.',
          });
        }

        const now = new Date();
        if (enrollment.status === 'active') {
          await transaction
            .updateTable('competition_enrollments')
            .set({ status: 'withdrawn' })
            .where('id', '=', enrollment.id)
            .where('status', '=', 'active')
            .executeTakeFirstOrThrow();
          await transaction
            .updateTable('workout_sessions')
            .set({
              completed_at: now,
              status: 'cancelled',
              updated_at: now,
            })
            .where('enrollment_id', '=', enrollment.id)
            .where('status', '=', 'active')
            .execute();
          await transaction
            .updateTable('weekly_challenge_requests')
            .set({
              cancellation_reason: 'enrollment_withdrawn',
              responded_at: now,
              status: 'cancelled',
            })
            .where('competition_id', '=', competitionId)
            .where((expression) =>
              expression.or([
                expression('requester_user_id', '=', user.id),
                expression('recipient_user_id', '=', user.id),
              ]),
            )
            .where('status', 'in', ['accepted', 'pending'])
            .execute();
          await transaction
            .updateTable('competition_matches')
            .set({ settled_at: now, status: 'cancelled' })
            .where('competition_id', '=', competitionId)
            .where((expression) =>
              expression.or([
                expression('user_a_id', '=', user.id),
                expression('user_b_id', '=', user.id),
              ]),
            )
            .where('status', 'in', ['matched', 'searching'])
            .execute();
          await transaction
            .insertInto('operator_audit_events')
            .values({
              action: 'competition.enrollment_withdrawn',
              actor_user_id: user.id,
              created_at: now,
              entity_id: enrollment.id,
              entity_type: 'competition_enrollments',
              next_state: {
                competitionId: enrollment.competition_id,
                status: 'withdrawn',
              },
              previous_state: {
                competitionId: enrollment.competition_id,
                status: 'active',
              },
              reason: 'Member confirmed irreversible Contest withdrawal.',
              request_id: idempotencyKey,
            })
            .executeTakeFirstOrThrow();
        }

        return {
          competitionId: enrollment.competition_id,
          enrolledAt: enrollment.enrolled_at.toISOString(),
          goalDays: enrollment.goal_days,
          gymCredentialVersion: enrollment.gym_credential_version,
          gymLocationId: enrollment.gym_location_id,
          gymName: enrollment.gym_name,
          id: enrollment.id,
          status: 'withdrawn',
        };
      },
    );
  }

  async getEnrollmentCount(
    competitionId: string,
    monthKey: string,
    region: string,
  ): Promise<number> {
    assertMonthKey(monthKey);
    const now = new Date();
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
      .innerJoin('users as user', 'user.id', 'enrollment.user_id')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('competition.id', '=', competitionId)
      .where('competition.month_key', '=', monthKey)
      .where('competition.status', 'in', ['registration', 'active'])
      .where('competition.deleted_at', 'is', null)
      .where('competition.ends_at', '>', now)
      .where('enrollment.status', '=', 'active')
      .where('user.email', 'is not', null)
      .where('user.email_verified', '=', true)
      .where('user.status', '=', 'active')
      .where('policy.code', '=', region)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async getMatches(
    principal: AuthenticatedPrincipal,
    monthKey: string,
    goalDays: number,
    region: string,
    competitionId: string,
  ): Promise<CompetitionMatchResponseDto[]> {
    assertMonthKey(monthKey);
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const competition = await transaction
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
          .select([
            'competition.id',
            'competition.ends_at',
            'competition.month_key',
            'competition.rules',
            'competition.rules_version',
            'competition.starts_at',
            'enrollment.enrolled_at',
            'enrollment.goal_days',
            'policy.metro_name',
            'policy.timezone',
          ])
          .where('competition.id', '=', competitionId)
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.goal_days', '=', goalDays)
          .where('enrollment.status', '=', 'active')
          .where('competition.month_key', '=', monthKey)
          .where('policy.code', '=', region)
          .executeTakeFirst();
        if (!competition) {
          return [];
        }
        const matches = await transaction
          .selectFrom('competition_matches')
          .selectAll()
          .where('competition_id', '=', competition.id)
          .where('status', '!=', 'cancelled')
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
        const opponentIds = [
          ...new Set(
            matches.flatMap((match) => {
              const opponentId =
                match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
              return opponentId ? [opponentId] : [];
            }),
          ),
        ];
        const [
          blockedUserIds,
          friendshipRows,
          acceptedRequests,
          assignmentRows,
        ] = await Promise.all([
          loadBlockedUserIds(transaction, user.id),
          opponentIds.length === 0
            ? Promise.resolve([])
            : transaction
                .selectFrom('friendships')
                .select(['user_a_id', 'user_b_id'])
                .where((expression) =>
                  expression.or([
                    expression.and([
                      expression('user_a_id', '=', user.id),
                      expression('user_b_id', 'in', opponentIds),
                    ]),
                    expression.and([
                      expression('user_b_id', '=', user.id),
                      expression('user_a_id', 'in', opponentIds),
                    ]),
                  ]),
                )
                .execute(),
          transaction
            .selectFrom('weekly_challenge_requests')
            .select('id')
            .where('competition_id', '=', competition.id)
            .where('status', '=', 'accepted')
            .execute(),
          transaction
            .selectFrom('weekly_challenge_assignment_participants')
            .select('period_index')
            .where('competition_id', '=', competition.id)
            .where('user_id', '=', user.id)
            .execute(),
        ]);
        const friendIds = new Set(
          friendshipRows.map((friendship) =>
            friendship.user_a_id === user.id
              ? friendship.user_b_id
              : friendship.user_a_id,
          ),
        );
        const acceptedRequestIds = new Set(
          acceptedRequests.map((request) => request.id),
        );
        const assignedPeriodIndexes = new Set(
          assignmentRows.map((assignment) => assignment.period_index),
        );
        const visibleOpponentIds = opponentIds.filter(
          (opponentId) =>
            friendIds.has(opponentId) && !blockedUserIds.has(opponentId),
        );
        const [profiles, streaksByUser, userSessions, opponentSessions] =
          await Promise.all([
            visibleOpponentIds.length === 0
              ? Promise.resolve([])
              : transaction
                  .selectFrom('profiles')
                  .select(['screen_name', 'user_id'])
                  .where('user_id', 'in', visibleOpponentIds)
                  .execute(),
            loadPublicStreaks(transaction, visibleOpponentIds, now),
            transaction
              .selectFrom('workout_sessions')
              .select('eligible_date')
              .where('competition_id', '=', competition.id)
              .where('user_id', '=', user.id)
              .where('status', '=', 'verified')
              .execute(),
            visibleOpponentIds.length === 0
              ? Promise.resolve([])
              : transaction
                  .selectFrom('workout_sessions')
                  .select(['eligible_date', 'user_id'])
                  .where('competition_id', '=', competition.id)
                  .where('user_id', 'in', visibleOpponentIds)
                  .where('status', '=', 'verified')
                  .execute(),
          ]);
        const profileByUserId = new Map(
          profiles.map((profile) => [profile.user_id, profile]),
        );
        const userDateKeys = userSessions.map((session) =>
          normalizeDateKey(session.eligible_date),
        );
        const opponentDateKeysByUserId = new Map<string, string[]>();
        for (const session of opponentSessions) {
          const dateKeys = opponentDateKeysByUserId.get(session.user_id) ?? [];
          dateKeys.push(normalizeDateKey(session.eligible_date));
          opponentDateKeysByUserId.set(session.user_id, dateKeys);
        }
        const rules = parseCompetitionRules(competition.rules);

        return buildCompetitionPeriods(monthKey).map((period) => {
          const match = matchesByPeriod.get(period.index);
          const opponentId = match
            ? match.user_a_id === user.id
              ? match.user_b_id
              : match.user_a_id
            : null;
          const directPartnerIsVisible = Boolean(
            opponentId &&
            match?.weekly_challenge_request_id &&
            acceptedRequestIds.has(match.weekly_challenge_request_id) &&
            visibleOpponentIds.includes(opponentId),
          );
          const partnerDateKeys =
            directPartnerIsVisible && opponentId
              ? (opponentDateKeysByUserId.get(opponentId) ?? [])
              : [];
          const userVerifiedCount = uniqueDateCountInsidePeriod(
            userDateKeys,
            period.startDateKey,
            period.endDateKey,
          );
          const opponentVerifiedCount = directPartnerIsVisible
            ? uniqueDateCountInsidePeriod(
                partnerDateKeys,
                period.startDateKey,
                period.endDateKey,
              )
            : 0;
          const settledOutcome =
            match?.status === 'settled'
              ? weeklyOutcomeForUser(match.outcome, user.id)
              : null;
          const projectedOutcome = calculateWeeklyScore({
            bothHitMultiplier: rules.weeklyChallengeBothHitMultiplier,
            entriesPerVerifiedDay: rules.verifiedSessionPrizeDrawEntries,
            goalDays: competition.goal_days,
            opponentVerifiedDays: directPartnerIsVisible
              ? opponentVerifiedCount
              : null,
            recoveryMultiplier: rules.weeklyChallengeRecoveryMultiplier,
            verifiedDays: userVerifiedCount,
          });
          const outcome = settledOutcome ?? projectedOutcome;
          const streaks =
            directPartnerIsVisible && opponentId
              ? (streaksByUser.get(opponentId) ?? emptyStreaks())
              : emptyStreaks();
          const statisticsAreVisible = Boolean(
            opponentId && streaksByUser.has(opponentId),
          );

          return {
            availability:
              match?.status === 'settled'
                ? directPartnerIsVisible && match.user_b_id
                  ? ('matched' as const)
                  : ('solo' as const)
                : directPartnerIsVisible && match?.status === 'matched'
                  ? ('matched' as const)
                  : assignedPeriodIndexes.has(period.index)
                    ? ('solo' as const)
                    : ('searching' as const),
            entries: outcome.entries,
            multiplier: normalizeWeeklyMultiplier(outcome.multiplier),
            opponentAlias:
              directPartnerIsVisible && opponentId
                ? (profileByUserId.get(opponentId)?.screen_name ?? null)
                : null,
            opponentBestStreak: statisticsAreVisible
              ? longestDailyStreak(partnerDateKeys)
              : 0,
            opponentCurrentStreak: statisticsAreVisible ? streaks.daily : 0,
            opponentMonthlyVerifiedDays: statisticsAreVisible
              ? new Set(
                  partnerDateKeys.filter((dateKey) =>
                    dateKey.startsWith(competition.month_key),
                  ),
                ).size
              : 0,
            opponentStreaks: streaks,
            opponentVerifiedCount: statisticsAreVisible
              ? opponentVerifiedCount
              : 0,
            periodIndex: period.index,
            region: competition.metro_name.toUpperCase(),
            scoringStatus:
              match?.status === 'settled'
                ? ('settled' as const)
                : ('projected' as const),
          };
        });
      });
  }

  async listEligibleWeeklyChallengePartners(
    principal: AuthenticatedPrincipal,
    monthKey: string,
    query: WeeklyChallengePeriodQueryDto,
  ): Promise<EligibleWeeklyChallengePartnerDto[]> {
    assertMonthKey(monthKey);
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const context = await this.requireWeeklyChallengeContext(
          transaction,
          principal,
          monthKey,
          query.competitionId,
          query.goal,
          query.region,
          query.period,
        );
        if (
          await this.hasWeeklyChallengeMatch(
            transaction,
            context.competitionId,
            query.period,
            [context.userId],
          )
        ) {
          return [];
        }

        const friendshipRows = await transaction
          .selectFrom('friendships')
          .select(['user_a_id', 'user_b_id'])
          .where((expression) =>
            expression.or([
              expression('user_a_id', '=', context.userId),
              expression('user_b_id', '=', context.userId),
            ]),
          )
          .execute();
        const blockedUserIds = await loadBlockedUserIds(
          transaction,
          context.userId,
        );
        const friendIds = friendshipRows
          .map((friendship) =>
            friendship.user_a_id === context.userId
              ? friendship.user_b_id
              : friendship.user_a_id,
          )
          .filter((friendUserId) => !blockedUserIds.has(friendUserId));
        const streaksByUser = await loadPublicStreaks(transaction, friendIds);

        const candidates = await Promise.all(
          friendIds.map(async (friendUserId) => {
            const [enrollment, profile, existingMatch, pendingRequest] =
              await Promise.all([
                transaction
                  .selectFrom('competition_enrollments')
                  .select('id')
                  .where('competition_id', '=', context.competitionId)
                  .where('user_id', '=', friendUserId)
                  .where('goal_days', '=', query.goal)
                  .where('status', '=', 'active')
                  .executeTakeFirst(),
                transaction
                  .selectFrom('profiles')
                  .select('screen_name')
                  .where('user_id', '=', friendUserId)
                  .executeTakeFirst(),
                this.hasWeeklyChallengeMatch(
                  transaction,
                  context.competitionId,
                  query.period,
                  [friendUserId],
                ),
                transaction
                  .selectFrom('weekly_challenge_requests')
                  .select('id')
                  .where('competition_id', '=', context.competitionId)
                  .where('period_index', '=', query.period)
                  .where('status', '=', 'pending')
                  .where((expression) =>
                    expression.or([
                      expression.and([
                        expression('requester_user_id', '=', context.userId),
                        expression('recipient_user_id', '=', friendUserId),
                      ]),
                      expression.and([
                        expression('requester_user_id', '=', friendUserId),
                        expression('recipient_user_id', '=', context.userId),
                      ]),
                    ]),
                  )
                  .executeTakeFirst(),
              ]);
            if (!enrollment || !profile || existingMatch) {
              return null;
            }
            return {
              alias: profile.screen_name,
              goalDays: query.goal,
              requestStatus: pendingRequest
                ? ('pending' as const)
                : ('available' as const),
              streaks: streaksByUser.get(friendUserId) ?? emptyStreaks(),
              userId: friendUserId,
            };
          }),
        );

        return candidates
          .filter((candidate): candidate is EligibleWeeklyChallengePartnerDto =>
            Boolean(candidate),
          )
          .sort((left, right) => left.alias.localeCompare(right.alias));
      });
  }

  async listWeeklyChallengeRequests(
    principal: AuthenticatedPrincipal,
    monthKey: string,
    query: WeeklyChallengePeriodQueryDto,
  ): Promise<WeeklyChallengeRequestResponseDto[]> {
    assertMonthKey(monthKey);
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const context = await this.requireWeeklyChallengeContext(
          transaction,
          principal,
          monthKey,
          query.competitionId,
          query.goal,
          query.region,
          query.period,
        );
        const requests = await transaction
          .selectFrom('weekly_challenge_requests')
          .selectAll()
          .where('competition_id', '=', context.competitionId)
          .where('period_index', '=', query.period)
          .where('status', '=', 'pending')
          .where((expression) =>
            expression.or([
              expression('requester_user_id', '=', context.userId),
              expression('recipient_user_id', '=', context.userId),
            ]),
          )
          .orderBy('created_at', 'desc')
          .execute();
        const blockedUserIds = await loadBlockedUserIds(
          transaction,
          context.userId,
        );

        return Promise.all(
          requests
            .filter((request) => {
              const otherUserId =
                request.requester_user_id === context.userId
                  ? request.recipient_user_id
                  : request.requester_user_id;
              return !blockedUserIds.has(otherUserId);
            })
            .map(async (request) => {
              const direction =
                request.recipient_user_id === context.userId
                  ? ('incoming' as const)
                  : ('outgoing' as const);
              const partnerUserId =
                direction === 'incoming'
                  ? request.requester_user_id
                  : request.recipient_user_id;
              return this.toWeeklyChallengeRequestResponse(
                transaction,
                request,
                direction,
                partnerUserId,
              );
            }),
        );
      });
  }

  async createWeeklyChallengeRequest(
    principal: AuthenticatedPrincipal,
    monthKey: string,
    idempotencyKey: string,
    input: CreateWeeklyChallengeRequestDto,
  ): Promise<WeeklyChallengeRequestResponseDto> {
    assertMonthKey(monthKey);
    return this.idempotency.execute<WeeklyChallengeRequestJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          competitionId: input.competitionId,
          goal: input.goal,
          monthKey,
          period: input.period,
          recipientUserId: input.recipientUserId,
          region: input.region,
        },
        responseCode: 201,
        scope: 'weekly-challenge-requests:create',
      },
      async (transaction) => {
        const now = new Date();
        const context = await this.requireWeeklyChallengeContext(
          transaction,
          principal,
          monthKey,
          input.competitionId,
          input.goal,
          input.region,
          input.period,
          now,
          true,
        );
        if (context.userId === input.recipientUserId) {
          throw new UnprocessableEntityException({
            code: 'WEEKLY_CHALLENGE_SELF_REQUEST',
            message: 'Choose another player for your Weekly Challenge.',
          });
        }
        await lockSocialPair(
          transaction,
          context.userId,
          input.recipientUserId,
        );
        await requireSocialPairAvailable(
          transaction,
          context.userId,
          input.recipientUserId,
        );
        await this.requireAcceptedFriendship(
          transaction,
          context.userId,
          input.recipientUserId,
        );
        const recipientEnrollment = await transaction
          .selectFrom('competition_enrollments')
          .select('id')
          .where('competition_id', '=', context.competitionId)
          .where('user_id', '=', input.recipientUserId)
          .where('goal_days', '=', input.goal)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!recipientEnrollment) {
          throw new UnprocessableEntityException({
            code: 'WEEKLY_CHALLENGE_COMMITMENT_MISMATCH',
            message:
              'That friend must be enrolled in this competition with the same Weekly Goal.',
          });
        }
        if (
          await this.hasWeeklyChallengeMatch(
            transaction,
            context.competitionId,
            input.period,
            [context.userId, input.recipientUserId],
          )
        ) {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_ALREADY_ASSIGNED',
            message:
              'One of these players already has a Weekly Challenge for this week.',
          });
        }
        const existing = await transaction
          .selectFrom('weekly_challenge_requests')
          .select('id')
          .where('competition_id', '=', context.competitionId)
          .where('period_index', '=', input.period)
          .where('status', '=', 'pending')
          .where((expression) =>
            expression.or([
              expression.and([
                expression('requester_user_id', '=', context.userId),
                expression('recipient_user_id', '=', input.recipientUserId),
              ]),
              expression.and([
                expression('requester_user_id', '=', input.recipientUserId),
                expression('recipient_user_id', '=', context.userId),
              ]),
            ]),
          )
          .executeTakeFirst();
        if (existing) {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_PENDING',
            message:
              'A Weekly Challenge request between these players is already pending.',
          });
        }
        const created = await transaction
          .insertInto('weekly_challenge_requests')
          .values({
            accepted_at: null,
            cancellation_reason: null,
            competition_id: context.competitionId,
            created_at: now,
            goal_days: input.goal,
            period_index: input.period,
            recipient_user_id: input.recipientUserId,
            requester_user_id: context.userId,
            status: 'pending',
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        return this.toWeeklyChallengeRequestResponse(
          transaction,
          created,
          'outgoing',
          input.recipientUserId,
        );
      },
    );
  }

  async respondToWeeklyChallengeRequest(
    principal: AuthenticatedPrincipal,
    requestId: string,
    idempotencyKey: string,
    decision: 'accepted' | 'declined',
  ): Promise<WeeklyChallengeRequestResponseDto> {
    return this.idempotency.execute<WeeklyChallengeRequestJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { decision, requestId },
        scope: 'weekly-challenge-requests:respond',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const requestSnapshot = await transaction
          .selectFrom('weekly_challenge_requests')
          .select([
            'competition_id',
            'goal_days',
            'period_index',
            'recipient_user_id',
            'requester_user_id',
          ])
          .where('id', '=', requestId)
          .executeTakeFirst();
        if (!requestSnapshot) {
          throw new NotFoundException({
            code: 'WEEKLY_CHALLENGE_REQUEST_NOT_FOUND',
            message: 'The Weekly Challenge request was not found.',
          });
        }
        if (requestSnapshot.recipient_user_id !== user.id) {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_FORBIDDEN',
            message: 'Only the invited player can respond to this request.',
          });
        }
        const now = new Date();
        if (decision === 'declined') {
          const request = await transaction
            .selectFrom('weekly_challenge_requests')
            .selectAll()
            .where('id', '=', requestId)
            .forUpdate()
            .executeTakeFirstOrThrow();
          if (request.status !== 'pending') {
            throw new ConflictException({
              code: 'WEEKLY_CHALLENGE_REQUEST_RESOLVED',
              message:
                'This Weekly Challenge request has already been resolved.',
            });
          }
          const updated = await transaction
            .updateTable('weekly_challenge_requests')
            .set({ responded_at: now, status: 'declined' })
            .where('id', '=', request.id)
            .where('status', '=', 'pending')
            .returningAll()
            .executeTakeFirstOrThrow();
          return this.toWeeklyChallengeRequestResponse(
            transaction,
            updated,
            'incoming',
            request.requester_user_id,
          );
        }
        const competition = await transaction
          .selectFrom('competitions as competition')
          .innerJoin(
            'region_policies as policy',
            'policy.id',
            'competition.region_policy_id',
          )
          .select(['competition.month_key', 'policy.code'])
          .where('competition.id', '=', requestSnapshot.competition_id)
          .executeTakeFirstOrThrow();
        const context = await this.requireWeeklyChallengeContext(
          transaction,
          principal,
          competition.month_key,
          requestSnapshot.competition_id,
          requestSnapshot.goal_days,
          competition.code,
          requestSnapshot.period_index,
          now,
          true,
        );
        await lockSocialPair(
          transaction,
          requestSnapshot.requester_user_id,
          requestSnapshot.recipient_user_id,
        );
        const request = await transaction
          .selectFrom('weekly_challenge_requests')
          .selectAll()
          .where('id', '=', requestId)
          .forUpdate()
          .executeTakeFirst();
        if (!request) throw new Error('Weekly Challenge request disappeared.');
        if (request.status !== 'pending') {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_RESOLVED',
            message: 'This Weekly Challenge request has already been resolved.',
          });
        }
        await requireSocialPairAvailable(
          transaction,
          request.requester_user_id,
          request.recipient_user_id,
        );

        await this.requireAcceptedFriendship(
          transaction,
          request.requester_user_id,
          request.recipient_user_id,
        );
        const enrollments = await transaction
          .selectFrom('competition_enrollments')
          .select(['goal_days', 'user_id'])
          .where('competition_id', '=', request.competition_id)
          .where('status', '=', 'active')
          .where('goal_days', '=', request.goal_days)
          .where('user_id', 'in', [
            request.requester_user_id,
            request.recipient_user_id,
          ])
          .forUpdate()
          .execute();
        if (new Set(enrollments.map(({ user_id }) => user_id)).size !== 2) {
          throw new UnprocessableEntityException({
            code: 'WEEKLY_CHALLENGE_COMMITMENT_MISMATCH',
            message:
              'Both players must remain enrolled with the same Weekly Goal.',
          });
        }
        if (
          await this.hasWeeklyChallengeMatch(
            transaction,
            request.competition_id,
            request.period_index,
            [request.requester_user_id, request.recipient_user_id],
          )
        ) {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_ALREADY_ASSIGNED',
            message:
              'One of these players already has a Weekly Challenge for this week.',
          });
        }
        const [userAId, userBId] = [
          request.requester_user_id,
          request.recipient_user_id,
        ].sort();
        const updated = await transaction
          .updateTable('weekly_challenge_requests')
          .set({ accepted_at: now, responded_at: now, status: 'accepted' })
          .where('id', '=', request.id)
          .where('status', '=', 'pending')
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('competition_matches')
          .values({
            competition_id: request.competition_id,
            created_at: now,
            outcome: null,
            period_end_date: context.period.endDateKey,
            period_index: request.period_index,
            period_start_date: context.period.startDateKey,
            settled_at: null,
            status: 'matched',
            user_a_id: userAId,
            user_b_id: userBId,
            weekly_challenge_request_id: request.id,
          })
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable('weekly_challenge_requests')
          .set({
            cancellation_reason: 'conflicting_request_accepted',
            responded_at: now,
            status: 'cancelled',
          })
          .where('id', '!=', request.id)
          .where('competition_id', '=', request.competition_id)
          .where('period_index', '=', request.period_index)
          .where('status', '=', 'pending')
          .where((expression) =>
            expression.or([
              expression('requester_user_id', 'in', [
                request.requester_user_id,
                request.recipient_user_id,
              ]),
              expression('recipient_user_id', 'in', [
                request.requester_user_id,
                request.recipient_user_id,
              ]),
            ]),
          )
          .execute();
        return this.toWeeklyChallengeRequestResponse(
          transaction,
          updated,
          'incoming',
          request.requester_user_id,
        );
      },
    );
  }

  async cancelWeeklyChallengeRequest(
    principal: AuthenticatedPrincipal,
    requestId: string,
    idempotencyKey: string,
  ): Promise<WeeklyChallengeRequestResponseDto> {
    return this.idempotency.execute<WeeklyChallengeRequestJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { requestId },
        scope: 'weekly-challenge-requests:cancel',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const request = await transaction
          .selectFrom('weekly_challenge_requests')
          .selectAll()
          .where('id', '=', requestId)
          .forUpdate()
          .executeTakeFirst();
        if (!request) {
          throw new NotFoundException({
            code: 'WEEKLY_CHALLENGE_REQUEST_NOT_FOUND',
            message: 'The Weekly Challenge request was not found.',
          });
        }
        if (request.requester_user_id !== user.id) {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_FORBIDDEN',
            message: 'Only the inviting player can cancel this request.',
          });
        }
        if (request.status !== 'pending') {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_RESOLVED',
            message: 'This Weekly Challenge request has already been resolved.',
          });
        }
        const updated = await transaction
          .updateTable('weekly_challenge_requests')
          .set({
            cancellation_reason: 'requester_cancelled',
            responded_at: new Date(),
            status: 'cancelled',
          })
          .where('id', '=', request.id)
          .where('status', '=', 'pending')
          .returningAll()
          .executeTakeFirstOrThrow();
        return this.toWeeklyChallengeRequestResponse(
          transaction,
          updated,
          'outgoing',
          request.recipient_user_id,
        );
      },
    );
  }

  private async requireWeeklyChallengeContext(
    transaction: Transaction<Database>,
    principal: AuthenticatedPrincipal,
    monthKey: string,
    competitionId: string,
    goalDays: number,
    region: string,
    periodIndex: number,
    now = new Date(),
    lockCompetition = false,
  ) {
    const user = await this.profiles.ensureUser(principal, transaction);
    if (lockCompetition) {
      await transaction
        .selectFrom('competitions')
        .select('id')
        .where('id', '=', competitionId)
        .forUpdate()
        .executeTakeFirst();
    }
    const competition = await transaction
      .selectFrom('competitions as competition')
      .innerJoin(
        'region_policies as policy',
        'policy.id',
        'competition.region_policy_id',
      )
      .select([
        'competition.ends_at',
        'competition.id',
        'competition.starts_at',
        'competition.status',
        'policy.timezone',
      ])
      .where('competition.id', '=', competitionId)
      .where('competition.month_key', '=', monthKey)
      .where('policy.code', '=', region)
      .where('competition.deleted_at', 'is', null)
      .executeTakeFirst();
    if (!competition) {
      throw new NotFoundException({
        code: 'COMPETITION_NOT_FOUND',
        message: 'The regional competition was not found.',
      });
    }
    if (
      competition.status !== 'active' ||
      competition.starts_at > now ||
      competition.ends_at <= now
    ) {
      throw new UnprocessableEntityException({
        code: 'WEEKLY_CHALLENGE_CONTEST_NOT_ACTIVE',
        message: 'Weekly Challenge requests require an active Contest.',
      });
    }
    const period = buildCompetitionPeriods(monthKey).find(
      ({ index }) => index === periodIndex,
    );
    const regionalDateKey = dateKeyInTimezone(now, competition.timezone);
    if (
      !period ||
      regionalDateKey < period.startDateKey ||
      regionalDateKey > period.endDateKey
    ) {
      throw new UnprocessableEntityException({
        code: 'WEEKLY_CHALLENGE_PERIOD_NOT_CURRENT',
        message: 'Choose the current seven-day scoring week.',
      });
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
      throw new UnprocessableEntityException({
        code: 'WEEKLY_CHALLENGE_ENROLLMENT_REQUIRED',
        message:
          'Join this competition and Weekly Goal before choosing a partner.',
      });
    }
    return { competitionId: competition.id, period, userId: user.id };
  }

  private async requireAcceptedFriendship(
    transaction: Transaction<Database>,
    userId: string,
    friendUserId: string,
  ) {
    const [userAId, userBId] = [userId, friendUserId].sort();
    const friendship = await transaction
      .selectFrom('friendships')
      .select('created_at')
      .where('user_a_id', '=', userAId)
      .where('user_b_id', '=', userBId)
      .executeTakeFirst();
    if (!friendship) {
      throw new UnprocessableEntityException({
        code: 'WEEKLY_CHALLENGE_FRIEND_REQUIRED',
        message:
          'Accept a friend request before choosing this Weekly Challenge partner.',
      });
    }
  }

  private async hasWeeklyChallengeMatch(
    transaction: Transaction<Database>,
    competitionId: string,
    periodIndex: number,
    userIds: readonly string[],
  ): Promise<boolean> {
    const [match, assignment] = await Promise.all([
      transaction
        .selectFrom('competition_matches')
        .select('id')
        .where('competition_id', '=', competitionId)
        .where('period_index', '=', periodIndex)
        .where('status', '!=', 'cancelled')
        .where((expression) =>
          expression.or([
            expression('user_a_id', 'in', [...userIds]),
            expression('user_b_id', 'in', [...userIds]),
          ]),
        )
        .executeTakeFirst(),
      transaction
        .selectFrom('weekly_challenge_assignment_participants')
        .select('request_id')
        .where('competition_id', '=', competitionId)
        .where('period_index', '=', periodIndex)
        .where('user_id', 'in', [...userIds])
        .executeTakeFirst(),
    ]);
    return Boolean(match || assignment);
  }

  private async toWeeklyChallengeRequestResponse(
    transaction: Transaction<Database>,
    request: {
      id: string;
      created_at: Date;
      goal_days: number;
      period_index: number;
      status: 'accepted' | 'cancelled' | 'declined' | 'pending';
    },
    direction: 'incoming' | 'outgoing',
    partnerUserId: string,
  ): Promise<WeeklyChallengeRequestJson> {
    const profile = await transaction
      .selectFrom('profiles')
      .select('screen_name')
      .where('user_id', '=', partnerUserId)
      .executeTakeFirstOrThrow();
    const partnerStreaks = toStreaksJson(
      (await loadPublicStreaks(transaction, [partnerUserId])).get(
        partnerUserId,
      ),
    );
    return {
      createdAt: request.created_at.toISOString(),
      direction,
      goalDays: request.goal_days,
      id: request.id,
      partnerAlias: profile.screen_name,
      partnerStreaks,
      periodIndex: request.period_index as 1 | 2 | 3 | 4,
      status: request.status,
    };
  }
}

function emptyStreaks(): StreakCountsJson {
  return {
    daily: 0,
    monthly: 0,
    projectionVersion: 'streaks-v1',
    weekly: 0,
    yearly: 0,
  };
}

function uniqueDateCountInsidePeriod(
  dateKeys: readonly string[],
  startDateKey: string,
  endDateKey: string,
) {
  return new Set(
    dateKeys.filter(
      (dateKey) => dateKey >= startDateKey && dateKey <= endDateKey,
    ),
  ).size;
}

function weeklyOutcomeForUser(
  value: unknown,
  userId: string,
): { entries: number; multiplier: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const results = (value as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;
  const result = results.find(
    (candidate) =>
      candidate !== null &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      (candidate as { userId?: unknown }).userId === userId,
  ) as { entries?: unknown; multiplier?: unknown } | undefined;
  if (
    !result ||
    typeof result.entries !== 'number' ||
    !Number.isInteger(result.entries) ||
    result.entries < 0 ||
    typeof result.multiplier !== 'number'
  ) {
    return null;
  }
  return { entries: result.entries, multiplier: result.multiplier };
}

function normalizeWeeklyMultiplier(value: number): 0 | 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

function toStreaksJson(streaks?: StreakCounts): StreakCountsJson {
  return streaks
    ? {
        daily: streaks.daily,
        monthly: streaks.monthly,
        projectionVersion: streaks.projectionVersion,
        weekly: streaks.weekly,
        yearly: streaks.yearly,
      }
    : emptyStreaks();
}

function longestDailyStreak(dateKeys: readonly string[]) {
  const sortedDays = [...new Set(dateKeys)]
    .map((dateKey) => Date.parse(`${dateKey}T00:00:00.000Z`))
    .sort((left, right) => left - right);
  let longest = 0;
  let current = 0;
  let previous: number | null = null;
  for (const day of sortedDays) {
    current =
      previous !== null && day - previous === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

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
} from '../gyms/gym-scan-policy';
import { LedgerService } from '../ledger/ledger.service';
import { LegalDocumentsService } from '../legal/legal-documents.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  calculateStreaks,
  type StreakCounts,
} from '../streaks/streak-calculation';
import { loadPublicStreaks } from '../streaks/public-streaks';
import {
  assertMonthKey,
  buildCompetitionPeriods,
  dateKeyInTimezone,
} from './competition-calendar';
import {
  availableRegistrationGoalDays,
  isPublishedCompetitionJoinable,
} from './competition-registration';
import { parseCompetitionRules } from './competition-rules';
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
  id: string;
  status: 'active';
}

interface WeeklyChallengeRequestJson extends JsonObject {
  id: string;
  competitionId: string;
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  goalDays: number;
  partnerAlias: string;
  partnerStreaks: StreakCountsJson;
  partnerUserId: string;
  periodIndex: 1 | 2 | 3 | 4;
  status: 'accepted' | 'cancelled' | 'declined' | 'pending';
}

interface StreakCountsJson extends JsonObject {
  daily: number;
  monthly: number;
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
  ) {}

  async getCurrent(
    principal: AuthenticatedPrincipal,
    query: CurrentCompetitionQueryDto = {},
  ): Promise<CompetitionResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
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
          .where('verification.status', '=', 'approved')
          .where((expression) =>
            expression.or([
              expression('verification.expires_at', 'is', null),
              expression('verification.expires_at', '>', now),
            ]),
          )
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.ends_at', '>', now)
          .orderBy('competition.starts_at');
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
          startsAt: competition.starts_at.toISOString(),
          status: competition.status,
        };
      });
  }

  async getCurrentEnrollment(
    principal: AuthenticatedPrincipal,
  ): Promise<EnrollmentResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const enrollment = await transaction
          .selectFrom('competition_enrollments as enrollment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'enrollment.competition_id',
          )
          .select([
            'competition.id as competition_id',
            'enrollment.enrolled_at',
            'enrollment.goal_days',
            'enrollment.id',
            'enrollment.status',
          ])
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .where('competition.status', 'in', ['registration', 'active'])
          .where('competition.ends_at', '>', new Date())
          .orderBy('competition.starts_at')
          .executeTakeFirst();

        return enrollment
          ? {
              competitionId: enrollment.competition_id,
              enrolledAt: enrollment.enrolled_at.toISOString(),
              goalDays: enrollment.goal_days,
              id: enrollment.id,
              status: enrollment.status,
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
            accuracyMeters: request.gymPresence.accuracyMeters,
            credentialHash: hashOpaqueValue(request.gymPresence.credential),
            locationHash: hashOpaqueValue(
              `${request.gymPresence.latitude}:${request.gymPresence.longitude}`,
            ),
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
        if (
          !isPublishedCompetitionJoinable({
            endsAt: competition.ends_at,
            now,
            status: competition.status,
          })
        ) {
          throw new ConflictException({
            code: 'COMPETITION_REGISTRATION_CLOSED',
            message: 'This competition is no longer available to join.',
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
          .selectAll('enrollment')
          .select(
            'acceptance.account_legal_receipt_bundle_id as legal_receipt_bundle_id',
          )
          .where('enrollment.competition_id', '=', competition.id)
          .where('enrollment.user_id', '=', user.id)
          .executeTakeFirst();
        if (existingEnrollment) {
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
              (request.legalReceiptBundleId ?? null)
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
          .select([
            'credential.credential_version',
            'credential.status as credential_status',
            'gym.active as gym_active',
            'gym.id as gym_id',
            'gym.name as gym_name',
            sql<number>`LEAST(${sql.ref('gym.radius_meters')}, 75)`.as(
              'presence_radius_meters',
            ),
            sql<boolean>`ST_DWithin(
              ${sql.ref('gym.coordinates')},
              ST_SetSRID(ST_MakePoint(${request.gymPresence.longitude}, ${request.gymPresence.latitude}), 4326)::geography,
              LEAST(${sql.ref('gym.radius_meters')}, 75)
            )`.as('within_geofence'),
          ])
          .where(
            'credential.token_hash',
            '=',
            hashOpaqueValue(request.gymPresence.credential),
          )
          .executeTakeFirst();
        if (!gymPresence || gymPresence.credential_status !== 'active') {
          throw new UnprocessableEntityException({
            code: 'GYM_QR_INVALID',
            message:
              'Scan the active GoGymGo QR poster at a Partner gym to confirm your gym location for enrollment.',
          });
        }
        if (!gymPresence.gym_active) {
          throw new ConflictException({
            code: 'GYM_INACTIVE',
            message: 'This Partner gym is not currently active.',
          });
        }
        if (!isAcceptableLocationAccuracy(request.gymPresence.accuracyMeters)) {
          throw new UnprocessableEntityException({
            code: 'GYM_LOCATION_INACCURATE',
            message:
              'Your location is not accurate enough to confirm gym presence. Move closer to the poster or a window, then try again.',
          });
        }
        if (!gymPresence.within_geofence) {
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
            .where('verification.status', '=', 'approved')
            .where((expression) =>
              expression.or([
                expression('verification.expires_at', 'is', null),
                expression('verification.expires_at', '>', now),
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
      .innerJoin('users as user', 'user.id', 'enrollment.user_id')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('competition.month_key', '=', monthKey)
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
          .select([
            'competition.id',
            'competition.month_key',
            'policy.metro_name',
            'policy.timezone',
          ])
          .where('competition.month_key', '=', monthKey)
          .where('policy.code', '=', region)
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
                opponentAlias: 'CHALLENGE_PENDING',
                opponentBestStreak: 0,
                opponentCurrentStreak: 0,
                opponentMonthlyVerifiedDays: 0,
                opponentStreaks: emptyStreaks(),
                opponentUserId: null,
                opponentVerifiedDateKeys: [],
                periodIndex: period.index,
                region: competition.metro_name.toUpperCase(),
              };
            }

            const [opponent, periodVerifiedSessions, verifiedSessions] =
              await Promise.all([
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
                transaction
                  .selectFrom('workout_sessions')
                  .select('eligible_date')
                  .where('user_id', '=', opponentId)
                  .where('status', '=', 'verified')
                  .orderBy('eligible_date')
                  .execute(),
              ]);
            const opponentVerifiedDateKeys = verifiedSessions.map((session) =>
              normalizeDateKey(session.eligible_date),
            );
            const opponentStreaks = calculateStreaks(
              opponentVerifiedDateKeys,
              dateKeyInTimezone(new Date(), competition.timezone),
            );

            return {
              availability: 'matched',
              opponentAlias:
                opponent.public_identity_mode === 'private'
                  ? opponent.callsign
                  : opponent.public_name || opponent.callsign,
              opponentBestStreak: longestDailyStreak(opponentVerifiedDateKeys),
              opponentCurrentStreak: opponentStreaks.daily,
              opponentMonthlyVerifiedDays: new Set(
                opponentVerifiedDateKeys.filter((dateKey) =>
                  dateKey.startsWith(competition.month_key),
                ),
              ).size,
              opponentStreaks,
              opponentUserId: opponentId,
              opponentVerifiedDateKeys: periodVerifiedSessions.map((session) =>
                normalizeDateKey(session.eligible_date),
              ),
              periodIndex: period.index,
              region: competition.metro_name.toUpperCase(),
            };
          }),
        );
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
          query.goal,
          query.region,
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
        const friendIds = friendshipRows.map((friendship) =>
          friendship.user_a_id === context.userId
            ? friendship.user_b_id
            : friendship.user_a_id,
        );
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
                  .select(['callsign', 'public_identity_mode', 'public_name'])
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
              alias: publicAlias(profile),
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
          query.goal,
          query.region,
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

        return Promise.all(
          requests.map(async (request) => {
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
              context.competitionId,
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
        const context = await this.requireWeeklyChallengeContext(
          transaction,
          principal,
          monthKey,
          input.goal,
          input.region,
        );
        if (context.userId === input.recipientUserId) {
          throw new UnprocessableEntityException({
            code: 'WEEKLY_CHALLENGE_SELF_REQUEST',
            message: 'Choose another player for your Weekly Challenge.',
          });
        }
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
            competition_id: context.competitionId,
            created_at: new Date(),
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
          context.competitionId,
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
        if (request.recipient_user_id !== user.id) {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_FORBIDDEN',
            message: 'Only the invited player can respond to this request.',
          });
        }
        if (request.status !== 'pending') {
          throw new ConflictException({
            code: 'WEEKLY_CHALLENGE_REQUEST_RESOLVED',
            message: 'This Weekly Challenge request has already been resolved.',
          });
        }

        const now = new Date();
        if (decision === 'accepted') {
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
          const competition = await transaction
            .selectFrom('competitions')
            .select('month_key')
            .where('id', '=', request.competition_id)
            .executeTakeFirstOrThrow();
          const period = buildCompetitionPeriods(competition.month_key).find(
            ({ index }) => index === request.period_index,
          );
          if (!period) {
            throw new UnprocessableEntityException({
              code: 'WEEKLY_CHALLENGE_PERIOD_INVALID',
              message: 'The selected Weekly Challenge week is invalid.',
            });
          }
          const [userAId, userBId] = [
            request.requester_user_id,
            request.recipient_user_id,
          ].sort();
          await transaction
            .insertInto('competition_matches')
            .values({
              competition_id: request.competition_id,
              created_at: now,
              outcome: null,
              period_end_date: period.endDateKey,
              period_index: request.period_index,
              period_start_date: period.startDateKey,
              settled_at: null,
              status: 'matched',
              user_a_id: userAId,
              user_b_id: userBId,
            })
            .execute();
          await transaction
            .updateTable('weekly_challenge_requests')
            .set({ responded_at: now, status: 'cancelled' })
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
        }
        const updated = await transaction
          .updateTable('weekly_challenge_requests')
          .set({ responded_at: now, status: decision })
          .where('id', '=', request.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        return this.toWeeklyChallengeRequestResponse(
          transaction,
          updated,
          request.competition_id,
          'incoming',
          request.requester_user_id,
        );
      },
    );
  }

  private async requireWeeklyChallengeContext(
    transaction: Transaction<Database>,
    principal: AuthenticatedPrincipal,
    monthKey: string,
    goalDays: number,
    region: string,
  ) {
    const user = await this.profiles.ensureUser(principal, transaction);
    const competition = await transaction
      .selectFrom('competitions as competition')
      .innerJoin(
        'region_policies as policy',
        'policy.id',
        'competition.region_policy_id',
      )
      .select(['competition.id'])
      .where('competition.month_key', '=', monthKey)
      .where('policy.code', '=', region)
      .executeTakeFirst();
    if (!competition) {
      throw new NotFoundException({
        code: 'COMPETITION_NOT_FOUND',
        message: 'The regional competition was not found.',
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
    return { competitionId: competition.id, userId: user.id };
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

  private hasWeeklyChallengeMatch(
    transaction: Transaction<Database>,
    competitionId: string,
    periodIndex: number,
    userIds: readonly string[],
  ): Promise<boolean> {
    return transaction
      .selectFrom('competition_matches')
      .select('id')
      .where('competition_id', '=', competitionId)
      .where('period_index', '=', periodIndex)
      .where((expression) =>
        expression.or([
          expression('user_a_id', 'in', [...userIds]),
          expression('user_b_id', 'in', [...userIds]),
        ]),
      )
      .executeTakeFirst()
      .then(Boolean);
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
    competitionId: string,
    direction: 'incoming' | 'outgoing',
    partnerUserId: string,
  ): Promise<WeeklyChallengeRequestJson> {
    const profile = await transaction
      .selectFrom('profiles')
      .select(['callsign', 'public_identity_mode', 'public_name'])
      .where('user_id', '=', partnerUserId)
      .executeTakeFirstOrThrow();
    const partnerStreaks = toStreaksJson(
      (await loadPublicStreaks(transaction, [partnerUserId])).get(
        partnerUserId,
      ),
    );
    return {
      competitionId,
      createdAt: request.created_at.toISOString(),
      direction,
      goalDays: request.goal_days,
      id: request.id,
      partnerAlias: publicAlias(profile),
      partnerStreaks,
      partnerUserId,
      periodIndex: request.period_index as 1 | 2 | 3 | 4,
      status: request.status,
    };
  }
}

function publicAlias(profile: {
  callsign: string;
  public_identity_mode: 'alias' | 'private' | 'real_name';
  public_name: string | null;
}) {
  return profile.public_identity_mode === 'private'
    ? profile.callsign
    : profile.public_name || profile.callsign;
}

function emptyStreaks(): StreakCountsJson {
  return { daily: 0, monthly: 0, weekly: 0, yearly: 0 };
}

function toStreaksJson(streaks?: StreakCounts): StreakCountsJson {
  return streaks
    ? {
        daily: streaks.daily,
        monthly: streaks.monthly,
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

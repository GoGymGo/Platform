import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import QRCode from 'qrcode';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { dateKeyInTimezone } from '../competitions/competition-calendar';
import { parseCompetitionRules } from '../competitions/competition-rules';
import { LedgerService } from '../ledger/ledger.service';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CashFulfillmentRecordDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  GymLocationResponseDto,
  GymQrCredentialResponseDto,
  GymScanRequestDto,
  GymScanResultDto,
  InterestSubmissionDto,
  InterestSubmissionResponseDto,
  OperatorInterestSubmissionDto,
  OperatorAuditHistoryDto,
  OperatorGymSessionDto,
  RegionWaitlistEntryDto,
  RegionWaitlistRequestDto,
  UpdateGymLocationDto,
} from './dto/gym.dto';
import {
  gymScanPolicy,
  hashOpaqueValue,
  isAcceptableLocationAccuracy,
  isMatchingSessionCredential,
  resolveActiveSessionScan,
} from './gym-scan-policy';

interface GymScanJson extends JsonObject {
  credentialVersion: number | null;
  expiresAt: string | null;
  gymLocationId: string | null;
  gymName: string | null;
  minimumCompleteAt: string | null;
  outcome: 'rejected' | 'started' | 'too_early' | 'verified';
  rejectionReason: string | null;
  remainingSeconds: number;
  serverTimestamp: string;
  sessionId: string | null;
  startedAt: string | null;
}

@Injectable()
export class GymsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly profiles: ProfilesService,
    private readonly adminAuthorization: AdminAuthorizationService,
  ) {}

  scan(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    request: GymScanRequestDto,
  ): Promise<GymScanResultDto> {
    return this.idempotency.execute<GymScanJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          accuracyMeters: request.accuracyMeters,
          credentialHash: hashOpaqueValue(request.credential),
          eventId: request.eventId,
          latitude: request.latitude,
          longitude: request.longitude,
        },
        scope: 'gym-scans:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        this.profiles.requireVerifiedEmail(user);
        const now = new Date();
        const tokenHash = hashOpaqueValue(request.credential);
        const clientEventHash = hashOpaqueValue(request.eventId);

        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`.execute(
          transaction,
        );

        const credential = await transaction
          .selectFrom('gym_qr_credentials as credential')
          .innerJoin(
            'gym_locations as gym',
            'gym.id',
            'credential.gym_location_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'gym.region_policy_id',
          )
          .select([
            'credential.credential_version',
            'credential.status as credential_status',
            'gym.active as gym_active',
            'gym.id as gym_id',
            'gym.name as gym_name',
            'gym.radius_meters',
            'region.timezone',
            sql<boolean>`ST_DWithin(
              ${sql.ref('gym.coordinates')},
              ST_SetSRID(ST_MakePoint(${request.longitude}, ${request.latitude}), 4326)::geography,
              ${sql.ref('gym.radius_meters')}
            )`.as('within_geofence'),
          ])
          .where('credential.token_hash', '=', tokenHash)
          .executeTakeFirst();

        if (!credential || credential.credential_status !== 'active') {
          return this.rejected(now, 'invalid_or_revoked_credential');
        }
        if (!credential.gym_active) {
          return this.rejected(now, 'gym_inactive', credential);
        }
        if (!isAcceptableLocationAccuracy(request.accuracyMeters)) {
          return this.rejected(now, 'inaccurate_location', credential);
        }
        if (!credential.within_geofence) {
          return this.rejected(now, 'outside_geofence', credential);
        }

        const replay = await transaction
          .selectFrom('gym_scan_events')
          .select('id')
          .where('user_id', '=', user.id)
          .where('client_event_hash', '=', clientEventHash)
          .executeTakeFirst();
        if (replay) {
          return this.rejected(now, 'replayed_event', credential);
        }

        const enrollment = await transaction
          .selectFrom('competition_gym_locations as eligible_gym')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'eligible_gym.competition_id',
          )
          .innerJoin(
            'competition_enrollments as enrollment',
            'enrollment.competition_id',
            'competition.id',
          )
          .select([
            'competition.id as competition_id',
            'competition.rules',
            'competition.rules_version',
            'enrollment.goal_days',
            'enrollment.id as enrollment_id',
          ])
          .where('eligible_gym.gym_location_id', '=', credential.gym_id)
          .where('competition.status', '=', 'active')
          .where('competition.starts_at', '<=', now)
          .where('competition.ends_at', '>', now)
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .executeTakeFirst();
        if (!enrollment) {
          return this.rejected(now, 'competition_unavailable', credential);
        }

        const eligibleDate = dateKeyInTimezone(now, credential.timezone);
        const alreadyVerified = await transaction
          .selectFrom('workout_sessions')
          .select('id')
          .where('competition_id', '=', enrollment.competition_id)
          .where('user_id', '=', user.id)
          .where('eligible_date', '=', eligibleDate)
          .where('status', '=', 'verified')
          .executeTakeFirst();
        if (alreadyVerified) {
          return this.rejected(now, 'daily_limit_reached', credential);
        }

        const active = await transaction
          .selectFrom('workout_sessions')
          .selectAll()
          .where('user_id', '=', user.id)
          .where('status', '=', 'active')
          .forUpdate()
          .executeTakeFirst();

        if (!active) {
          const expiresAt = new Date(
            now.getTime() + gymScanPolicy.sessionExpiryMilliseconds,
          );
          const session = await transaction
            .insertInto('workout_sessions')
            .values({
              competition_id: enrollment.competition_id,
              created_at: now,
              eligible_date: eligibleDate,
              enrollment_id: enrollment.enrollment_id,
              expires_at: expiresAt,
              gym_credential_version: credential.credential_version,
              gym_location_id: credential.gym_id,
              policy_version: enrollment.rules_version,
              started_at: now,
              status: 'active',
              updated_at: now,
              user_id: user.id,
              verification_mode: 'static_qr',
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          await this.recordScan(transaction, {
            clientEventHash,
            credentialVersion: credential.credential_version,
            gymLocationId: credential.gym_id,
            outcome: 'started',
            scanType: 'entry',
            serverTimestamp: now,
            sessionId: session.id,
            userId: user.id,
          });
          return this.result(now, credential, {
            expiresAt,
            outcome: 'started',
            remainingSeconds: gymScanPolicy.minimumSessionMilliseconds / 1_000,
            sessionId: session.id,
            startedAt: now,
          });
        }

        if (
          active.verification_mode !== 'static_qr' ||
          active.gym_location_id !== credential.gym_id ||
          active.competition_id !== enrollment.competition_id
        ) {
          await this.recordScan(transaction, {
            clientEventHash,
            credentialVersion: credential.credential_version,
            gymLocationId: credential.gym_id,
            outcome: 'rejected',
            scanType: 'exit',
            serverTimestamp: now,
            sessionId: active.id,
            userId: user.id,
          });
          return this.rejected(now, 'session_gym_mismatch', credential, active);
        }
        if (
          !isMatchingSessionCredential(
            active.gym_credential_version,
            credential.credential_version,
          )
        ) {
          await this.recordScan(transaction, {
            clientEventHash,
            credentialVersion: credential.credential_version,
            gymLocationId: credential.gym_id,
            outcome: 'rejected',
            scanType: 'exit',
            serverTimestamp: now,
            sessionId: active.id,
            userId: user.id,
          });
          return this.rejected(
            now,
            'session_credential_mismatch',
            credential,
            active,
          );
        }

        const expiresAt = active.expires_at!;
        const resolution = resolveActiveSessionScan({
          expiresAt,
          now,
          startedAt: active.started_at,
        });
        if (resolution.outcome === 'rejected') {
          await transaction
            .updateTable('workout_sessions')
            .set({
              completed_at: now,
              status: 'cancelled',
              updated_at: now,
              verification_summary: {
                outcome: 'incomplete_expired',
                verificationMode: 'static_qr',
              },
            })
            .where('id', '=', active.id)
            .where('status', '=', 'active')
            .executeTakeFirstOrThrow();
          await this.recordScan(transaction, {
            clientEventHash,
            credentialVersion: credential.credential_version,
            gymLocationId: credential.gym_id,
            outcome: 'rejected',
            scanType: 'exit',
            serverTimestamp: now,
            sessionId: active.id,
            userId: user.id,
          });
          return this.rejected(now, resolution.reason, credential, active);
        }

        if (resolution.outcome === 'too_early') {
          await this.recordScan(transaction, {
            clientEventHash,
            credentialVersion: credential.credential_version,
            gymLocationId: credential.gym_id,
            outcome: 'too_early',
            scanType: 'early_exit',
            serverTimestamp: now,
            sessionId: active.id,
            userId: user.id,
          });
          return this.result(now, credential, {
            expiresAt,
            outcome: 'too_early',
            remainingSeconds: resolution.remainingSeconds,
            sessionId: active.id,
            startedAt: active.started_at,
          });
        }

        await transaction
          .updateTable('workout_sessions')
          .set({
            completed_at: now,
            status: 'verified',
            updated_at: now,
            verification_summary: {
              credentialVersion: credential.credential_version,
              durationMinutes: Math.floor(
                (now.getTime() - active.started_at.getTime()) / 60_000,
              ),
              gymLocationId: credential.gym_id,
              outcome: 'verified',
              verificationMode: 'static_qr',
            },
          })
          .where('id', '=', active.id)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow();
        await this.recordScan(transaction, {
          clientEventHash,
          credentialVersion: credential.credential_version,
          gymLocationId: credential.gym_id,
          outcome: 'verified',
          scanType: 'exit',
          serverTimestamp: now,
          sessionId: active.id,
          userId: user.id,
        });
        const rules = parseCompetitionRules(enrollment.rules);
        await this.ledger.append(transaction, {
          categoryScoreDelta: rules.verifiedSessionCategoryScore,
          competitionId: active.competition_id,
          enrollmentId: active.enrollment_id,
          goalDays: enrollment.goal_days,
          metadata: {
            eligibleDate,
            gymLocationId: credential.gym_id,
            verificationMode: 'static_qr',
          },
          policyVersion: enrollment.rules_version,
          prizeDrawEntriesDelta: rules.verifiedSessionPrizeDrawEntries,
          reason: 'verified_session',
          sourceEventId: active.id,
          userId: user.id,
          verifiedDaysDelta: 1,
        });

        return this.result(now, credential, {
          expiresAt,
          outcome: 'verified',
          remainingSeconds: 0,
          sessionId: active.id,
          startedAt: active.started_at,
        });
      },
    );
  }

  async listGymLocations(
    principal: AuthenticatedPrincipal,
  ): Promise<GymLocationResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireAdmin(principal, transaction);
        const gyms = await this.gymLocationQuery(transaction).execute();
        return gyms.map((gym) => this.mapGymLocation(gym));
      });
  }

  createGymLocation(
    principal: AuthenticatedPrincipal,
    requestId: string,
    input: CreateGymLocationDto,
  ): Promise<GymLocationResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const now = new Date();
        const gym = await transaction
          .insertInto('gym_locations')
          .values({
            active: true,
            address: input.address.trim(),
            coordinates: sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`,
            created_at: now,
            name: input.name.trim(),
            radius_meters: input.radiusMeters,
            region_policy_id: input.regionPolicyId,
            updated_at: now,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.adminAuthorization.audit(transaction, {
          action: 'gym_location.created',
          actorUserId: admin.id,
          entityId: gym.id,
          entityType: 'gym_locations',
          nextState: {
            active: true,
            address: input.address.trim(),
            name: input.name.trim(),
            radiusMeters: input.radiusMeters,
            regionPolicyId: input.regionPolicyId,
          },
          previousState: null,
          reason: input.reason,
          requestId,
        });
        return this.getGymLocation(transaction, gym.id);
      });
  }

  updateGymLocation(
    principal: AuthenticatedPrincipal,
    gymId: string,
    requestId: string,
    input: UpdateGymLocationDto,
  ): Promise<GymLocationResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const previous = await this.getGymLocation(transaction, gymId);
        const now = new Date();
        await transaction
          .updateTable('gym_locations')
          .set({
            active: input.active,
            address: input.address.trim(),
            coordinates: sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`,
            name: input.name.trim(),
            radius_meters: input.radiusMeters,
            region_policy_id: input.regionPolicyId,
            updated_at: now,
          })
          .where('id', '=', gymId)
          .executeTakeFirstOrThrow();
        const next = await this.getGymLocation(transaction, gymId);
        await this.adminAuthorization.audit(transaction, {
          action: 'gym_location.updated',
          actorUserId: admin.id,
          entityId: gymId,
          entityType: 'gym_locations',
          nextState: this.gymAuditState(next),
          previousState: this.gymAuditState(previous),
          reason: input.reason,
          requestId,
        });
        return next;
      });
  }

  issueCredential(
    principal: AuthenticatedPrincipal,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<GymQrCredentialResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const gym = await transaction
          .selectFrom('gym_locations')
          .select(['active', 'id', 'name'])
          .where('id', '=', gymId)
          .forUpdate()
          .executeTakeFirst();
        if (!gym) {
          throw new NotFoundException({
            code: 'GYM_LOCATION_NOT_FOUND',
            message: 'The gym location was not found.',
          });
        }
        if (!gym.active) {
          throw new ConflictException({
            code: 'GYM_LOCATION_INACTIVE',
            message: 'A QR poster cannot be issued for an inactive gym.',
          });
        }
        const now = new Date();
        await transaction
          .updateTable('gym_qr_credentials')
          .set({
            revocation_reason: 'Superseded by a newly issued QR poster.',
            revoked_at: now,
            revoked_by_user_id: admin.id,
            status: 'revoked',
          })
          .where('gym_location_id', '=', gym.id)
          .where('status', '=', 'active')
          .execute();
        const latest = await transaction
          .selectFrom('gym_qr_credentials')
          .select((expression) =>
            expression.fn.max<number>('credential_version').as('version'),
          )
          .where('gym_location_id', '=', gym.id)
          .executeTakeFirstOrThrow();
        const credentialVersion = Number(latest.version ?? 0) + 1;
        const token = randomBytes(32).toString('base64url');
        const credential = await transaction
          .insertInto('gym_qr_credentials')
          .values({
            credential_version: credentialVersion,
            gym_location_id: gym.id,
            issued_at: now,
            issued_by_user_id: admin.id,
            status: 'active',
            token_hash: hashOpaqueValue(token),
          })
          .returning(['id', 'issued_at'])
          .executeTakeFirstOrThrow();
        await this.adminAuthorization.audit(transaction, {
          action: 'gym_qr_credential.issued',
          actorUserId: admin.id,
          entityId: credential.id,
          entityType: 'gym_qr_credentials',
          nextState: { credentialVersion, gymLocationId: gym.id },
          previousState: null,
          reason,
          requestId,
        });
        const qrPayload = `https://app.gogymgo.com/scan?credential=${encodeURIComponent(token)}`;
        return {
          credentialVersion,
          gymLocationId: gym.id,
          id: credential.id,
          issuedAt: credential.issued_at.toISOString(),
          printablePosterSvg: await this.buildPosterSvg(
            gym.name,
            qrPayload,
            credentialVersion,
          ),
          qrPayload,
        };
      });
  }

  revokeCredential(
    principal: AuthenticatedPrincipal,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<{ id: string; status: 'revoked' }> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const now = new Date();
        const credential = await transaction
          .updateTable('gym_qr_credentials')
          .set({
            revocation_reason: reason.trim(),
            revoked_at: now,
            revoked_by_user_id: admin.id,
            status: 'revoked',
          })
          .where('gym_location_id', '=', gymId)
          .where('status', '=', 'active')
          .returning(['credential_version', 'id'])
          .executeTakeFirst();
        if (!credential) {
          throw new NotFoundException({
            code: 'ACTIVE_GYM_QR_NOT_FOUND',
            message: 'The gym has no active QR credential to revoke.',
          });
        }
        await this.adminAuthorization.audit(transaction, {
          action: 'gym_qr_credential.revoked',
          actorUserId: admin.id,
          entityId: credential.id,
          entityType: 'gym_qr_credentials',
          nextState: { status: 'revoked' },
          previousState: {
            credentialVersion: credential.credential_version,
            status: 'active',
          },
          reason,
          requestId,
        });
        return { id: credential.id, status: 'revoked' };
      });
  }

  assignCompetitionGym(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<{ id: string; status: 'assigned' }> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const pair = await transaction
          .selectFrom('competitions as competition')
          .innerJoin(
            'gym_locations as gym',
            'gym.region_policy_id',
            'competition.region_policy_id',
          )
          .select(['competition.id as competition_id', 'gym.id as gym_id'])
          .where('competition.id', '=', competitionId)
          .where('gym.id', '=', gymId)
          .executeTakeFirst();
        if (!pair) {
          throw new BadRequestException({
            code: 'COMPETITION_GYM_REGION_MISMATCH',
            message: 'The gym and competition must belong to the same region.',
          });
        }
        await transaction
          .insertInto('competition_gym_locations')
          .values({ competition_id: competitionId, gym_location_id: gymId })
          .onConflict((conflict) => conflict.doNothing())
          .executeTakeFirst();
        await this.adminAuthorization.audit(transaction, {
          action: 'competition.gym_assigned',
          actorUserId: admin.id,
          entityId: competitionId,
          entityType: 'competitions',
          nextState: { gymLocationId: gymId },
          previousState: null,
          reason,
          requestId,
        });
        return { id: competitionId, status: 'assigned' };
      });
  }

  submitWaitlist(
    input: RegionWaitlistRequestDto,
  ): Promise<RegionWaitlistEntryDto> {
    const now = new Date();
    return this.database.connection
      .insertInto('region_waitlist_entries')
      .values({
        country_code: input.countryCode?.trim().toUpperCase() ?? null,
        created_at: now,
        email: input.email.trim().toLowerCase(),
        requested_region: input.requestedRegion.trim(),
        source: 'member_onboarding',
        status: 'waiting',
        subdivision_code: input.subdivisionCode?.trim().toUpperCase() ?? null,
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.columns(['email', 'requested_region']).doUpdateSet({
          country_code: input.countryCode?.trim().toUpperCase() ?? null,
          source: 'member_onboarding',
          status: 'waiting',
          subdivision_code: input.subdivisionCode?.trim().toUpperCase() ?? null,
          updated_at: now,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow()
      .then((entry) => this.mapWaitlist(entry));
  }

  async submitInterest(
    input: InterestSubmissionDto,
  ): Promise<InterestSubmissionResponseDto> {
    if (!input.consent) {
      throw new BadRequestException({
        code: 'CONTACT_CONSENT_REQUIRED',
        message: 'Please confirm that GoGymGo may contact you.',
      });
    }
    if (
      input.audience === 'gym_goer' &&
      (!input.workoutStyle || !input.goalDays)
    ) {
      throw new BadRequestException({
        code: 'GYM_GOER_INTEREST_INCOMPLETE',
        message: 'Workout style and Weekly Goal are required.',
      });
    }
    if (
      input.audience === 'brand' &&
      (!input.companyName || !input.partnershipInterest)
    ) {
      throw new BadRequestException({
        code: 'BRAND_INTEREST_INCOMPLETE',
        message: 'Company and partnership interest are required.',
      });
    }
    const now = new Date();
    const submission = await this.database.connection
      .insertInto('interest_submissions')
      .values({
        audience: input.audience,
        company_name: input.companyName?.trim() ?? null,
        consent: true,
        created_at: now,
        discovery_source: input.discoverySource?.trim() ?? null,
        email: input.email.trim().toLowerCase(),
        full_name: input.fullName.trim(),
        goal_days: input.goalDays ?? null,
        message: input.message?.trim() ?? null,
        partnership_interest: input.partnershipInterest?.trim() ?? null,
        region: input.region.trim(),
        source: 'gogymgo.com',
        updated_at: now,
        website: input.website?.trim() ?? null,
        workout_style: input.workoutStyle?.trim() ?? null,
      })
      .onConflict((conflict) =>
        conflict.columns(['audience', 'email']).doUpdateSet({
          company_name: input.companyName?.trim() ?? null,
          consent: true,
          discovery_source: input.discoverySource?.trim() ?? null,
          full_name: input.fullName.trim(),
          goal_days: input.goalDays ?? null,
          message: input.message?.trim() ?? null,
          partnership_interest: input.partnershipInterest?.trim() ?? null,
          region: input.region.trim(),
          source: 'gogymgo.com',
          updated_at: now,
          website: input.website?.trim() ?? null,
          workout_style: input.workoutStyle?.trim() ?? null,
        }),
      )
      .returning(['audience', 'created_at', 'id'])
      .executeTakeFirstOrThrow();
    return {
      audience: submission.audience,
      id: submission.id,
      submittedAt: submission.created_at.toISOString(),
    };
  }

  listWaitlist(
    principal: AuthenticatedPrincipal,
  ): Promise<RegionWaitlistEntryDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireAdmin(principal, transaction);
        const entries = await transaction
          .selectFrom('region_waitlist_entries')
          .selectAll()
          .orderBy('created_at', 'desc')
          .limit(500)
          .execute();
        return entries.map((entry) => this.mapWaitlist(entry));
      });
  }

  listInterest(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorInterestSubmissionDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireAdmin(principal, transaction);
        const submissions = await transaction
          .selectFrom('interest_submissions')
          .selectAll()
          .orderBy('created_at', 'desc')
          .limit(500)
          .execute();
        return submissions.map((submission) => ({
          audience: submission.audience,
          companyName: submission.company_name,
          email: submission.email,
          fullName: submission.full_name,
          goalDays: submission.goal_days,
          id: submission.id,
          partnershipInterest: submission.partnership_interest,
          region: submission.region,
          submittedAt: submission.created_at.toISOString(),
          workoutStyle: submission.workout_style,
        }));
      });
  }

  listGymSessions(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorGymSessionDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireAdmin(principal, transaction);
        const now = new Date();
        const sessions = await transaction
          .selectFrom('workout_sessions as session')
          .innerJoin(
            'gym_locations as gym',
            'gym.id',
            'session.gym_location_id',
          )
          .select([
            'gym.id as gym_id',
            'gym.name as gym_name',
            'session.completed_at',
            'session.expires_at',
            'session.id',
            'session.started_at',
            'session.status',
          ])
          .where('session.verification_mode', '=', 'static_qr')
          .orderBy('session.started_at', 'desc')
          .limit(500)
          .execute();
        return sessions.map((session) => ({
          completedAt: session.completed_at?.toISOString() ?? null,
          gymLocationId: session.gym_id,
          gymName: session.gym_name,
          id: session.id,
          incomplete:
            session.status === 'cancelled' ||
            (session.status === 'active' &&
              session.expires_at !== null &&
              session.expires_at <= now),
          startedAt: session.started_at.toISOString(),
          status: session.status,
        }));
      });
  }

  recordCashFulfillment(
    principal: AuthenticatedPrincipal,
    requestId: string,
    input: CashFulfillmentRequestDto,
  ): Promise<CashFulfillmentRecordDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const award = await transaction
          .selectFrom('reward_awards as award')
          .innerJoin('competition_draws as draw', 'draw.id', 'award.draw_id')
          .innerJoin(
            'reward_catalog_items as reward',
            'reward.id',
            'award.reward_catalog_item_id',
          )
          .select([
            'award.id',
            'award.status',
            'award.user_id',
            'draw.competition_id',
            'draw.status as draw_status',
            'reward.reward_type',
          ])
          .where('award.id', '=', input.rewardAwardId)
          .forUpdate()
          .executeTakeFirst();
        if (!award) {
          throw new NotFoundException({
            code: 'REWARD_AWARD_NOT_FOUND',
            message: 'The reward award was not found.',
          });
        }
        if (award.draw_status !== 'settled') {
          throw new ConflictException({
            code: 'DRAW_NOT_SETTLED',
            message: 'Cash can be fulfilled only after the draw is settled.',
          });
        }
        if (award.reward_type !== 'cash') {
          throw new ConflictException({
            code: 'CASH_REWARD_REQUIRED',
            message: 'Only a cash reward can use the cash handoff workflow.',
          });
        }
        if (award.status !== 'awarded' && award.status !== 'claimed') {
          throw new ConflictException({
            code: 'REWARD_AWARD_NOT_FULFILLABLE',
            message:
              'This reward award cannot be fulfilled in its current state.',
          });
        }
        if (
          input.amountCents !== 10_000 ||
          input.currency.trim().toUpperCase() !== 'CAD'
        ) {
          throw new BadRequestException({
            code: 'PILOT_CASH_AMOUNT_INVALID',
            message:
              'The September pilot cash handoff must be exactly $100 CAD.',
          });
        }
        const now = new Date();
        const fulfillment = await transaction
          .insertInto('cash_fulfillments')
          .values({
            amount_cents: input.amountCents,
            competition_id: award.competition_id,
            created_at: now,
            currency: input.currency.trim().toUpperCase(),
            fulfilled_at: now,
            fulfilled_by_user_id: admin.id,
            fulfillment_note: input.reason.trim(),
            reward_award_id: award.id,
            winner_user_id: award.user_id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable('reward_awards')
          .set({
            claimed_at: now,
            fulfilled_at: now,
            status: 'fulfilled',
            updated_at: now,
          })
          .where('id', '=', award.id)
          .executeTakeFirstOrThrow();
        await this.adminAuthorization.audit(transaction, {
          action: 'cash_fulfillment.recorded',
          actorUserId: admin.id,
          entityId: fulfillment.id,
          entityType: 'cash_fulfillments',
          nextState: {
            amountCents: fulfillment.amount_cents,
            currency: fulfillment.currency,
            rewardAwardId: fulfillment.reward_award_id,
          },
          previousState: { rewardAwardStatus: award.status },
          reason: input.reason,
          requestId,
        });
        return this.mapFulfillment(fulfillment);
      });
  }

  listAuditHistory(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorAuditHistoryDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireAdmin(principal, transaction);
        const events = await transaction
          .selectFrom('operator_audit_events')
          .select([
            'action',
            'created_at',
            'entity_id',
            'entity_type',
            'id',
            'reason',
          ])
          .orderBy('created_at', 'desc')
          .limit(500)
          .execute();
        return events.map((event) => ({
          action: event.action,
          createdAt: event.created_at.toISOString(),
          entityId: event.entity_id,
          entityType: event.entity_type,
          id: event.id,
          reason: event.reason,
        }));
      });
  }

  async expireIncompleteSessions(): Promise<number> {
    const now = new Date();
    const expired = await this.database.connection
      .updateTable('workout_sessions')
      .set({
        completed_at: now,
        status: 'cancelled',
        updated_at: now,
        verification_summary: {
          outcome: 'incomplete_expired',
          verificationMode: 'static_qr',
        },
      })
      .where('verification_mode', '=', 'static_qr')
      .where('status', '=', 'active')
      .where('expires_at', '<=', now)
      .returning('id')
      .execute();
    return expired.length;
  }

  private async recordScan(
    transaction: Transaction<Database>,
    input: {
      clientEventHash: string;
      credentialVersion: number;
      gymLocationId: string;
      outcome: 'rejected' | 'started' | 'too_early' | 'verified';
      scanType: 'early_exit' | 'entry' | 'exit';
      serverTimestamp: Date;
      sessionId: string;
      userId: string;
    },
  ): Promise<void> {
    await transaction
      .insertInto('gym_scan_events')
      .values({
        client_event_hash: input.clientEventHash,
        credential_version: input.credentialVersion,
        gym_location_id: input.gymLocationId,
        outcome: input.outcome,
        scan_type: input.scanType,
        server_timestamp: input.serverTimestamp,
        session_id: input.sessionId,
        user_id: input.userId,
      })
      .executeTakeFirstOrThrow();
  }

  private result(
    now: Date,
    credential: {
      credential_version: number;
      gym_id: string;
      gym_name: string;
    },
    input: {
      expiresAt: Date;
      outcome: 'started' | 'too_early' | 'verified';
      remainingSeconds: number;
      sessionId: string;
      startedAt: Date;
    },
  ): GymScanJson {
    return {
      credentialVersion: credential.credential_version,
      expiresAt: input.expiresAt.toISOString(),
      gymLocationId: credential.gym_id,
      gymName: credential.gym_name,
      minimumCompleteAt: new Date(
        input.startedAt.getTime() + gymScanPolicy.minimumSessionMilliseconds,
      ).toISOString(),
      outcome: input.outcome,
      rejectionReason: null,
      remainingSeconds: input.remainingSeconds,
      serverTimestamp: now.toISOString(),
      sessionId: input.sessionId,
      startedAt: input.startedAt.toISOString(),
    };
  }

  private rejected(
    now: Date,
    rejectionReason: string,
    credential?: {
      credential_version: number;
      gym_id: string;
      gym_name: string;
    },
    session?: {
      expires_at: Date | null;
      id: string;
      started_at: Date;
    },
  ): GymScanJson {
    return {
      credentialVersion: credential?.credential_version ?? null,
      expiresAt: session?.expires_at?.toISOString() ?? null,
      gymLocationId: credential?.gym_id ?? null,
      gymName: credential?.gym_name ?? null,
      minimumCompleteAt: session
        ? new Date(
            session.started_at.getTime() +
              gymScanPolicy.minimumSessionMilliseconds,
          ).toISOString()
        : null,
      outcome: 'rejected',
      rejectionReason,
      remainingSeconds: 0,
      serverTimestamp: now.toISOString(),
      sessionId: session?.id ?? null,
      startedAt: session?.started_at.toISOString() ?? null,
    };
  }

  private gymLocationQuery(transaction: Transaction<Database>) {
    return transaction
      .selectFrom('gym_locations as gym')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'gym.region_policy_id',
      )
      .leftJoin('gym_qr_credentials as credential', (join) =>
        join
          .onRef('credential.gym_location_id', '=', 'gym.id')
          .on('credential.status', '=', 'active'),
      )
      .select([
        'credential.credential_version as active_credential_version',
        'gym.active',
        'gym.address',
        'gym.created_at',
        'gym.id',
        'gym.name',
        'gym.radius_meters',
        'gym.region_policy_id',
        'gym.updated_at',
        'region.code as region_code',
        sql<number>`ST_Y(${sql.ref('gym.coordinates')}::geometry)`.as(
          'latitude',
        ),
        sql<number>`ST_X(${sql.ref('gym.coordinates')}::geometry)`.as(
          'longitude',
        ),
      ]);
  }

  private async getGymLocation(
    transaction: Transaction<Database>,
    gymId: string,
  ): Promise<GymLocationResponseDto> {
    const gym = await this.gymLocationQuery(transaction)
      .where('gym.id', '=', gymId)
      .executeTakeFirst();
    if (!gym) {
      throw new NotFoundException({
        code: 'GYM_LOCATION_NOT_FOUND',
        message: 'The gym location was not found.',
      });
    }
    return this.mapGymLocation(gym);
  }

  private mapGymLocation(gym: {
    active: boolean;
    active_credential_version: number | null;
    address: string;
    created_at: Date;
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    radius_meters: number;
    region_code: string;
    region_policy_id: string;
    updated_at: Date;
  }): GymLocationResponseDto {
    return {
      active: gym.active,
      activeCredentialVersion: gym.active_credential_version,
      address: gym.address,
      createdAt: gym.created_at.toISOString(),
      id: gym.id,
      latitude: Number(gym.latitude),
      longitude: Number(gym.longitude),
      name: gym.name,
      radiusMeters: gym.radius_meters,
      regionCode: gym.region_code,
      regionPolicyId: gym.region_policy_id,
      updatedAt: gym.updated_at.toISOString(),
    };
  }

  private gymAuditState(gym: GymLocationResponseDto): JsonObject {
    return {
      active: gym.active,
      address: gym.address,
      name: gym.name,
      radiusMeters: gym.radiusMeters,
      regionPolicyId: gym.regionPolicyId,
    };
  }

  private mapWaitlist(entry: {
    created_at: Date;
    email: string;
    id: string;
    requested_region: string;
    source: string;
    status: string;
  }): RegionWaitlistEntryDto {
    return {
      createdAt: entry.created_at.toISOString(),
      email: entry.email,
      id: entry.id,
      requestedRegion: entry.requested_region,
      source: entry.source,
      status: entry.status,
    };
  }

  private mapFulfillment(fulfillment: {
    amount_cents: number;
    competition_id: string;
    currency: string;
    fulfilled_at: Date;
    fulfillment_note: string;
    id: string;
    reward_award_id: string;
    winner_user_id: string;
  }): CashFulfillmentRecordDto {
    return {
      amountCents: fulfillment.amount_cents,
      competitionId: fulfillment.competition_id,
      currency: fulfillment.currency,
      fulfilledAt: fulfillment.fulfilled_at.toISOString(),
      fulfillmentNote: fulfillment.fulfillment_note,
      id: fulfillment.id,
      rewardAwardId: fulfillment.reward_award_id,
      winnerUserId: fulfillment.winner_user_id,
    };
  }

  private async buildPosterSvg(
    gymName: string,
    qrPayload: string,
    credentialVersion: number,
  ): Promise<string> {
    const qr = await QRCode.toString(qrPayload, {
      color: { dark: '#05090b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
      margin: 4,
      type: 'svg',
      width: 620,
    });
    const qrViewBox = qr.match(/\bviewBox="([^"]+)"/)?.[1];
    const qrBody = qr
      .replace(/<\?xml[^>]*>\s*/, '')
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '');
    if (!qrViewBox) {
      throw new Error('The QR renderer did not return an SVG viewBox.');
    }
    const safeName = gymName
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" role="img" aria-label="GoGymGo QR poster for ${safeName}">
  <title>GoGymGo $100 September Challenge at ${safeName}</title>
  <desc>Scan the QR code and sign up for the $100 September Challenge. Scan in, train for at least 30 minutes and scan the same poster again to finish.</desc>
  <rect width="1000" height="1400" fill="#05090b"/>
  <rect x="24" y="24" width="952" height="1352" rx="32" fill="none" stroke="#173A46" stroke-width="3"/>

  <!-- Canonical GoGymGo mark and cyan/pink/cyan wordmark lockup. -->
  <g role="img" aria-label="GoGymGo logo">
    <svg x="72" y="52" width="96" height="96" viewBox="0 0 100 100" aria-hidden="true">
      <path fill="#34E5E8" d="M74 88H26q-3.3 0-6.05-1.6t-4.35-4.35Q14 79.3 14 76V28q0-3.3 1.6-6.05t4.35-4.35Q22.7 16 26 16h48q3.3 0 6.05 1.6t4.35 4.35Q86 24.7 86 28v2.9h-8.1V28q0-1.6-1.15-2.75T74 24.1H26q-1.6 0-2.75 1.15T22.1 28v48q0 1.6 1.15 2.75T26 79.9h48q1.6 0 2.75-1.15T77.9 76V58.2H60.1V50H86v26q0 3.3-1.6 6.05t-4.35 4.35Q77.3 88 74 88Z"/>
    </svg>
    <text x="190" y="124" font-family="Orbitron, Arial, sans-serif" font-size="70" font-weight="700" letter-spacing="2"><tspan fill="#34E5E8">GO</tspan><tspan fill="#FF2D9B">GYM</tspan><tspan fill="#34E5E8">GO</tspan></text>
  </g>

  <text x="500" y="190" text-anchor="middle" fill="#9FF3F5" font-family="Share Tech Mono, monospace" font-size="22" letter-spacing="3">SEPTEMBER 2026 - VANCOUVER ISLAND + GULF ISLANDS</text>
  <text x="500" y="246" text-anchor="middle" fill="#E9F7F8" font-family="Orbitron, Arial, sans-serif" font-size="31" font-weight="700">SCAN THE QR CODE AND SIGN UP FOR THE</text>
  <text x="500" y="307" text-anchor="middle" fill="#FFE066" font-family="Orbitron, Arial, sans-serif" font-size="53" font-weight="700">$100 SEPTEMBER CHALLENGE.</text>

  <rect x="160" y="345" width="680" height="680" rx="34" fill="#fff"/>
  <svg x="190" y="375" width="620" height="620" viewBox="${qrViewBox}" shape-rendering="crispEdges" aria-label="Scan to open the GoGymGo challenge">
    ${qrBody}
  </svg>

  <text x="500" y="1084" text-anchor="middle" fill="#E9F7F8" font-family="Orbitron, Arial, sans-serif" font-size="38" font-weight="700">${safeName}</text>
  <text x="500" y="1130" text-anchor="middle" fill="#34E5E8" font-family="Share Tech Mono, monospace" font-size="25" letter-spacing="2">SCAN IN  &gt;  TRAIN 30+ MIN  &gt;  SCAN OUT</text>
  <line x1="100" y1="1165" x2="900" y2="1165" stroke="#173A46" stroke-width="2"/>

  <text x="500" y="1208" text-anchor="middle" fill="#E9F7F8" font-family="Share Tech Mono, monospace" font-size="19">REGISTRATION OPENS AUGUST 1  |  CHALLENGE SEPTEMBER 1-30, 2026</text>
  <text x="500" y="1248" text-anchor="middle" fill="#4DFF88" font-family="Share Tech Mono, monospace" font-size="19">ONE $100 CAD REWARD  |  FREE TO ENTER  |  NO PURCHASE REQUIRED  |  AGE 19+</text>
  <text x="500" y="1288" text-anchor="middle" fill="#E9F7F8" font-family="Share Tech Mono, monospace" font-size="19">Choose a 1-7 day weekly goal. Complete it to earn Prize Draw Entries.</text>
  <text x="500" y="1324" text-anchor="middle" fill="#96AAB0" font-family="Share Tech Mono, monospace" font-size="16">Location access is required. Entries improve odds but do not guarantee the reward.</text>
  <text x="500" y="1358" text-anchor="middle" fill="#9FF3F5" font-family="Share Tech Mono, monospace" font-size="16">Official Rules and eligibility apply - GOGYMGO.COM</text>
  <text x="950" y="1358" text-anchor="end" fill="#607781" font-family="monospace" font-size="11">POSTER V${credentialVersion}</text>
</svg>`;
  }
}

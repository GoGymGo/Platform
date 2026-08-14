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
import { canDeleteGym } from '../operator/admin-deletion-policy';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CashFulfillmentRecordDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  GymLocationResponseDto,
  GymQrCredentialHistoryDto,
  GymQrCredentialResponseDto,
  GymScanRequestDto,
  GymScanResultDto,
  InterestSubmissionDto,
  InterestSubmissionResponseDto,
  MemberRegionWaitlistRequestDto,
  OperatorInterestSubmissionDto,
  OperatorAuditHistoryDto,
  OperatorGymSessionDto,
  RegionWaitlistEntryDto,
  RegionWaitlistReceiptDto,
  RegionWaitlistRequestDto,
  UpdateRegionWaitlistStatusDto,
  UpdateGymLocationDto,
} from './dto/gym.dto';
import { regionalUpdatesConsentNoticeVersion } from './dto/gym.dto';
import {
  canCompleteGymSession,
  canStartGymSession,
  competitionCompletionDeadline,
  gymScanPolicy,
  hashOpaqueValue,
  isAcceptableLocationAccuracy,
  isMatchingSessionCredential,
  isWithinGymGeofence,
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

interface GymPresenceContext {
  competition_id: string;
  credential_version: number;
  distance_meters: number;
  gym_active: boolean;
  gym_id: string;
  gym_name: string;
  radius_meters: number;
  timezone: string;
}

interface DeletedGymJson extends JsonObject {
  id: string;
  status: 'deleted';
}

interface GymQrCredentialJson extends JsonObject {
  competitionId: string;
  competitionName: string;
  credentialVersion: number;
  expiresAt: string;
  gymLocationId: string;
  id: string;
  issuedAt: string;
  printablePosterSvg: string;
  qrPayload: string;
}

interface GymQrCredentialActionJson extends JsonObject {
  id: string;
  status: 'revoked';
}

interface CompetitionGymAssignmentJson extends JsonObject {
  id: string;
  status: 'assigned';
}

interface WaitlistEntryJson extends JsonObject {
  consentNoticeVersion: string | null;
  consentedAt: string | null;
  createdAt: string;
  email: string;
  id: string;
  requestedRegion: string;
  source: string;
  status: string;
}

interface PosterReward {
  inventoryTotal: number;
  sponsorName: string;
  title: string;
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
          competitionId: request.competitionId ?? null,
          credentialHash: request.credential
            ? hashOpaqueValue(request.credential)
            : null,
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
        const clientEventHash = hashOpaqueValue(request.eventId);

        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`.execute(
          transaction,
        );

        const credential = request.credential
          ? await this.resolveQrGymPresence(transaction, request)
          : await this.resolveEnrolledGymPresence(
              transaction,
              user.id,
              request,
            );

        if (!credential) {
          return this.rejected(
            now,
            request.credential
              ? 'invalid_or_revoked_credential'
              : 'gym_selection_required',
          );
        }
        if (!credential.gym_active) {
          return this.rejected(now, 'gym_inactive', credential);
        }
        const withinGeofence = isWithinGymGeofence(
          credential.distance_meters,
          credential.radius_meters,
          request.accuracyMeters,
        );
        if (
          !withinGeofence &&
          !isAcceptableLocationAccuracy(request.accuracyMeters)
        ) {
          return this.rejected(now, 'inaccurate_location', credential);
        }
        if (!withinGeofence) {
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

        const credentialCompetitionId = credential.competition_id;
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
            'competition.ends_at',
            'competition.id as competition_id',
            'competition.rules',
            'competition.rules_version',
            'competition.status as competition_status',
            'enrollment.goal_days',
            'enrollment.id as enrollment_id',
          ])
          .where('eligible_gym.gym_location_id', '=', credential.gym_id)
          .where('eligible_gym.competition_id', '=', credentialCompetitionId)
          .where('competition.id', '=', credentialCompetitionId)
          .where('competition.status', 'in', ['active', 'settling'])
          .where('competition.starts_at', '<=', now)
          .where('enrollment.user_id', '=', user.id)
          .where('enrollment.status', '=', 'active')
          .where('enrollment.gym_location_id', '=', credential.gym_id)
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
          if (
            enrollment.competition_status !== 'active' ||
            !canStartGymSession({
              competitionEndsAt: enrollment.ends_at,
              now,
            })
          ) {
            return this.rejected(
              now,
              now < enrollment.ends_at
                ? 'insufficient_completion_time'
                : 'competition_unavailable',
              credential,
            );
          }
          const competitionDeadline = competitionCompletionDeadline(
            enrollment.ends_at,
          );
          const expiresAt = new Date(
            Math.min(
              now.getTime() + gymScanPolicy.sessionExpiryMilliseconds,
              competitionDeadline.getTime(),
            ),
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
        if (
          !canCompleteGymSession({
            competitionEndsAt: enrollment.ends_at,
            now,
            startedAt: active.started_at,
          })
        ) {
          await transaction
            .updateTable('workout_sessions')
            .set({
              completed_at: now,
              status: 'cancelled',
              updated_at: now,
              verification_summary: {
                outcome: 'competition_completion_grace_expired',
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
          return this.rejected(
            now,
            'completion_grace_expired',
            credential,
            active,
          );
        }

        // Finish requests reuse the gym credential saved during enrollment.
        // Completion relies on the fresh geofence reading above and server time;
        // the API does not receive or require evidence of another camera scan.
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
        const access = await this.adminAuthorization.resolvePortalAccess(
          principal,
          transaction,
        );
        let query = this.gymLocationQuery(transaction);
        if (access.kind === 'gym_partner') {
          query = query.where(
            'gym.id',
            'in',
            access.assignments.map((assignment) => assignment.gymLocationId),
          );
        }
        const gyms = await query.execute();
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
            address: input.address?.trim() ?? '',
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
            address: input.address?.trim() ?? '',
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
            address: input.address?.trim() ?? '',
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

  deleteGymLocation(
    principal: AuthenticatedPrincipal,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<{ id: string; status: 'deleted' }> {
    return this.idempotency.execute<DeletedGymJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: { gymId, reason },
        scope: `admin-gym-locations:${gymId}:delete`,
      },
      async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const gym = await transaction
          .selectFrom('gym_locations')
          .selectAll()
          .where('id', '=', gymId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!gym) {
          throw new NotFoundException({
            code: 'GYM_LOCATION_NOT_FOUND',
            message: 'The gym location was not found.',
          });
        }
        if (!canDeleteGym(gym.active)) {
          throw new ConflictException({
            code: 'GYM_DELETE_REQUIRES_INACTIVE',
            message: 'Deactivate the gym before deleting it.',
          });
        }

        const deletedAt = new Date();
        await transaction
          .updateTable('gym_qr_credentials')
          .set({
            revocation_reason: 'Gym deleted from the admin dashboard.',
            revoked_at: deletedAt,
            revoked_by_user_id: admin.id,
            status: 'revoked',
          })
          .where('gym_location_id', '=', gymId)
          .where('status', '=', 'active')
          .execute();
        await transaction
          .updateTable('gym_partner_assignments')
          .set({ active: false, updated_at: deletedAt })
          .where('gym_location_id', '=', gymId)
          .where('active', '=', true)
          .execute();
        const deleted = await transaction
          .updateTable('gym_locations')
          .set({ deleted_at: deletedAt, updated_at: deletedAt })
          .where('id', '=', gymId)
          .where('deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.adminAuthorization.audit(transaction, {
          action: 'gym_location.deleted',
          actorUserId: admin.id,
          entityId: gymId,
          entityType: 'gym_locations',
          nextState: {
            deletedAt: deletedAt.toISOString(),
            status: 'deleted',
          },
          previousState: {
            active: gym.active,
            name: gym.name,
            regionPolicyId: gym.region_policy_id,
          },
          reason,
          requestId,
        });
        return { id: deleted.id, status: 'deleted' };
      },
    );
  }

  issueCredential(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<GymQrCredentialResponseDto> {
    return this.idempotency.execute<GymQrCredentialJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: { competitionId, gymId, reason: reason.trim() },
        responseCode: 201,
        scope: `gym-qr-credentials:${competitionId}:${gymId}:issue`,
      },
      async (transaction) => {
        const operator = await this.adminAuthorization.requireGymAccess(
          principal,
          transaction,
          gymId,
          'admin',
        );
        const gym = await transaction
          .selectFrom('gym_locations')
          .select(['active', 'id', 'name', 'region_policy_id'])
          .where('id', '=', gymId)
          .where('deleted_at', 'is', null)
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
        const competition = await transaction
          .selectFrom('competition_gym_locations as assignment')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'assignment.competition_id',
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.ends_at',
            'competition.id',
            'competition.name',
            'competition.region_policy_id',
            'competition.registration_opens_at',
            'competition.starts_at',
            'competition.status',
            'region.metro_name as region_name',
            'region.timezone',
          ])
          .where('assignment.competition_id', '=', competitionId)
          .where('assignment.gym_location_id', '=', gym.id)
          .where('competition.deleted_at', 'is', null)
          .where('region.competition_enabled', '=', true)
          .where('region.deleted_at', 'is', null)
          .executeTakeFirst();
        if (!competition) {
          throw new ConflictException({
            code: 'CONTEST_GYM_ASSIGNMENT_REQUIRED',
            message:
              'Assign this gym to the selected contest before issuing its poster.',
          });
        }
        if (!['draft', 'registration', 'active'].includes(competition.status)) {
          throw new ConflictException({
            code: 'COMPETITION_NOT_CONFIGURABLE',
            message:
              'QR posters can be issued only for a draft, registration, or active contest.',
          });
        }
        const now = new Date();
        if (competition.region_policy_id !== gym.region_policy_id) {
          throw new ConflictException({
            code: 'COMPETITION_GYM_REGION_MISMATCH',
            message:
              'The Partner gym no longer belongs to the selected Contest region.',
          });
        }
        if (competition.ends_at <= now) {
          throw new ConflictException({
            code: 'GYM_QR_WINDOW_CLOSED',
            message: 'A QR poster cannot be issued after its Contest ends.',
          });
        }
        await transaction
          .updateTable('gym_qr_credentials')
          .set({
            revocation_reason: 'Superseded by a newly issued QR poster.',
            revoked_at: now,
            revoked_by_user_id: operator.user.id,
            status: 'revoked',
          })
          .where('competition_id', '=', competition.id)
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
        const qrPayload = `https://app.gogymgo.com/scan?credential=${encodeURIComponent(token)}`;
        const credential = await transaction
          .insertInto('gym_qr_credentials')
          .values({
            competition_id: competition.id,
            credential_version: credentialVersion,
            expires_at: competition.ends_at,
            gym_location_id: gym.id,
            issued_at: now,
            issued_by_user_id: operator.user.id,
            qr_payload: qrPayload,
            status: 'active',
            token_hash: hashOpaqueValue(token),
          })
          .returning(['id', 'issued_at'])
          .executeTakeFirstOrThrow();
        await this.adminAuthorization.audit(transaction, {
          action: 'gym_qr_credential.issued',
          actorUserId: operator.user.id,
          entityId: credential.id,
          entityType: 'gym_qr_credentials',
          nextState: {
            competitionId: competition.id,
            credentialVersion,
            gymLocationId: gym.id,
          },
          previousState: null,
          reason,
          requestId,
        });
        const posterReward = await this.getPosterReward(
          transaction,
          competition.id,
        );
        return {
          competitionId: competition.id,
          competitionName: competition.name,
          credentialVersion,
          expiresAt: competition.ends_at.toISOString(),
          gymLocationId: gym.id,
          id: credential.id,
          issuedAt: credential.issued_at.toISOString(),
          printablePosterSvg: await this.buildPosterSvg(
            gym.name,
            competition,
            qrPayload,
            credentialVersion,
            posterReward,
          ),
          qrPayload,
        };
      },
    );
  }

  getActiveCredential(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    gymId: string,
  ): Promise<GymQrCredentialResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireGymAccess(
          principal,
          transaction,
          gymId,
          'admin',
        );
        const credential = await transaction
          .selectFrom('gym_locations as gym')
          .innerJoin(
            'gym_qr_credentials as credential',
            'credential.gym_location_id',
            'gym.id',
          )
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'credential.competition_id',
          )
          .innerJoin('competition_gym_locations as assignment', (join) =>
            join
              .onRef('assignment.competition_id', '=', 'competition.id')
              .onRef('assignment.gym_location_id', '=', 'gym.id'),
          )
          .innerJoin(
            'region_policies as region',
            'region.id',
            'competition.region_policy_id',
          )
          .select([
            'competition.ends_at',
            'competition.id as competition_id',
            'competition.name as competition_name',
            'competition.registration_opens_at',
            'competition.starts_at',
            'credential.credential_version',
            'credential.expires_at',
            'credential.id',
            'credential.issued_at',
            'credential.qr_payload',
            'gym.id as gym_location_id',
            'gym.name as gym_name',
            'region.metro_name as region_name',
            'region.timezone',
          ])
          .where('gym.id', '=', gymId)
          .where('competition.id', '=', competitionId)
          .where('competition.deleted_at', 'is', null)
          .where('gym.deleted_at', 'is', null)
          .where('gym.active', '=', true)
          .where('credential.status', '=', 'active')
          .where('credential.expires_at', '>', new Date())
          .where('competition.ends_at', '>', new Date())
          .whereRef('competition.region_policy_id', '=', 'gym.region_policy_id')
          .where('region.competition_enabled', '=', true)
          .where('region.deleted_at', 'is', null)
          .executeTakeFirst();
        if (!credential?.qr_payload) {
          return null;
        }
        const posterReward = await this.getPosterReward(
          transaction,
          credential.competition_id,
        );
        return {
          competitionId: credential.competition_id,
          competitionName: credential.competition_name,
          credentialVersion: credential.credential_version,
          expiresAt: credential.expires_at.toISOString(),
          gymLocationId: credential.gym_location_id,
          id: credential.id,
          issuedAt: credential.issued_at.toISOString(),
          printablePosterSvg: await this.buildPosterSvg(
            credential.gym_name,
            {
              ends_at: credential.ends_at,
              id: credential.competition_id,
              name: credential.competition_name,
              registration_opens_at: credential.registration_opens_at,
              region_name: credential.region_name,
              starts_at: credential.starts_at,
              timezone: credential.timezone,
            },
            credential.qr_payload,
            credential.credential_version,
            posterReward,
          ),
          qrPayload: credential.qr_payload,
        };
      });
  }

  listCredentialHistory(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    gymId: string,
  ): Promise<GymQrCredentialHistoryDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireGymAccess(
          principal,
          transaction,
          gymId,
          'staff',
        );
        const now = new Date();
        const credentials = await transaction
          .selectFrom('gym_qr_credentials as credential')
          .innerJoin(
            'competitions as competition',
            'competition.id',
            'credential.competition_id',
          )
          .select([
            'competition.id as competition_id',
            'competition.name as competition_name',
            'credential.credential_version',
            'credential.expires_at',
            'credential.gym_location_id',
            'credential.id',
            'credential.issued_at',
            'credential.revoked_at',
            'credential.status',
          ])
          .where('competition.id', '=', competitionId)
          .where('credential.gym_location_id', '=', gymId)
          .orderBy('credential.credential_version', 'desc')
          .execute();

        return credentials.map((credential) => ({
          competitionId: credential.competition_id,
          competitionName: credential.competition_name,
          credentialVersion: credential.credential_version,
          expiresAt: credential.expires_at.toISOString(),
          gymLocationId: credential.gym_location_id,
          id: credential.id,
          issuedAt: credential.issued_at.toISOString(),
          revokedAt: credential.revoked_at?.toISOString() ?? null,
          status:
            credential.status === 'active' && credential.expires_at <= now
              ? ('expired' as const)
              : credential.status,
        }));
      });
  }

  revokeCredential(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<{ id: string; status: 'revoked' }> {
    return this.idempotency.execute<GymQrCredentialActionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: { competitionId, gymId, reason: reason.trim() },
        scope: `gym-qr-credentials:${competitionId}:${gymId}:revoke`,
      },
      async (transaction) => {
        const operator = await this.adminAuthorization.requireGymAccess(
          principal,
          transaction,
          gymId,
          'admin',
        );
        const now = new Date();
        const credential = await transaction
          .updateTable('gym_qr_credentials')
          .set({
            revocation_reason: reason.trim(),
            revoked_at: now,
            revoked_by_user_id: operator.user.id,
            status: 'revoked',
          })
          .where('competition_id', '=', competitionId)
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
          actorUserId: operator.user.id,
          entityId: credential.id,
          entityType: 'gym_qr_credentials',
          nextState: { status: 'revoked' },
          previousState: {
            competitionId,
            credentialVersion: credential.credential_version,
            status: 'active',
          },
          reason,
          requestId,
        });
        return { id: credential.id, status: 'revoked' };
      },
    );
  }

  assignCompetitionGym(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    gymId: string,
    requestId: string,
    reason: string,
  ): Promise<{ id: string; status: 'assigned' }> {
    return this.idempotency.execute<CompetitionGymAssignmentJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: requestId,
        request: { competitionId, gymId, reason: reason.trim() },
        scope: `competition-gym-locations:${competitionId}:${gymId}:assign`,
      },
      async (transaction) => {
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
          .select([
            'competition.id as competition_id',
            'competition.status as competition_status',
            'gym.active as gym_active',
            'gym.id as gym_id',
          ])
          .where('competition.id', '=', competitionId)
          .where('competition.deleted_at', 'is', null)
          .where('gym.id', '=', gymId)
          .where('gym.deleted_at', 'is', null)
          .executeTakeFirst();
        if (!pair) {
          throw new BadRequestException({
            code: 'COMPETITION_GYM_REGION_MISMATCH',
            message: 'The gym and competition must belong to the same region.',
          });
        }
        if (
          !['draft', 'registration', 'active'].includes(pair.competition_status)
        ) {
          throw new ConflictException({
            code: 'COMPETITION_NOT_OPERATIONAL',
            message:
              'Partner gyms can be assigned only to draft, registration, or active contests.',
          });
        }
        if (!pair.gym_active) {
          throw new ConflictException({
            code: 'GYM_LOCATION_INACTIVE',
            message: 'Only an active Partner gym can be assigned to a contest.',
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
      },
    );
  }

  async submitPublicWaitlist(
    input: RegionWaitlistRequestDto,
  ): Promise<RegionWaitlistReceiptDto> {
    this.assertWaitlistConsent(input);
    await this.database.connection.transaction().execute((transaction) =>
      this.upsertWaitlist(transaction, {
        ...input,
        email: input.email,
        source: 'landing',
        userId: null,
      }),
    );
    return { status: 'received' };
  }

  async submitMemberWaitlist(
    principal: AuthenticatedPrincipal,
    input: MemberRegionWaitlistRequestDto,
  ): Promise<RegionWaitlistReceiptDto> {
    this.assertWaitlistConsent(input);
    await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        this.profiles.requireVerifiedEmail(user);
        await this.upsertWaitlist(transaction, {
          ...input,
          email: user.email,
          source: 'member_onboarding',
          userId: user.id,
        });
      });
    return { status: 'received' };
  }

  private async upsertWaitlist(
    transaction: Transaction<Database>,
    input: MemberRegionWaitlistRequestDto & {
      email: string;
      source: 'landing' | 'member_onboarding';
      userId: string | null;
    },
  ): Promise<void> {
    const now = new Date();
    const requestedRegion = input.requestedRegion.trim().replace(/\s+/g, ' ');
    if (requestedRegion.length < 2) {
      throw new BadRequestException({
        code: 'REGION_WAITLIST_REGION_INVALID',
        message: 'Enter a city or region with at least two characters.',
      });
    }
    const requestedRegionKey = requestedRegion.toLocaleLowerCase('en-CA');
    await transaction
      .insertInto('region_waitlist_entries')
      .values({
        consent_notice_version: input.consentNoticeVersion,
        consented_at: now,
        country_code: input.countryCode?.trim().toUpperCase() ?? null,
        created_at: now,
        email: input.email.trim().toLowerCase(),
        requested_region: requestedRegion,
        requested_region_key: requestedRegionKey,
        source: input.source,
        status: 'waiting',
        subdivision_code: input.subdivisionCode?.trim().toUpperCase() ?? null,
        updated_at: now,
        user_id: input.userId,
      })
      .onConflict((conflict) =>
        conflict.columns(['email', 'requested_region_key']).doUpdateSet({
          consent_notice_version: input.consentNoticeVersion,
          consented_at: now,
          country_code: input.countryCode?.trim().toUpperCase() ?? null,
          requested_region: requestedRegion,
          subdivision_code: input.subdivisionCode?.trim().toUpperCase() ?? null,
          updated_at: now,
          user_id: sql`COALESCE(region_waitlist_entries.user_id, excluded.user_id)`,
        }),
      )
      .executeTakeFirstOrThrow();
  }

  private assertWaitlistConsent(input: {
    consent: true;
    consentNoticeVersion: string;
  }): void {
    if (
      input.consent !== true ||
      input.consentNoticeVersion !== regionalUpdatesConsentNoticeVersion
    ) {
      throw new BadRequestException({
        code: 'REGIONAL_UPDATES_CONSENT_REQUIRED',
        message: 'Consent to regional availability emails is required.',
      });
    }
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

  updateWaitlistStatus(
    principal: AuthenticatedPrincipal,
    entryId: string,
    idempotencyKey: string,
    input: UpdateRegionWaitlistStatusDto,
  ): Promise<RegionWaitlistEntryDto> {
    return this.idempotency.execute<WaitlistEntryJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { entryId, reason: input.reason, status: input.status },
        responseCode: 200,
        scope: 'operator:region-waitlist:update-status',
      },
      async (transaction) => {
        const admin = await this.adminAuthorization.requireAdmin(
          principal,
          transaction,
        );
        const entry = await transaction
          .selectFrom('region_waitlist_entries')
          .selectAll()
          .where('id', '=', entryId)
          .forUpdate()
          .executeTakeFirst();
        if (!entry) {
          throw new NotFoundException({
            code: 'REGION_WAITLIST_ENTRY_NOT_FOUND',
            message: 'The regional waitlist entry was not found.',
          });
        }
        const transitions: Record<string, readonly string[]> = {
          closed: [],
          contacted: ['launched', 'closed'],
          launched: ['closed'],
          waiting: ['contacted', 'closed'],
        };
        if (!(transitions[entry.status] ?? []).includes(input.status)) {
          throw new ConflictException({
            code: 'REGION_WAITLIST_STATUS_TRANSITION_INVALID',
            message: 'That regional waitlist status change is not allowed.',
          });
        }
        if (
          input.status !== 'closed' &&
          (!entry.consented_at ||
            entry.consent_notice_version !==
              regionalUpdatesConsentNoticeVersion)
        ) {
          throw new ConflictException({
            code: 'REGIONAL_UPDATES_CURRENT_CONSENT_REQUIRED',
            message:
              'A current regional-updates consent record is required before outreach.',
          });
        }
        const updated = await transaction
          .updateTable('region_waitlist_entries')
          .set({ status: input.status, updated_at: new Date() })
          .where('id', '=', entryId)
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.adminAuthorization.audit(transaction, {
          action: 'region_waitlist.status_updated',
          actorUserId: admin.id,
          entityId: entryId,
          entityType: 'region_waitlist_entries',
          nextState: { status: input.status },
          previousState: { status: entry.status },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return this.mapWaitlist(updated);
      },
    );
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
        const access = await this.adminAuthorization.resolvePortalAccess(
          principal,
          transaction,
        );
        const now = new Date();
        let query = transaction
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
          .orderBy('session.started_at', 'desc');
        if (access.kind === 'gym_partner') {
          query = query.where(
            'gym.id',
            'in',
            access.assignments.map((assignment) => assignment.gymLocationId),
          );
        }
        const sessions = await query.limit(500).execute();
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
    const due = await this.database.connection
      .selectFrom('workout_sessions as session')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'session.competition_id',
      )
      .select('session.id')
      .where('session.status', '=', 'active')
      .where((expression) =>
        expression.or([
          expression('session.expires_at', '<=', now),
          sql<boolean>`${sql.ref('competition.ends_at')} + INTERVAL '15 minutes' < ${now}`,
        ]),
      )
      .execute();
    if (due.length === 0) return 0;
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
      .where('status', '=', 'active')
      .where(
        'id',
        'in',
        due.map((session) => session.id),
      )
      .returning('id')
      .execute();
    return expired.length;
  }

  private async resolveQrGymPresence(
    transaction: Transaction<Database>,
    request: GymScanRequestDto,
  ): Promise<GymPresenceContext | null> {
    if (!request.credential) return null;

    const resolved = await transaction
      .selectFrom('gym_qr_credentials as credential')
      .innerJoin('gym_locations as gym', 'gym.id', 'credential.gym_location_id')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'credential.competition_id',
      )
      .innerJoin('competition_gym_locations as assignment', (join) =>
        join
          .onRef('assignment.competition_id', '=', 'competition.id')
          .onRef('assignment.gym_location_id', '=', 'gym.id'),
      )
      .innerJoin(
        'region_policies as region',
        'region.id',
        'gym.region_policy_id',
      )
      .select([
        'credential.competition_id',
        'credential.credential_version',
        'gym.active as gym_active',
        'gym.id as gym_id',
        'gym.name as gym_name',
        sql<number>`LEAST(${sql.ref('gym.radius_meters')}, 75)`.as(
          'radius_meters',
        ),
        'region.timezone',
        sql<number>`ST_Distance(
          ${sql.ref('gym.coordinates')},
          ST_SetSRID(ST_MakePoint(${request.longitude}, ${request.latitude}), 4326)::geography
        )`.as('distance_meters'),
      ])
      .where('credential.token_hash', '=', hashOpaqueValue(request.credential))
      .where('credential.status', '=', 'active')
      .where('credential.expires_at', '>', new Date())
      .where('competition.deleted_at', 'is', null)
      .where('competition.ends_at', '>', new Date())
      .where('gym.deleted_at', 'is', null)
      .whereRef('competition.region_policy_id', '=', 'gym.region_policy_id')
      .where('region.competition_enabled', '=', true)
      .where('region.deleted_at', 'is', null)
      .executeTakeFirst();

    if (!resolved?.competition_id) return null;
    return {
      ...resolved,
      competition_id: resolved.competition_id,
    };
  }

  private async resolveEnrolledGymPresence(
    transaction: Transaction<Database>,
    userId: string,
    request: GymScanRequestDto,
  ): Promise<GymPresenceContext | null> {
    if (!request.competitionId) return null;

    const resolved = await transaction
      .selectFrom('competition_enrollments as enrollment')
      .innerJoin('gym_locations as gym', 'gym.id', 'enrollment.gym_location_id')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'enrollment.competition_id',
      )
      .innerJoin(
        'region_policies as region',
        'region.id',
        'gym.region_policy_id',
      )
      .innerJoin('competition_gym_locations as assignment', (join) =>
        join
          .onRef('assignment.competition_id', '=', 'enrollment.competition_id')
          .onRef('assignment.gym_location_id', '=', 'gym.id'),
      )
      .select([
        'enrollment.competition_id',
        'enrollment.gym_credential_version as credential_version',
        'gym.active as gym_active',
        'gym.id as gym_id',
        'gym.name as gym_name',
        sql<number>`LEAST(${sql.ref('gym.radius_meters')}, 75)`.as(
          'radius_meters',
        ),
        'region.timezone',
        sql<number>`ST_Distance(
          ${sql.ref('gym.coordinates')},
          ST_SetSRID(ST_MakePoint(${request.longitude}, ${request.latitude}), 4326)::geography
        )`.as('distance_meters'),
      ])
      .where('enrollment.competition_id', '=', request.competitionId)
      .where('enrollment.user_id', '=', userId)
      .where('enrollment.status', '=', 'active')
      .where('competition.deleted_at', 'is', null)
      .where('gym.active', '=', true)
      .where('gym.deleted_at', 'is', null)
      .whereRef('competition.region_policy_id', '=', 'gym.region_policy_id')
      .where('region.competition_enabled', '=', true)
      .where('region.deleted_at', 'is', null)
      .executeTakeFirst();

    if (!resolved || resolved.credential_version === null) return null;
    return {
      ...resolved,
      credential_version: resolved.credential_version,
    };
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
      .select([
        sql<number | null>`(
          SELECT MAX(credential.credential_version)::integer
          FROM gym_qr_credentials AS credential
          WHERE credential.gym_location_id = gym.id
            AND credential.status = 'active'
            AND credential.expires_at > CURRENT_TIMESTAMP
        )`.as('active_credential_version'),
        sql<
          Array<{
            competitionId: string;
            credentialVersion: number;
            expiresAt: string;
          }>
        >`COALESCE((
          SELECT json_agg(
            json_build_object(
              'competitionId', credential.competition_id,
              'credentialVersion', credential.credential_version,
              'expiresAt', credential.expires_at
            )
            ORDER BY credential.credential_version DESC
          )
          FROM gym_qr_credentials AS credential
          WHERE credential.gym_location_id = gym.id
            AND credential.status = 'active'
            AND credential.competition_id IS NOT NULL
            AND credential.expires_at > CURRENT_TIMESTAMP
        ), '[]'::json)`.as('active_qr_credentials'),
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
      ])
      .where('gym.deleted_at', 'is', null);
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
    active_qr_credentials: Array<{
      competitionId: string;
      credentialVersion: number;
      expiresAt: string;
    }>;
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
      activeQrCredentials: gym.active_qr_credentials,
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
    consent_notice_version: string | null;
    consented_at: Date | null;
    created_at: Date;
    email: string;
    id: string;
    requested_region: string;
    source: string;
    status: string;
  }): WaitlistEntryJson {
    return {
      consentNoticeVersion: entry.consent_notice_version,
      consentedAt: entry.consented_at?.toISOString() ?? null,
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
    competition: {
      ends_at: Date;
      id: string;
      name: string;
      registration_opens_at: Date;
      region_name: string;
      starts_at: Date;
      timezone: string;
    },
    qrPayload: string,
    credentialVersion: number,
    reward: PosterReward | null,
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
    const escapeXml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
    const safeGymName = escapeXml(gymName);
    const safeContestName = escapeXml(competition.name);
    const safeContestDisplayName = escapeXml(
      competition.name.length > 34
        ? `${competition.name.slice(0, 31)}...`
        : competition.name,
    );
    const truncatePosterLine = (value: string, maximumLength: number) =>
      value.length > maximumLength
        ? `${value.slice(0, maximumLength - 3).trimEnd()}...`
        : value;
    const sponsorLine = reward
      ? `SPONSORED BY ${reward.sponsorName.toUpperCase()}`
      : 'SPONSOR TO BE ANNOUNCED';
    const rewardLine = reward
      ? `${reward.title.toUpperCase()}  |  ${reward.inventoryTotal} ${reward.inventoryTotal === 1 ? 'WINNER' : 'WINNERS'}`
      : 'REWARD TO BE ANNOUNCED';
    const safeSponsorLine = escapeXml(truncatePosterLine(sponsorLine, 58));
    const safeRewardLine = escapeXml(truncatePosterLine(rewardLine, 62));
    const safeRegionName = escapeXml(competition.region_name.toUpperCase());
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      day: 'numeric',
      month: 'short',
      timeZone: competition.timezone,
      year: 'numeric',
    });
    const registrationDate = dateFormatter
      .format(competition.registration_opens_at)
      .toUpperCase();
    const contestStarts = dateFormatter
      .format(competition.starts_at)
      .toUpperCase();
    const contestEnds = dateFormatter.format(competition.ends_at).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" role="img" aria-label="${safeContestName} QR poster for ${safeGymName}">
  <title>${safeContestName} at ${safeGymName}</title>
  <desc>This poster is valid only for ${safeContestName}. ${safeSponsorLine}. ${safeRewardLine}. Scan once to join and select this gym. Workout start and finish use fresh location checks.</desc>
  <rect width="1000" height="1400" fill="#05090b"/>
  <rect x="24" y="24" width="952" height="1352" rx="32" fill="none" stroke="#173A46" stroke-width="3"/>

  <!-- Centered cyan/pink/cyan GoGymGo wordmark. -->
  <g role="img" aria-label="GoGymGo logo">
    <text x="500" y="124" text-anchor="middle" font-family="Orbitron, Arial, sans-serif" font-size="70" font-weight="700" letter-spacing="2"><tspan fill="#34E5E8">GO</tspan><tspan fill="#FF2D9B">GYM</tspan><tspan fill="#34E5E8">GO</tspan></text>
  </g>

  <text x="500" y="184" text-anchor="middle" fill="#FFE066" font-family="Orbitron, Arial, sans-serif" font-size="44" font-weight="700">${safeContestDisplayName}</text>
  <text x="500" y="226" text-anchor="middle" fill="#9FF3F5" font-family="Share Tech Mono, monospace" font-size="22" letter-spacing="2">${safeSponsorLine}</text>
  <text x="500" y="270" text-anchor="middle" fill="#FF2D9B" font-family="Orbitron, Arial, sans-serif" font-size="27" font-weight="700">${safeRewardLine}</text>
  <text x="500" y="317" text-anchor="middle" fill="#E9F7F8" font-family="Orbitron, Arial, sans-serif" font-size="29" font-weight="700">SCAN THE QR CODE TO JOIN</text>

  <rect x="160" y="345" width="680" height="680" rx="34" fill="#fff"/>
  <svg x="190" y="375" width="620" height="620" viewBox="${qrViewBox}" shape-rendering="crispEdges" aria-label="Scan to open ${safeContestName}">
    ${qrBody}
  </svg>

  <text x="500" y="1084" text-anchor="middle" fill="#E9F7F8" font-family="Orbitron, Arial, sans-serif" font-size="38" font-weight="700">${safeGymName}</text>
  <text x="500" y="1130" text-anchor="middle" fill="#34E5E8" font-family="Share Tech Mono, monospace" font-size="21" letter-spacing="1">SCAN ONCE  &gt;  LOCATION IN  &gt;  TRAIN 30+ MIN  &gt;  LOCATION OUT</text>
  <line x1="100" y1="1165" x2="900" y2="1165" stroke="#173A46" stroke-width="2"/>

  <text x="500" y="1208" text-anchor="middle" fill="#E9F7F8" font-family="Share Tech Mono, monospace" font-size="19">REGISTRATION ${registrationDate}  |  CONTEST ${contestStarts} - ${contestEnds}</text>
  <text x="500" y="1248" text-anchor="middle" fill="#4DFF88" font-family="Share Tech Mono, monospace" font-size="19">${safeRegionName}  |  FREE TO ENTER  |  NO PURCHASE REQUIRED</text>
  <text x="500" y="1288" text-anchor="middle" fill="#E9F7F8" font-family="Share Tech Mono, monospace" font-size="19">Choose a 1-7 day weekly goal. Complete it to earn Prize Draw Entries.</text>
  <text x="500" y="1324" text-anchor="middle" fill="#96AAB0" font-family="Share Tech Mono, monospace" font-size="16">Location access is required. Entries improve odds but do not guarantee the reward.</text>
  <text x="500" y="1358" text-anchor="middle" fill="#9FF3F5" font-family="Share Tech Mono, monospace" font-size="16">Official Rules and eligibility apply - GOGYMGO.COM</text>
  <text x="950" y="1358" text-anchor="end" fill="#607781" font-family="monospace" font-size="11">POSTER V${credentialVersion}</text>
</svg>`;
  }

  private async getPosterReward(
    transaction: Transaction<Database>,
    competitionId: string,
  ): Promise<PosterReward | null> {
    const reward = await transaction
      .selectFrom('reward_catalog_items')
      .select(['inventory_total', 'sponsor_name', 'title'])
      .where('competition_id', '=', competitionId)
      .where('status', '=', 'published')
      .where('deleted_at', 'is', null)
      .orderBy('display_order')
      .orderBy('created_at')
      .executeTakeFirst();

    return reward
      ? {
          inventoryTotal: reward.inventory_total,
          sponsorName: reward.sponsor_name,
          title: reward.title,
        }
      : null;
  }
}

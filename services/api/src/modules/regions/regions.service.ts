import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql } from 'kysely';
import type { JsonObject } from '../../database/database.types';
import { DatabaseService } from '../../database/database.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CreateRegionVerificationDto,
  CurrentRegionVerificationResponseDto,
  RegionPolicyResponseDto,
  RegionVerificationResponseDto,
} from './dto/region.dto';
import { buildRegionEvidence } from './region-evidence';
import { currentRegionVerificationPredicate } from './current-region-verification';

interface RegionVerificationJson extends JsonObject {
  createdAt: string;
  expiresAt: string;
  id: string;
  jurisdictionCode: string;
  method: 'device_location';
  policyVersion: string;
  regionCode: string;
  regionName: string;
  regionPolicyId: string;
  reviewedAt: string;
  status: 'approved';
  timezone: string;
}

const regionVerificationValidityMilliseconds = 30 * 24 * 60 * 60 * 1_000;
const maximumLocationAgeMilliseconds = 30_000;
const maximumLocationFutureSkewMilliseconds = 5_000;
const maximumLocationAccuracyMeters = 50;

@Injectable()
export class RegionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  async listRegions(): Promise<RegionPolicyResponseDto[]> {
    const now = new Date();
    const policies = await this.database.connection
      .selectFrom('region_policies')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('competition_enabled', '=', true)
      .where('valid_from', '<=', now)
      .where((expression) =>
        expression.or([
          expression('valid_to', 'is', null),
          expression('valid_to', '>', now),
        ]),
      )
      .orderBy('country_code')
      .orderBy('subdivision_code')
      .orderBy('metro_name')
      .execute();

    return policies.map((policy) => ({
      boundaryVersion: policy.boundary_version,
      code: policy.code,
      competitionEnabled: policy.competition_enabled,
      countryCode: policy.country_code,
      currency: policy.currency,
      id: policy.id,
      languageCodes: policy.language_codes,
      metroName: policy.metro_name,
      minimumAge: policy.minimum_age,
      policyVersion: policy.policy_version,
      subdivisionCode: policy.subdivision_code,
      timezone: policy.timezone,
      validFrom: policy.valid_from.toISOString(),
      validTo: policy.valid_to?.toISOString() ?? null,
    }));
  }

  async getCurrentVerification(
    principal: AuthenticatedPrincipal,
    regionCode?: string,
  ): Promise<CurrentRegionVerificationResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        let query = transaction
          .selectFrom('region_verifications as verification')
          .innerJoin(
            'region_policies as region',
            'region.id',
            'verification.region_policy_id',
          )
          .select([
            'verification.created_at',
            'verification.expires_at',
            'verification.id',
            'verification.method',
            'verification.policy_version',
            'verification.region_policy_id',
            'verification.status',
            'verification.verified_at',
            'region.code as region_code',
            'region.country_code',
            'region.metro_name as region_name',
            'region.subdivision_code',
            'region.timezone',
          ])
          .where('verification.user_id', '=', user.id)
          .where(
            currentRegionVerificationPredicate('verification', 'region', now),
          );

        if (regionCode) {
          query = query.where('region.code', '=', regionCode);
        }
        if (user.pilot_onboarding_reset_at) {
          query = query.where(
            'verification.created_at',
            '>',
            user.pilot_onboarding_reset_at,
          );
        }

        const verification = await query
          .orderBy('verification.created_at', 'desc')
          .executeTakeFirst();

        if (!verification) {
          return null;
        }

        return {
          createdAt: verification.created_at.toISOString(),
          expiresAt: verification.expires_at!.toISOString(),
          id: verification.id,
          jurisdictionCode: `${verification.country_code}-${verification.subdivision_code}`,
          method: 'device_location',
          policyVersion: verification.policy_version,
          regionCode: verification.region_code,
          regionName: verification.region_name,
          regionPolicyId: verification.region_policy_id,
          reviewedAt: verification.verified_at!.toISOString(),
          status: 'approved',
          timezone: verification.timezone,
        };
      });
  }

  async createVerification(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    request: CreateRegionVerificationDto,
  ): Promise<RegionVerificationResponseDto> {
    const idempotencyRequest: JsonObject = {
      accuracyMeters: request.accuracyMeters,
      latitude: request.latitude,
      longitude: request.longitude,
      method: request.method,
      observedAt: request.observedAt,
    };
    const result = await this.idempotency.execute<RegionVerificationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: idempotencyRequest,
        responseCode: 201,
        scope: 'region-verifications:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const observedAt = new Date(request.observedAt);
        if (
          !Number.isFinite(request.accuracyMeters) ||
          request.accuracyMeters < 0 ||
          request.accuracyMeters > maximumLocationAccuracyMeters
        ) {
          throw new UnprocessableEntityException({
            code: 'REGION_LOCATION_ACCURACY_INSUFFICIENT',
            message: 'A more accurate location reading is required.',
          });
        }
        if (
          observedAt.getTime() >
          now.getTime() + maximumLocationFutureSkewMilliseconds
        ) {
          throw new UnprocessableEntityException({
            code: 'REGION_LOCATION_TIMESTAMP_INVALID',
            message: 'The location reading time could not be verified.',
          });
        }
        if (
          now.getTime() - observedAt.getTime() >
          maximumLocationAgeMilliseconds
        ) {
          throw new UnprocessableEntityException({
            code: 'REGION_LOCATION_STALE',
            message: 'A fresh location reading is required.',
          });
        }
        const activePolicies = await transaction
          .selectFrom('region_policies as policy')
          .select([
            'policy.boundary_version',
            'policy.code',
            'policy.country_code',
            'policy.id',
            'policy.metro_name',
            'policy.policy_version',
            'policy.subdivision_code',
            'policy.timezone',
            'policy.valid_to',
            sql<boolean>`ST_Covers(
              ${sql.ref('policy.boundary')}::geometry,
              ST_SetSRID(
                ST_MakePoint(${request.longitude}, ${request.latitude}),
                4326
              )
            )`.as('contains_location'),
          ])
          .where('policy.deleted_at', 'is', null)
          .where('policy.competition_enabled', '=', true)
          .where('policy.valid_from', '<=', now)
          .where((expression) =>
            expression.or([
              expression('policy.valid_to', 'is', null),
              expression('policy.valid_to', '>', now),
            ]),
          )
          .execute();
        if (activePolicies.length === 0) {
          throw new ServiceUnavailableException({
            code: 'REGION_VERIFICATION_UNAVAILABLE',
            message: 'GoGymGo region verification is temporarily unavailable.',
          });
        }
        const policies = activePolicies.filter(
          (policy) => policy.contains_location,
        );
        if (policies.length === 0) {
          throw new BadRequestException({
            code: 'LOCATION_OUTSIDE_SUPPORTED_REGION',
            message:
              'Your current location is outside an active GoGymGo competition region.',
          });
        }
        if (policies.length > 1) {
          throw new ConflictException({
            code: 'REGION_BOUNDARY_CONFIGURATION_CONFLICT',
            message:
              'This location matches more than one active competition region.',
          });
        }
        const policy = policies[0];
        let expiresAt = new Date(
          now.getTime() + regionVerificationValidityMilliseconds,
        );
        if (policy.valid_to && policy.valid_to < expiresAt) {
          expiresAt = policy.valid_to;
        }

        const verification = await transaction
          .insertInto('region_verifications')
          .values({
            created_at: now,
            evidence_metadata: buildRegionEvidence(policy.boundary_version),
            expires_at: expiresAt,
            method: request.method,
            policy_version: policy.policy_version,
            region_policy_id: policy.id,
            status: 'approved',
            user_id: user.id,
            verified_at: now,
          })
          .returning([
            'created_at',
            'expires_at',
            'id',
            'method',
            'policy_version',
            'region_policy_id',
            'status',
            'verified_at',
          ])
          .executeTakeFirstOrThrow();

        return {
          createdAt: verification.created_at.toISOString(),
          expiresAt: verification.expires_at?.toISOString() ?? '',
          id: verification.id,
          jurisdictionCode: `${policy.country_code}-${policy.subdivision_code}`,
          method: verification.method as 'device_location',
          policyVersion: verification.policy_version,
          regionCode: policy.code,
          regionName: policy.metro_name,
          regionPolicyId: verification.region_policy_id,
          reviewedAt: verification.verified_at?.toISOString() ?? '',
          status: 'approved',
          timezone: policy.timezone,
        };
      },
    );

    return {
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      id: result.id,
      jurisdictionCode: result.jurisdictionCode,
      method: result.method,
      policyVersion: result.policyVersion,
      regionCode: result.regionCode,
      regionName: result.regionName,
      regionPolicyId: result.regionPolicyId,
      reviewedAt: result.reviewedAt,
      status: result.status,
      timezone: result.timezone,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
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

interface RegionVerificationJson extends JsonObject {
  createdAt: string;
  id: string;
  method: 'device_location' | 'postal_code';
  policyVersion: string;
  regionPolicyId: string;
  status: 'pending';
}

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
      payoutEnabled: policy.payout_enabled,
      policyVersion: policy.policy_version,
      subdivisionCode: policy.subdivision_code,
      timezone: policy.timezone,
      validFrom: policy.valid_from.toISOString(),
      validTo: policy.valid_to?.toISOString() ?? null,
    }));
  }

  async getCurrentVerification(
    principal: AuthenticatedPrincipal,
    regionCode: string,
  ): Promise<CurrentRegionVerificationResponseDto | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const verification = await transaction
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
            'region.metro_name as region_name',
          ])
          .where('verification.user_id', '=', user.id)
          .where('region.code', '=', regionCode)
          .orderBy('verification.created_at', 'desc')
          .executeTakeFirst();

        if (!verification) {
          return null;
        }
        const status =
          verification.status === 'approved' &&
          verification.expires_at !== null &&
          verification.expires_at <= new Date()
            ? 'expired'
            : verification.status;

        return {
          createdAt: verification.created_at.toISOString(),
          expiresAt: verification.expires_at?.toISOString() ?? null,
          id: verification.id,
          method: verification.method,
          policyVersion: verification.policy_version,
          regionCode: verification.region_code,
          regionName: verification.region_name,
          regionPolicyId: verification.region_policy_id,
          reviewedAt: verification.verified_at?.toISOString() ?? null,
          status,
        };
      });
  }

  async createVerification(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    request: CreateRegionVerificationDto,
  ): Promise<RegionVerificationResponseDto> {
    const idempotencyRequest: JsonObject = {
      latitude: request.latitude ?? null,
      longitude: request.longitude ?? null,
      method: request.method,
      postalCode: request.postalCode ?? null,
      regionPolicyId: request.regionPolicyId,
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
        const policy = await transaction
          .selectFrom('region_policies')
          .selectAll()
          .where('id', '=', request.regionPolicyId)
          .where('valid_from', '<=', now)
          .where((expression) =>
            expression.or([
              expression('valid_to', 'is', null),
              expression('valid_to', '>', now),
            ]),
          )
          .executeTakeFirst();
        if (!policy) {
          throw new NotFoundException({
            code: 'REGION_POLICY_NOT_FOUND',
            message: 'The requested active region policy was not found.',
          });
        }

        const verification = await transaction
          .insertInto('region_verifications')
          .values({
            created_at: now,
            evidence_metadata: buildRegionEvidence(
              request,
              policy.country_code,
            ),
            method: request.method,
            policy_version: policy.policy_version,
            region_policy_id: policy.id,
            status: 'pending',
            user_id: user.id,
          })
          .returning([
            'created_at',
            'id',
            'method',
            'policy_version',
            'region_policy_id',
            'status',
          ])
          .executeTakeFirstOrThrow();

        return {
          createdAt: verification.created_at.toISOString(),
          id: verification.id,
          method: verification.method as 'device_location' | 'postal_code',
          policyVersion: verification.policy_version,
          regionPolicyId: verification.region_policy_id,
          status: 'pending',
        };
      },
    );

    return {
      createdAt: result.createdAt,
      id: result.id,
      method: result.method,
      policyVersion: result.policyVersion,
      regionPolicyId: result.regionPolicyId,
      status: result.status,
    };
  }
}

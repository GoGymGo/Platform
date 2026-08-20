import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { canDeleteRegionPolicy } from './admin-deletion-policy';
import {
  assertTimezone,
  parseMultiPolygon,
} from './admin-configuration.validation';
import { AdminAuthorizationService } from './admin-authorization.service';
import {
  RegionPolicyStatusAction,
  type AdminDeletedEntityResponseDto,
  type AdminEntityResponseDto,
  type AdminRegionPolicyResponseDto,
  type CreateRegionPolicyDto,
  type DeleteVersionedAdminEntityDto,
  type RegionPolicyStatusActionDto,
} from './dto/admin-configuration.dto';

interface RegionPolicyJson extends JsonObject {
  code: string;
  competitionEnabled: boolean;
  id: string;
  policyVersion: string;
  version: number;
}

interface RegionPolicyStatusJson extends JsonObject {
  id: string;
  status: 'disabled' | 'enabled';
  version: number;
}

interface DeletedRegionJson extends JsonObject {
  id: string;
  status: 'deleted';
}

@Injectable()
export class AdminRegionConfigurationService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly idempotency: IdempotencyService,
  ) {}

  create(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateRegionPolicyDto,
  ): Promise<AdminRegionPolicyResponseDto> {
    const boundary = parseMultiPolygon(input.boundary);
    const geometrySha256 = createHash('sha256')
      .update(JSON.stringify(boundary))
      .digest('hex');
    assertTimezone(input.timezone);
    const validFrom = new Date(input.validFrom);
    const validTo = input.validTo ? new Date(input.validTo) : null;
    if (validTo && validTo <= validFrom) {
      throw new BadRequestException({
        code: 'REGION_VALIDITY_WINDOW_INVALID',
        message: 'The region valid-to time must be later than valid-from.',
      });
    }

    return this.idempotency.execute<RegionPolicyJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope: 'admin-region-policies:create',
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.code}, 0))`.execute(
          transaction,
        );
        const duplicateVersion = await transaction
          .selectFrom('region_policies')
          .select('id')
          .where('code', '=', input.code)
          .where('policy_version', '=', input.policyVersion)
          .executeTakeFirst();
        if (duplicateVersion) {
          throw new ConflictException({
            code: 'REGION_POLICY_VERSION_EXISTS',
            message: 'This region policy version already exists.',
          });
        }

        const upperBound = validTo ?? new Date('9999-12-31T23:59:59.999Z');
        const overlappingVersion = await transaction
          .selectFrom('region_policies')
          .select('id')
          .where('code', '=', input.code)
          .where('valid_from', '<', upperBound)
          .where((expression) =>
            expression.or([
              expression('valid_to', 'is', null),
              expression('valid_to', '>', validFrom),
            ]),
          )
          .executeTakeFirst();
        if (overlappingVersion) {
          throw new ConflictException({
            code: 'REGION_POLICY_VALIDITY_OVERLAPS',
            message: 'Region policy validity windows cannot overlap.',
          });
        }

        const policy = await transaction
          .insertInto('region_policies')
          .values({
            boundary: sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(
              boundary,
            )}), 4326))::geography`,
            boundary_version: input.boundaryVersion,
            code: input.code,
            competition_enabled: input.competitionEnabled,
            country_code: input.countryCode,
            created_at: new Date(),
            currency: input.currency,
            language_codes: input.languageCodes,
            metro_name: input.metroName.trim(),
            minimum_age: input.minimumAge,
            policy_version: input.policyVersion,
            subdivision_code: input.subdivisionCode,
            timezone: input.timezone,
            valid_from: validFrom,
            valid_to: validTo,
          })
          .returning([
            'code',
            'competition_enabled',
            'configuration_version',
            'id',
            'policy_version',
          ])
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'region_policy.created',
          actorUserId: admin.id,
          entityId: policy.id,
          entityType: 'region_policies',
          nextState: {
            boundaryVersion: input.boundaryVersion,
            code: policy.code,
            competitionEnabled: input.competitionEnabled,
            geometrySha256,
            policyVersion: policy.policy_version,
            validFrom: input.validFrom,
            validTo: input.validTo ?? null,
          },
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          code: policy.code,
          competitionEnabled: policy.competition_enabled,
          id: policy.id,
          policyVersion: policy.policy_version,
          version: policy.configuration_version,
        };
      },
    );
  }

  changeStatus(
    principal: AuthenticatedPrincipal,
    regionPolicyId: string,
    idempotencyKey: string,
    input: RegionPolicyStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.idempotency.execute<RegionPolicyStatusJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, regionPolicyId },
        scope: `admin-region-policies:${regionPolicyId}:status`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const region = await transaction
          .selectFrom('region_policies')
          .selectAll()
          .where('id', '=', regionPolicyId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!region) {
          throw new NotFoundException({
            code: 'REGION_POLICY_NOT_FOUND',
            message: 'The region policy was not found.',
          });
        }
        this.assertVersion(region.configuration_version, input.expectedVersion);
        const shouldEnable = input.action === RegionPolicyStatusAction.ENABLE;
        if (region.competition_enabled === shouldEnable) {
          throw new ConflictException({
            code: 'REGION_POLICY_STATUS_UNCHANGED',
            message: `The region policy is already ${shouldEnable ? 'enabled' : 'disabled'}.`,
          });
        }
        const now = new Date();
        if (
          shouldEnable &&
          region.valid_to !== null &&
          region.valid_to <= now
        ) {
          throw new ConflictException({
            code: 'REGION_POLICY_EXPIRED',
            message: 'An expired region policy cannot be enabled.',
          });
        }
        if (!shouldEnable) {
          const liveCompetition = await transaction
            .selectFrom('competitions')
            .select('id')
            .where('region_policy_id', '=', regionPolicyId)
            .where('status', 'in', ['registration', 'active'])
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
          if (liveCompetition) {
            throw new ConflictException({
              code: 'REGION_POLICY_DISABLE_HAS_LIVE_COMPETITION',
              message:
                'Cancel or settle live competitions before disabling their region policy.',
            });
          }
        }

        const updated = await transaction
          .updateTable('region_policies')
          .set({
            competition_enabled: shouldEnable,
            configuration_version: sql<number>`configuration_version + 1`,
          })
          .where('id', '=', regionPolicyId)
          .where('configuration_version', '=', input.expectedVersion)
          .returning(['configuration_version', 'id'])
          .executeTakeFirst();
        if (!updated) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: shouldEnable
            ? 'region_policy.enabled'
            : 'region_policy.disabled',
          actorUserId: admin.id,
          entityId: regionPolicyId,
          entityType: 'region_policies',
          nextState: {
            competitionEnabled: shouldEnable,
            version: updated.configuration_version,
          },
          previousState: {
            competitionEnabled: region.competition_enabled,
            version: region.configuration_version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          id: updated.id,
          status: shouldEnable ? 'enabled' : 'disabled',
          version: updated.configuration_version,
        };
      },
    );
  }

  delete(
    principal: AuthenticatedPrincipal,
    regionPolicyId: string,
    idempotencyKey: string,
    input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.idempotency.execute<DeletedRegionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, regionPolicyId },
        scope: `admin-region-policies:${regionPolicyId}:delete`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const region = await transaction
          .selectFrom('region_policies')
          .selectAll()
          .where('id', '=', regionPolicyId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!region) {
          throw new NotFoundException({
            code: 'REGION_POLICY_NOT_FOUND',
            message: 'The region policy was not found.',
          });
        }
        this.assertVersion(region.configuration_version, input.expectedVersion);
        const now = new Date();
        if (
          !canDeleteRegionPolicy({
            competitionEnabled: region.competition_enabled,
            now,
            validTo: region.valid_to,
          })
        ) {
          throw new ConflictException({
            code: 'REGION_POLICY_DELETE_REQUIRES_RETIRED',
            message:
              'Only disabled or expired regional policies can be deleted from the dashboard.',
          });
        }
        const [competition, gym] = await Promise.all([
          transaction
            .selectFrom('competitions')
            .select('id')
            .where('region_policy_id', '=', regionPolicyId)
            .where('deleted_at', 'is', null)
            .executeTakeFirst(),
          transaction
            .selectFrom('gym_locations')
            .select('id')
            .where('region_policy_id', '=', regionPolicyId)
            .where('deleted_at', 'is', null)
            .executeTakeFirst(),
        ]);
        if (competition || gym) {
          throw new ConflictException({
            code: 'REGION_POLICY_DELETE_HAS_DEPENDENCIES',
            message:
              "Delete the region's retired contests and inactive gyms before deleting this policy.",
          });
        }

        const deleted = await transaction
          .updateTable('region_policies')
          .set({
            configuration_version: sql<number>`configuration_version + 1`,
            deleted_at: now,
          })
          .where('id', '=', regionPolicyId)
          .where('configuration_version', '=', input.expectedVersion)
          .where('deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!deleted) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: 'region_policy.deleted',
          actorUserId: admin.id,
          entityId: regionPolicyId,
          entityType: 'region_policies',
          nextState: { deletedAt: now.toISOString(), status: 'deleted' },
          previousState: {
            code: region.code,
            competitionEnabled: region.competition_enabled,
            policyVersion: region.policy_version,
            version: region.configuration_version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { id: deleted.id, status: 'deleted' };
      },
    );
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw this.versionConflict();
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'REGION_POLICY_VERSION_CONFLICT',
      message: 'The region policy changed; reload it before retrying.',
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  assertTimezone,
  parseMultiPolygon,
} from './admin-configuration.validation';
import { AdminAuthorizationService } from './admin-authorization.service';
import type {
  AdminRegionPolicyResponseDto,
  CreateRegionPolicyDto,
} from './dto/admin-configuration.dto';

interface RegionPolicyJson extends JsonObject {
  code: string;
  id: string;
  policyVersion: string;
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
          .returning(['code', 'id', 'policy_version'])
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'region_policy.created',
          actorUserId: admin.id,
          entityId: policy.id,
          entityType: 'region_policies',
          nextState: {
            code: policy.code,
            competitionEnabled: input.competitionEnabled,
            policyVersion: policy.policy_version,
          },
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          code: policy.code,
          id: policy.id,
          policyVersion: policy.policy_version,
        };
      },
    );
  }
}

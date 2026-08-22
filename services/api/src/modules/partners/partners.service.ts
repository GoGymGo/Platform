import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { stableJson } from '../../common/idempotency/stable-json';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type {
  Database,
  JsonObject,
  PartnerApplicationStatus,
  PartnerApplicationType,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CreatorApplicationDto,
  GymApplicationDto,
  OperatorPartnerApplicationDto,
  PartnerApplicationResponseDto,
  SponsorApplicationDto,
} from './dto/partner-application.dto';

type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

interface PartnerApplicationJson extends JsonObject {
  applicationType: PartnerApplicationType;
  id: string;
  outcome: 'created' | 'duplicate' | 'screened';
  retentionExpiresAt: string | null;
  status: PartnerApplicationStatus;
  submittedAt: string;
}

const publicPartnerActor = 'public-partner-intake-v1';

@Injectable()
export class PartnersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
    private readonly adminAuthorization: AdminAuthorizationService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async listApplications(
    principal: AuthenticatedPrincipal,
  ): Promise<OperatorPartnerApplicationDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.adminAuthorization.requireAdmin(principal, transaction);
        const applications = await transaction
          .selectFrom('partner_applications')
          .select([
            'application_type',
            'contact_email',
            'created_at',
            'id',
            'region',
            'retention_expires_at',
            'review_version',
            'status',
          ])
          .orderBy('created_at', 'desc')
          .limit(500)
          .execute();
        return applications.map((application) => ({
          applicationType: application.application_type,
          contactEmail: application.contact_email,
          id: application.id,
          region: application.region,
          retentionExpiresAt:
            application.retention_expires_at?.toISOString() ?? null,
          reviewVersion: application.review_version,
          status: application.status,
          submittedAt: application.created_at.toISOString(),
        }));
      });
  }

  async submitCreator(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreatorApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    if (!this.config.get('CREATOR_FEATURES_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException({
        code: 'CREATOR_APPLICATIONS_UNAVAILABLE',
        message: 'Creator applications are not available in this release.',
      });
    }
    const payload = {
      channelUrl: input.channelUrl.trim(),
      sampleWorkoutUrl: input.sampleWorkoutUrl.trim(),
      workoutStyle: input.workoutStyle.trim(),
    } satisfies JsonObject;
    const region = input.region.trim();
    return this.idempotency.execute<PartnerApplicationJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...payload, region },
        responseCode: 201,
        scope: 'partner-applications:creator',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        return this.insertApplication(transaction, {
          applicationType: 'creator',
          contactEmail: user.email,
          payload,
          region,
          retentionExpiresAt: null,
          userId: user.id,
        });
      },
    );
  }

  submitSponsor(
    idempotencyKey: string,
    input: SponsorApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    if (input.contactFax)
      return Promise.resolve(this.screenedReceipt('sponsor'));
    const retentionDays = this.requirePublicRetentionDays();
    const normalized = {
      applicationType: 'sponsor' as const,
      consent: true,
      contactEmail: input.contactEmail,
      payload: { companyName: input.companyName } satisfies JsonObject,
      region: input.targetRegion,
    };
    return this.idempotency.execute<PartnerApplicationJson>(
      {
        actorKey: publicPartnerActor,
        key: idempotencyKey,
        request: normalized,
        responseCode: 201,
        scope: 'partner-applications:sponsor',
      },
      (transaction) => {
        const now = new Date();
        return this.insertApplication(
          transaction,
          {
            ...normalized,
            retentionExpiresAt: this.retentionExpiry(now, retentionDays),
            userId: null,
          },
          now,
        );
      },
    );
  }

  submitGym(
    idempotencyKey: string,
    input: GymApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    if (input.contactFax) return Promise.resolve(this.screenedReceipt('gym'));
    const retentionDays = this.requirePublicRetentionDays();
    const normalized = {
      applicationType: 'gym' as const,
      consent: true,
      contactEmail: input.workEmail,
      payload: {
        gymAddress: input.gymAddress,
        gymName: input.gymName,
        managerName: input.managerName,
      } satisfies JsonObject,
      region: input.region,
    };
    return this.idempotency.execute<PartnerApplicationJson>(
      {
        actorKey: publicPartnerActor,
        key: idempotencyKey,
        request: normalized,
        responseCode: 201,
        scope: 'partner-applications:gym',
      },
      (transaction) => {
        const now = new Date();
        return this.insertApplication(
          transaction,
          {
            ...normalized,
            retentionExpiresAt: this.retentionExpiry(now, retentionDays),
            userId: null,
          },
          now,
        );
      },
    );
  }

  private async insertApplication(
    executor: DatabaseExecutor,
    input: {
      applicationType: PartnerApplicationType;
      contactEmail: string | null;
      payload: JsonObject;
      region: string;
      retentionExpiresAt: Date | null;
      userId: string | null;
    },
    now = new Date(),
  ): Promise<PartnerApplicationJson> {
    const dedupeHash = createHash('sha256')
      .update(
        stableJson({
          applicationType: input.applicationType,
          contactEmail: input.contactEmail,
          payload: input.payload,
          region: input.region,
          userId: input.userId,
        }),
      )
      .digest('hex');
    const inserted = await executor
      .insertInto('partner_applications')
      .values({
        application_type: input.applicationType,
        contact_email: input.contactEmail,
        created_at: now,
        dedupe_hash: dedupeHash,
        payload: input.payload,
        region: input.region,
        retention_expires_at: input.retentionExpiresAt,
        status: 'submitted',
        updated_at: now,
        user_id: input.userId,
      })
      .onConflict((conflict) => conflict.column('dedupe_hash').doNothing())
      .returning([
        'application_type',
        'created_at',
        'id',
        'retention_expires_at',
        'status',
      ])
      .executeTakeFirst();
    const application =
      inserted ??
      (await executor
        .selectFrom('partner_applications')
        .select([
          'application_type',
          'created_at',
          'id',
          'retention_expires_at',
          'status',
        ])
        .where('dedupe_hash', '=', dedupeHash)
        .executeTakeFirstOrThrow());

    return {
      applicationType: application.application_type,
      id: application.id,
      outcome: inserted ? 'created' : 'duplicate',
      retentionExpiresAt:
        application.retention_expires_at?.toISOString() ?? null,
      status: application.status,
      submittedAt: application.created_at.toISOString(),
    };
  }

  private requirePublicRetentionDays(): number {
    const retentionDays = this.config.get(
      'PARTNER_APPLICATION_RETENTION_DAYS',
      { infer: true },
    );
    if (!retentionDays) {
      throw new ServiceUnavailableException({
        code: 'PARTNER_APPLICATIONS_UNAVAILABLE',
        message: 'Partner applications are not available in this release.',
      });
    }
    return retentionDays;
  }

  private retentionExpiry(now: Date, retentionDays: number): Date {
    return new Date(now.getTime() + retentionDays * 86_400_000);
  }

  private screenedReceipt(
    applicationType: 'gym' | 'sponsor',
  ): PartnerApplicationJson {
    return {
      applicationType,
      id: randomUUID(),
      outcome: 'screened',
      retentionExpiresAt: null,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
  }
}

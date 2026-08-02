import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { stableJson } from '../../common/idempotency/stable-json';
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
  status: PartnerApplicationStatus;
  submittedAt: string;
}

@Injectable()
export class PartnersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
    private readonly adminAuthorization: AdminAuthorizationService,
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
            'payload',
            'region',
            'status',
          ])
          .orderBy('created_at', 'desc')
          .limit(500)
          .execute();
        return applications.map((application) => ({
          applicationType: application.application_type,
          contactEmail: application.contact_email,
          id: application.id,
          payload: application.payload,
          region: application.region,
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
          userId: user.id,
        });
      },
    );
  }

  submitSponsor(
    input: SponsorApplicationDto,
  ): Promise<PartnerApplicationResponseDto> {
    const region = input.targetRegion.trim();
    return this.insertApplication(this.database.connection, {
      applicationType: 'sponsor',
      contactEmail: input.contactEmail.trim().toLowerCase(),
      payload: { companyName: input.companyName.trim() },
      region,
      userId: null,
    });
  }

  submitGym(input: GymApplicationDto): Promise<PartnerApplicationResponseDto> {
    return this.insertApplication(this.database.connection, {
      applicationType: 'gym',
      contactEmail: input.workEmail.trim().toLowerCase(),
      payload: {
        gymAddress: input.gymAddress.trim(),
        gymName: input.gymName.trim(),
        managerName: input.managerName.trim(),
      },
      region: input.region.trim(),
      userId: null,
    });
  }

  private async insertApplication(
    executor: DatabaseExecutor,
    input: {
      applicationType: PartnerApplicationType;
      contactEmail: string | null;
      payload: JsonObject;
      region: string;
      userId: string | null;
    },
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
    const now = new Date();
    const inserted = await executor
      .insertInto('partner_applications')
      .values({
        application_type: input.applicationType,
        contact_email: input.contactEmail,
        created_at: now,
        dedupe_hash: dedupeHash,
        payload: input.payload,
        region: input.region,
        status: 'submitted',
        updated_at: now,
        user_id: input.userId,
      })
      .onConflict((conflict) => conflict.column('dedupe_hash').doNothing())
      .returning(['application_type', 'created_at', 'id', 'status'])
      .executeTakeFirst();
    const application =
      inserted ??
      (await executor
        .selectFrom('partner_applications')
        .select(['application_type', 'created_at', 'id', 'status'])
        .where('dedupe_hash', '=', dedupeHash)
        .executeTakeFirstOrThrow());

    return {
      applicationType: application.application_type,
      id: application.id,
      status: application.status,
      submittedAt: application.created_at.toISOString(),
    };
  }
}

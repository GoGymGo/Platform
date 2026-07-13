import { ConflictException, Injectable } from '@nestjs/common';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type { JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CreatePrivacyRequestDto,
  PrivacyRequestResponseDto,
} from './dto/privacy-request.dto';

interface PrivacyRequestJson extends JsonObject {
  completedAt: string | null;
  id: string;
  requestedAt: string;
  requestType: 'delete' | 'export';
  status: 'requested';
}

@Injectable()
export class PrivacyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  createRequest(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreatePrivacyRequestDto,
  ): Promise<PrivacyRequestResponseDto> {
    return this.idempotency.execute<PrivacyRequestJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          reason: input.reason?.trim() ?? null,
          requestType: input.requestType,
        },
        responseCode: 201,
        scope: 'privacy-requests:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const existing = await transaction
          .selectFrom('privacy_requests')
          .select('id')
          .where('user_id', '=', user.id)
          .where('request_type', '=', input.requestType)
          .where('status', 'in', ['requested', 'processing'])
          .executeTakeFirst();
        if (existing) {
          throw new ConflictException({
            code: 'PRIVACY_REQUEST_ALREADY_ACTIVE',
            message: 'An active request of this type already exists.',
          });
        }

        const request = await transaction
          .insertInto('privacy_requests')
          .values({
            completed_at: null,
            reason: input.reason?.trim() || null,
            request_type: input.requestType,
            requested_at: new Date(),
            result_object_key: null,
            status: 'requested',
            user_id: user.id,
          })
          .returning([
            'completed_at',
            'id',
            'request_type',
            'requested_at',
            'status',
          ])
          .executeTakeFirstOrThrow();
        return {
          completedAt: null,
          id: request.id,
          requestedAt: request.requested_at.toISOString(),
          requestType: request.request_type,
          status: 'requested',
        };
      },
    );
  }

  async listRequests(
    principal: AuthenticatedPrincipal,
  ): Promise<PrivacyRequestResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const requests = await transaction
          .selectFrom('privacy_requests')
          .select([
            'completed_at',
            'id',
            'request_type',
            'requested_at',
            'status',
          ])
          .where('user_id', '=', user.id)
          .orderBy('requested_at', 'desc')
          .execute();
        return requests.map((request) => ({
          completedAt: request.completed_at?.toISOString() ?? null,
          id: request.id,
          requestedAt: request.requested_at.toISOString(),
          requestType: request.request_type,
          status: request.status,
        }));
      });
  }
}

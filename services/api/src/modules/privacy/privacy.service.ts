import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import {
  PRIVATE_OBJECT_STORAGE,
  type PrivateObjectStorage,
} from '../storage/private-object-storage';
import {
  PrivacyRequestConfirmationDto,
  type CreatePrivacyRequestDto,
  type PrivacyCapabilitiesResponseDto,
  type PrivacyDownloadActionDto,
  type PrivacyRequestDetailResponseDto,
  type PrivacyRequestResponseDto,
} from './dto/privacy-request.dto';

interface PrivacyRequestJson extends JsonObject {
  completedAt: string | null;
  confirmedAt: string | null;
  downloadAvailable: boolean;
  exportExpiresAt: string | null;
  failureCode: string | null;
  id: string;
  requestedAt: string;
  requestType: 'delete' | 'export';
  status: 'requested';
  nextAttemptAt: string | null;
  version: number;
}

@Injectable()
export class PrivacyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
    private readonly config: ConfigService<Environment, true>,
    @Inject(PRIVATE_OBJECT_STORAGE)
    private readonly objectStorage: PrivateObjectStorage,
  ) {}

  createRequest(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreatePrivacyRequestDto,
  ): Promise<PrivacyRequestResponseDto> {
    if (!this.config.get('PRIVACY_OPERATIONS_ENABLED', { infer: true })) {
      throw new ServiceUnavailableException({
        code: 'PRIVACY_OPERATIONS_UNAVAILABLE',
        message:
          'Privacy request processing is not available in this deployment.',
      });
    }
    const confirmationCode =
      input.requestType === 'delete'
        ? PrivacyRequestConfirmationDto.DELETE_MY_ACCOUNT
        : PrivacyRequestConfirmationDto.EXPORT_MY_DATA;
    if (input.confirmation !== confirmationCode) {
      throw new ConflictException({
        code: 'PRIVACY_REQUEST_CONFIRMATION_MISMATCH',
        message: 'Confirm the selected privacy operation exactly.',
      });
    }
    return this.idempotency.execute<PrivacyRequestJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          confirmation: input.confirmation,
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
          .where('status', 'in', ['requested', 'processing'])
          .executeTakeFirst();
        if (existing) {
          throw new ConflictException({
            code: 'PRIVACY_REQUEST_ALREADY_ACTIVE',
            message: 'An active privacy request already exists.',
          });
        }

        const request = await transaction
          .insertInto('privacy_requests')
          .values({
            completed_at: null,
            confirmation_code: confirmationCode,
            confirmed_at: new Date(),
            export_expires_at: null,
            failure_code: null,
            lease_expires_at: null,
            lease_token: null,
            reason: input.reason?.trim() || null,
            request_type: input.requestType,
            requested_at: new Date(),
            result_object_key: null,
            result_deleted_at: null,
            result_sha256: null,
            status: 'requested',
            user_id: user.id,
          })
          .onConflict((conflict) => conflict.doNothing())
          .returning([
            'completed_at',
            'confirmed_at',
            'export_expires_at',
            'failure_code',
            'id',
            'request_type',
            'requested_at',
            'status',
            'version',
          ])
          .executeTakeFirst();
        if (!request) {
          throw new ConflictException({
            code: 'PRIVACY_REQUEST_ALREADY_ACTIVE',
            message: 'An active privacy request already exists.',
          });
        }
        await transaction
          .insertInto('privacy_request_events')
          .values({
            metadata: {
              confirmation: confirmationCode,
              requestType: request.request_type,
            },
            next_status: 'requested',
            previous_status: null,
            privacy_request_id: request.id,
            source: 'user_request_created',
            source_event_id: request.id,
          })
          .executeTakeFirstOrThrow();
        return {
          completedAt: null,
          confirmedAt: request.confirmed_at?.toISOString() ?? null,
          downloadAvailable: false,
          exportExpiresAt: null,
          failureCode: null,
          id: request.id,
          requestedAt: request.requested_at.toISOString(),
          requestType: request.request_type,
          status: 'requested',
          nextAttemptAt: null,
          version: request.version,
        };
      },
    );
  }

  getCapabilities(): PrivacyCapabilitiesResponseDto {
    const enabled = this.config.get('PRIVACY_OPERATIONS_ENABLED', {
      infer: true,
    });
    return {
      requestCreationAvailable: enabled,
      status: enabled ? 'enabled' : 'disabled',
    };
  }

  async getRequest(
    principal: AuthenticatedPrincipal,
    privacyRequestId: string,
  ): Promise<PrivacyRequestDetailResponseDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const request = await transaction
          .selectFrom('privacy_requests')
          .select([
            'completed_at',
            'confirmed_at',
            'export_expires_at',
            'failure_code',
            'id',
            'next_attempt_at',
            'request_type',
            'requested_at',
            'result_deleted_at',
            'result_object_key',
            'status',
            'version',
          ])
          .where('id', '=', privacyRequestId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (!request) {
          throw new NotFoundException({
            code: 'PRIVACY_REQUEST_NOT_FOUND',
            message: 'The privacy request was not found.',
          });
        }
        const events = await transaction
          .selectFrom('privacy_request_events')
          .select(['created_at', 'next_status', 'previous_status'])
          .where('privacy_request_id', '=', request.id)
          .orderBy('created_at')
          .orderBy('id')
          .execute();
        return {
          ...this.toResponse(request),
          events: events.map((event) => ({
            createdAt: event.created_at.toISOString(),
            nextStatus: event.next_status,
            previousStatus: event.previous_status,
          })),
        };
      });
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
            'confirmed_at',
            'export_expires_at',
            'failure_code',
            'id',
            'next_attempt_at',
            'request_type',
            'requested_at',
            'result_deleted_at',
            'result_object_key',
            'status',
            'version',
          ])
          .where('user_id', '=', user.id)
          .orderBy('requested_at', 'desc')
          .execute();
        return requests.map((request) => this.toResponse(request));
      });
  }

  async createDownloadAction(
    principal: AuthenticatedPrincipal,
    privacyRequestId: string,
  ): Promise<PrivacyDownloadActionDto> {
    const request = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        return transaction
          .selectFrom('privacy_requests')
          .select([
            'export_expires_at',
            'request_type',
            'result_deleted_at',
            'result_object_key',
            'status',
          ])
          .where('id', '=', privacyRequestId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
      });
    if (!request) {
      throw new NotFoundException({
        code: 'PRIVACY_EXPORT_NOT_FOUND',
        message: 'The privacy export was not found.',
      });
    }
    if (
      request.request_type !== 'export' ||
      request.status !== 'completed' ||
      !request.result_object_key ||
      !request.export_expires_at
    ) {
      throw new ConflictException({
        code: 'PRIVACY_EXPORT_NOT_READY',
        message: 'The privacy export is not ready to download.',
      });
    }

    const now = Date.now();
    if (
      request.result_deleted_at !== null ||
      request.export_expires_at.getTime() <= now
    ) {
      throw new GoneException({
        code: 'PRIVACY_EXPORT_EXPIRED',
        message: 'The privacy export has expired.',
      });
    }
    const bucket = this.config.get('PRIVACY_EXPORT_BUCKET', { infer: true });
    if (!bucket) {
      throw new ServiceUnavailableException({
        code: 'PRIVACY_EXPORT_STORAGE_UNAVAILABLE',
        message: 'Privacy export storage is unavailable.',
      });
    }
    const configuredTtl = this.config.get('PRIVACY_DOWNLOAD_URL_TTL_SECONDS', {
      infer: true,
    });
    const expiresAt = new Date(
      Math.min(
        request.export_expires_at.getTime(),
        now + configuredTtl * 1_000,
      ),
    );
    const url = await this.objectStorage.createSignedReadUrl(
      bucket,
      request.result_object_key,
      expiresAt,
    );
    return { expiresAt: expiresAt.toISOString(), url };
  }

  private toResponse(request: {
    completed_at: Date | null;
    confirmed_at: Date | null;
    export_expires_at: Date | null;
    failure_code: string | null;
    id: string;
    next_attempt_at: Date;
    requested_at: Date;
    request_type: 'delete' | 'export';
    result_object_key: string | null;
    result_deleted_at: Date | null;
    status: 'completed' | 'processing' | 'rejected' | 'requested';
    version: number;
  }): PrivacyRequestResponseDto {
    const downloadAvailable =
      request.request_type === 'export' &&
      request.status === 'completed' &&
      request.result_deleted_at === null &&
      request.result_object_key !== null &&
      request.export_expires_at !== null &&
      request.export_expires_at.getTime() > Date.now();
    return {
      completedAt: request.completed_at?.toISOString() ?? null,
      confirmedAt: request.confirmed_at?.toISOString() ?? null,
      downloadAvailable,
      exportExpiresAt: request.export_expires_at?.toISOString() ?? null,
      failureCode: request.failure_code,
      id: request.id,
      requestedAt: request.requested_at.toISOString(),
      requestType: request.request_type,
      status: request.status,
      nextAttemptAt:
        request.status === 'processing' && request.failure_code
          ? request.next_attempt_at.toISOString()
          : null,
      version: request.version,
    };
  }
}

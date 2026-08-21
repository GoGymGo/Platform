import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql, type Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import {
  PRIVATE_OBJECT_STORAGE,
  type PrivateObjectStorage,
  PrivateObjectStorageError,
} from '../storage/private-object-storage';
import { profileMediaInspectionVersion } from './profile-media-image';
import { ProfilesService } from './profiles.service';

interface MediaDecisionJson extends JsonObject {
  id: string;
  status: 'approved' | 'rejected';
}

export interface ProfileMediaReviewAction {
  contentLength: number;
  contentType: string;
  expiresAt: string;
  height: number;
  id: string;
  reviewVersion: number;
  sha256: string;
  submittedAt: string;
  url: string;
  width: number;
}

@Injectable()
export class ProfileMediaModerationService {
  private readonly bucket?: string;
  private readonly enabled: boolean;
  private readonly readTtlSeconds: number;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
    @Inject(PRIVATE_OBJECT_STORAGE)
    private readonly objectStorage: PrivateObjectStorage,
  ) {
    this.bucket = config.get('PRIVATE_CONTENT_BUCKET', { infer: true });
    this.enabled = config.get('PROFILE_MEDIA_ENABLED', { infer: true });
    this.readTtlSeconds = config.get('PROFILE_MEDIA_READ_TTL_SECONDS', {
      infer: true,
    });
  }

  async createReviewAction(mediaId: string): Promise<ProfileMediaReviewAction> {
    const bucket = this.requireBucket();
    const media = await this.database.connection
      .selectFrom('profile_media')
      .selectAll()
      .where('id', '=', mediaId)
      .where('status', '=', 'pending_review')
      .where('object_deleted_at', 'is', null)
      .where('inspection_version', '=', profileMediaInspectionVersion)
      .executeTakeFirst();
    if (
      !media ||
      media.actual_size_bytes === null ||
      !media.completed_at ||
      !media.content_sha256 ||
      media.image_height === null ||
      media.image_width === null ||
      !media.storage_generation
    ) {
      throw this.mediaNotFound();
    }
    const expiresAt = new Date(Date.now() + this.readTtlSeconds * 1_000);
    try {
      const metadata = await this.objectStorage.getObjectMetadata(
        bucket,
        media.object_key,
      );
      if (
        metadata.contentEncoding !== null ||
        metadata.contentLength !== media.actual_size_bytes ||
        metadata.contentType !== media.content_type ||
        metadata.etag !== media.storage_generation ||
        metadata.mediaId !== media.id ||
        metadata.versionId !== media.storage_version_id
      ) {
        throw new PrivateObjectStorageError('OBJECT_IDENTITY_MISMATCH');
      }
      const url = await this.objectStorage.createSignedReadUrl(
        bucket,
        media.object_key,
        expiresAt,
        {
          etag: media.storage_generation,
          versionId: media.storage_version_id,
        },
      );
      return {
        contentLength: media.actual_size_bytes,
        contentType: media.content_type,
        expiresAt: expiresAt.toISOString(),
        height: media.image_height,
        id: media.id,
        reviewVersion: media.review_version,
        sha256: media.content_sha256,
        submittedAt: media.completed_at.toISOString(),
        url,
        width: media.image_width,
      };
    } catch (error) {
      if (
        error instanceof PrivateObjectStorageError &&
        error.code === 'OBJECT_IDENTITY_MISMATCH'
      ) {
        throw new ConflictException({
          code: 'AVATAR_OBJECT_CHANGED',
          message: 'The avatar object changed after verification.',
        });
      }
      throw this.storageUnavailable();
    }
  }

  decide(input: {
    authorize?: (transaction: Transaction<Database>) => Promise<string>;
    decision: 'approved' | 'rejected';
    expectedVersion: number;
    mediaId: string;
    operatorUserId: string;
    reason: string;
    requestId: string;
  }): Promise<MediaDecisionJson> {
    this.requireBucket();
    return this.idempotency.execute<MediaDecisionJson, string | undefined>(
      {
        actorKey: `operator:${input.operatorUserId}`,
        key: input.requestId,
        request: {
          decision: input.decision,
          expectedVersion: input.expectedVersion,
          mediaId: input.mediaId,
          reason: input.reason.trim(),
        },
        scope: 'profile-media:decision',
      },
      async (transaction, authorizedOperatorId) => {
        const operatorUserId = authorizedOperatorId ?? input.operatorUserId;
        const mediaOwner = await transaction
          .selectFrom('profile_media')
          .select('user_id')
          .where('id', '=', input.mediaId)
          .executeTakeFirst();
        if (!mediaOwner) {
          throw this.mediaNotFound();
        }
        await this.profiles.ensureProfile(mediaOwner.user_id, transaction);
        const profile = await transaction
          .selectFrom('profiles')
          .selectAll()
          .where('user_id', '=', mediaOwner.user_id)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const media = await transaction
          .selectFrom('profile_media')
          .selectAll()
          .where('id', '=', input.mediaId)
          .forUpdate()
          .executeTakeFirst();
        if (!media) throw this.mediaNotFound();
        if (media.review_version !== input.expectedVersion) {
          throw new ConflictException({
            code: 'AVATAR_MEDIA_VERSION_CONFLICT',
            message: 'The avatar review changed. Refresh it before deciding.',
          });
        }
        if (media.user_id === operatorUserId) {
          throw new ForbiddenException({
            code: 'AVATAR_MEDIA_SELF_REVIEW_FORBIDDEN',
            message: 'Operators cannot review their own profile media.',
          });
        }
        if (media.status !== 'pending_review') {
          throw new ConflictException({
            code: 'AVATAR_MEDIA_ALREADY_DECIDED',
            message: 'Only pending avatar media can be decided.',
          });
        }
        if (
          media.inspection_version !== profileMediaInspectionVersion ||
          !media.content_sha256 ||
          media.image_height === null ||
          media.image_width === null ||
          !media.storage_generation
        ) {
          throw new ConflictException({
            code: 'AVATAR_MEDIA_NOT_VERIFIED',
            message: 'This avatar is not eligible for moderation.',
          });
        }
        const now = new Date();
        if (input.decision === 'approved') {
          if (
            profile.avatar_object_key &&
            profile.avatar_object_key !== media.object_key
          ) {
            await transaction
              .updateTable('profile_media')
              .set({
                review_version: sql<number>`review_version + 1`,
                status: 'superseded',
                updated_at: now,
              })
              .where('user_id', '=', media.user_id)
              .where('object_key', '=', profile.avatar_object_key)
              .where('status', '=', 'approved')
              .execute();
          }
          await transaction
            .updateTable('profiles')
            .set({
              avatar_object_key: media.object_key,
              updated_at: now,
              version: sql<number>`version + 1`,
            })
            .where('user_id', '=', media.user_id)
            .executeTakeFirstOrThrow();
        }
        const updated = await transaction
          .updateTable('profile_media')
          .set({
            decision_reason: input.reason.trim(),
            review_version: sql<number>`review_version + 1`,
            reviewed_at: now,
            reviewed_by_user_id: operatorUserId,
            status: input.decision,
            updated_at: now,
          })
          .where('id', '=', media.id)
          .where('status', '=', 'pending_review')
          .where('review_version', '=', input.expectedVersion)
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          throw new ConflictException({
            code: 'AVATAR_MEDIA_VERSION_CONFLICT',
            message: 'The avatar review changed. Refresh it before deciding.',
          });
        }
        await transaction
          .insertInto('operator_audit_events')
          .values({
            action: 'profile_media.decided',
            actor_user_id: operatorUserId,
            created_at: now,
            entity_id: media.id,
            entity_type: 'profile_media',
            next_state: {
              status: input.decision,
              version: input.expectedVersion + 1,
            },
            previous_state: {
              status: media.status,
              version: input.expectedVersion,
            },
            reason: input.reason.trim(),
            request_id: input.requestId,
          })
          .executeTakeFirstOrThrow();
        return { id: media.id, status: input.decision };
      },
      input.authorize,
    );
  }

  private mediaNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'AVATAR_MEDIA_NOT_FOUND',
      message: 'The avatar media was not found.',
    });
  }

  private requireBucket(): string {
    if (!this.enabled || !this.bucket) {
      throw new ServiceUnavailableException({
        code: 'PROFILE_MEDIA_UNAVAILABLE',
        message: 'Profile media is not available.',
      });
    }
    return this.bucket;
  }

  private storageUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'PROFILE_MEDIA_STORAGE_UNAVAILABLE',
      message: 'Profile media storage is temporarily unavailable.',
    });
  }
}

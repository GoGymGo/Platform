import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Selectable } from 'kysely';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { ProfileMediaTable } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  PRIVATE_OBJECT_STORAGE,
  type PrivateObjectStorage,
  PrivateObjectStorageError,
} from '../storage/private-object-storage';
import type {
  AvatarMediaDto,
  AvatarStateResponseDto,
  AvatarUploadCompletionResponseDto,
  CreateAvatarUploadDto,
  CreateAvatarUploadResponseDto,
  RemoveAvatarResponseDto,
} from './dto/profile-media.dto';
import { isExpectedProfileImageSignature } from './profile-media-signature';
import { ProfilesService } from './profiles.service';

@Injectable()
export class ProfileMediaService {
  private readonly bucket?: string;
  private readonly enabled: boolean;
  private readonly maxBytes: number;
  private readonly readTtlSeconds: number;
  private readonly uploadTtlSeconds: number;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly database: DatabaseService,
    private readonly profiles: ProfilesService,
    @Inject(PRIVATE_OBJECT_STORAGE)
    private readonly objectStorage: PrivateObjectStorage,
  ) {
    this.bucket = config.get('PRIVATE_CONTENT_BUCKET', { infer: true });
    this.enabled = config.get('PROFILE_MEDIA_ENABLED', { infer: true });
    this.maxBytes = config.get('PROFILE_MEDIA_MAX_BYTES', { infer: true });
    this.readTtlSeconds = config.get('PROFILE_MEDIA_READ_TTL_SECONDS', {
      infer: true,
    });
    this.uploadTtlSeconds = config.get('PROFILE_MEDIA_UPLOAD_TTL_SECONDS', {
      infer: true,
    });
  }

  async createUpload(
    principal: AuthenticatedPrincipal,
    requestKey: string,
    input: CreateAvatarUploadDto,
  ): Promise<CreateAvatarUploadResponseDto> {
    const bucket = this.requireBucket();
    if (input.contentLength > this.maxBytes) {
      throw new UnprocessableEntityException({
        code: 'AVATAR_FILE_TOO_LARGE',
        message: `Avatar media cannot exceed ${this.maxBytes} bytes.`,
      });
    }

    const media = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        await this.profiles.ensureProfile(user.id, transaction);
        const deletionRequest = await transaction
          .selectFrom('privacy_requests')
          .select('id')
          .where('user_id', '=', user.id)
          .where('request_type', '=', 'delete')
          .where('status', 'in', ['processing', 'requested'])
          .executeTakeFirst();
        if (deletionRequest) {
          throw new ConflictException({
            code: 'ACCOUNT_DELETION_IN_PROGRESS',
            message:
              'Avatar uploads are unavailable while account deletion is in progress.',
          });
        }
        const existing = await transaction
          .selectFrom('profile_media')
          .selectAll()
          .where('user_id', '=', user.id)
          .where('request_key', '=', requestKey)
          .executeTakeFirst();
        const now = new Date();
        if (existing) {
          if (
            existing.content_type !== input.contentType ||
            existing.expected_size_bytes !== input.contentLength
          ) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message:
                'This idempotency key was already used for a different avatar upload.',
            });
          }
          if (existing.status !== 'pending_upload') {
            throw new ConflictException({
              code: 'AVATAR_UPLOAD_NOT_PENDING',
              message: 'This avatar upload is no longer pending.',
            });
          }
          if (existing.expires_at.getTime() <= now.getTime()) {
            throw new ConflictException({
              code: 'AVATAR_UPLOAD_EXPIRED',
              message: 'This avatar upload action has expired.',
            });
          }
          return existing;
        }

        const pending = await transaction
          .selectFrom('profile_media')
          .select((expression) => expression.fn.countAll<number>().as('count'))
          .where('user_id', '=', user.id)
          .where('status', '=', 'pending_upload')
          .where('expires_at', '>', now)
          .executeTakeFirstOrThrow();
        if (Number(pending.count) >= 3) {
          throw new ConflictException({
            code: 'AVATAR_UPLOAD_LIMIT_REACHED',
            message:
              'Complete or wait for an existing avatar upload to expire.',
          });
        }

        const id = randomUUID();
        const expiresAt = new Date(
          now.getTime() + this.uploadTtlSeconds * 1_000,
        );
        return transaction
          .insertInto('profile_media')
          .values({
            content_type: input.contentType,
            created_at: now,
            expected_size_bytes: input.contentLength,
            expires_at: expiresAt,
            id,
            object_key: this.objectKey(user.id, id, input.contentType),
            request_key: requestKey,
            status: 'pending_upload',
            updated_at: now,
            user_id: user.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      });

    try {
      const upload = await this.objectStorage.createSignedUploadUrl({
        bucket,
        contentLength: media.expected_size_bytes,
        contentType: media.content_type,
        expiresAt: media.expires_at,
        mediaId: media.id,
        objectKey: media.object_key,
      });
      return {
        contentLength: media.expected_size_bytes,
        contentType: media.content_type,
        expiresAt: media.expires_at.toISOString(),
        id: media.id,
        status: 'pending_upload',
        upload: { headers: upload.headers, method: 'PUT', url: upload.url },
      };
    } catch {
      throw this.storageUnavailable();
    }
  }

  async completeUpload(
    principal: AuthenticatedPrincipal,
    mediaId: string,
  ): Promise<AvatarUploadCompletionResponseDto> {
    const bucket = this.requireBucket();
    const media = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const current = await transaction
          .selectFrom('profile_media')
          .selectAll()
          .where('id', '=', mediaId)
          .where('user_id', '=', user.id)
          .executeTakeFirst();
        if (!current) {
          throw this.mediaNotFound();
        }
        this.assertCompletable(current);
        return current;
      });

    if (media.status === 'approved' || media.status === 'pending_review') {
      return { id: media.id, status: media.status };
    }

    let metadata;
    let prefix;
    try {
      [metadata, prefix] = await Promise.all([
        this.objectStorage.getObjectMetadata(bucket, media.object_key),
        this.objectStorage.readObjectPrefix(bucket, media.object_key, 12),
      ]);
    } catch (error) {
      if (
        error instanceof PrivateObjectStorageError &&
        error.code === 'OBJECT_NOT_FOUND'
      ) {
        throw new ConflictException({
          code: 'AVATAR_OBJECT_NOT_UPLOADED',
          message: 'Upload the avatar object before completing this action.',
        });
      }
      throw this.storageUnavailable();
    }
    if (
      metadata.contentLength !== media.expected_size_bytes ||
      (metadata.contentEncoding !== null &&
        metadata.contentEncoding !== 'identity') ||
      metadata.contentType !== media.content_type ||
      metadata.mediaId !== media.id ||
      !isExpectedProfileImageSignature(prefix, media.content_type)
    ) {
      throw new UnprocessableEntityException({
        code: 'AVATAR_UPLOAD_METADATA_MISMATCH',
        message: 'The uploaded object does not match the authorized avatar.',
      });
    }

    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const current = await transaction
          .selectFrom('profile_media')
          .selectAll()
          .where('id', '=', media.id)
          .where('user_id', '=', user.id)
          .forUpdate()
          .executeTakeFirst();
        if (!current) {
          throw this.mediaNotFound();
        }
        this.assertCompletable(current);
        if (
          current.status === 'approved' ||
          current.status === 'pending_review'
        ) {
          return { id: current.id, status: current.status };
        }
        const completedAt = new Date();
        await transaction
          .updateTable('profile_media')
          .set({
            actual_size_bytes: metadata.contentLength,
            completed_at: completedAt,
            status: 'pending_review',
            storage_generation: metadata.generation,
            updated_at: completedAt,
          })
          .where('id', '=', current.id)
          .executeTakeFirstOrThrow();
        return { id: current.id, status: 'pending_review' as const };
      });
  }

  async getAvatar(
    principal: AuthenticatedPrincipal,
  ): Promise<AvatarStateResponseDto> {
    const bucket = this.requireBucket();
    const state = await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const profile = await this.profiles.ensureProfile(user.id, transaction);
        const [active, latest] = await Promise.all([
          profile.avatar_object_key
            ? transaction
                .selectFrom('profile_media')
                .selectAll()
                .where('user_id', '=', user.id)
                .where('object_key', '=', profile.avatar_object_key)
                .where('status', '=', 'approved')
                .where('object_deleted_at', 'is', null)
                .executeTakeFirst()
            : Promise.resolve(undefined),
          transaction
            .selectFrom('profile_media')
            .selectAll()
            .where('user_id', '=', user.id)
            .orderBy('created_at', 'desc')
            .executeTakeFirst(),
        ]);
        return { active: active ?? null, latest: latest ?? null };
      });

    const expiresAt = new Date(Date.now() + this.readTtlSeconds * 1_000);
    const active = state.active
      ? await this.mediaResponse(bucket, state.active, expiresAt, true)
      : null;
    const latest =
      state.latest?.id === state.active?.id
        ? active
        : state.latest
          ? await this.mediaResponse(
              bucket,
              state.latest,
              expiresAt,
              state.latest.status === 'pending_review',
            )
          : null;
    return { active, latest };
  }

  async removeAvatar(
    principal: AuthenticatedPrincipal,
  ): Promise<RemoveAvatarResponseDto> {
    await this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const profile = await this.profiles.ensureProfile(user.id, transaction);
        const now = new Date();
        const removed = await transaction
          .updateTable('profile_media')
          .set({ status: 'removed', updated_at: now })
          .where('user_id', '=', user.id)
          .where('status', 'in', [
            'approved',
            'pending_review',
            'pending_upload',
          ])
          .where('object_deleted_at', 'is', null)
          .returning('id')
          .execute();
        if (profile.avatar_object_key || removed.length > 0) {
          await transaction
            .updateTable('profiles')
            .set({
              avatar_object_key: null,
              updated_at: now,
              version: sql<number>`version + 1`,
            })
            .where('user_id', '=', user.id)
            .executeTakeFirstOrThrow();
        }
      });
    return { status: 'removed' };
  }

  private assertCompletable(media: Selectable<ProfileMediaTable>): void {
    if (media.status === 'approved' || media.status === 'pending_review') {
      return;
    }
    if (media.status !== 'pending_upload') {
      throw new ConflictException({
        code: 'AVATAR_UPLOAD_NOT_PENDING',
        message: 'This avatar upload is no longer pending.',
      });
    }
    if (media.expires_at.getTime() <= Date.now()) {
      throw new ConflictException({
        code: 'AVATAR_UPLOAD_EXPIRED',
        message: 'This avatar upload action has expired.',
      });
    }
  }

  private async mediaResponse(
    bucket: string,
    media: Selectable<ProfileMediaTable>,
    expiresAt: Date,
    includeReadUrl: boolean,
  ): Promise<AvatarMediaDto> {
    if (!includeReadUrl) {
      return {
        contentType: media.content_type,
        createdAt: media.created_at.toISOString(),
        id: media.id,
        readUrl: null,
        readUrlExpiresAt: null,
        status: media.status,
      };
    }
    try {
      const readUrl = await this.objectStorage.createSignedReadUrl(
        bucket,
        media.object_key,
        expiresAt,
      );
      return {
        contentType: media.content_type,
        createdAt: media.created_at.toISOString(),
        id: media.id,
        readUrl,
        readUrlExpiresAt: expiresAt.toISOString(),
        status: media.status,
      };
    } catch {
      throw this.storageUnavailable();
    }
  }

  private mediaNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'AVATAR_MEDIA_NOT_FOUND',
      message: 'The avatar media was not found.',
    });
  }

  private objectKey(userId: string, mediaId: string, contentType: string) {
    const extension =
      contentType === 'image/jpeg'
        ? 'jpg'
        : contentType === 'image/png'
          ? 'png'
          : 'webp';
    return `avatars/${userId}/${mediaId}.${extension}`;
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

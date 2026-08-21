import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { ProfileMediaStatus } from '../../database/database.types';
import {
  PRIVATE_OBJECT_STORAGE,
  type PrivateObjectStorage,
} from '../storage/private-object-storage';

export interface ProfileMediaCleanupResult {
  deleted: number;
  failed: number;
}

interface ClaimedProfileMediaCleanup {
  attemptCount: number;
  id: string;
  leaseToken: string;
  objectKey: string;
  status: ProfileMediaStatus;
  storageVersionId: string | null;
}

@Injectable()
export class ProfileMediaCleanupService {
  private readonly bucket?: string;
  private readonly enabled: boolean;
  private readonly leaseSeconds: number;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly database: DatabaseService,
    @Inject(PRIVATE_OBJECT_STORAGE)
    private readonly objectStorage: PrivateObjectStorage,
  ) {
    this.bucket = config.get('PRIVATE_CONTENT_BUCKET', { infer: true });
    this.enabled = config.get('PROFILE_MEDIA_ENABLED', { infer: true });
    this.leaseSeconds = config.get('PROFILE_MEDIA_CLEANUP_LEASE_SECONDS', {
      infer: true,
    });
  }

  async process(limit = 50): Promise<ProfileMediaCleanupResult> {
    if (!this.enabled) {
      return { deleted: 0, failed: 0 };
    }
    const bucket = this.requireBucket();
    const result = { deleted: 0, failed: 0 };
    const boundedLimit = Math.min(100, Math.max(1, limit));
    for (let index = 0; index < boundedLimit; index += 1) {
      const candidate = await this.claimNext(new Date());
      if (!candidate) break;
      try {
        await this.objectStorage.deleteObject(
          bucket,
          candidate.objectKey,
          candidate.storageVersionId,
        );
        const deletedAt = new Date();
        const updated = await this.database.connection
          .updateTable('profile_media')
          .set({
            cleanup_failure_code: null,
            cleanup_lease_expires_at: null,
            cleanup_lease_token: null,
            object_deleted_at: deletedAt,
            status:
              candidate.status === 'pending_upload'
                ? 'expired'
                : candidate.status,
            review_version: sql<number>`review_version + 1`,
            updated_at: deletedAt,
          })
          .where('id', '=', candidate.id)
          .where('status', '=', candidate.status)
          .where('object_deleted_at', 'is', null)
          .where('cleanup_lease_token', '=', candidate.leaseToken)
          .where('cleanup_lease_expires_at', '>', deletedAt)
          .returning('id')
          .executeTakeFirst();
        if (updated) {
          result.deleted += 1;
        } else {
          const leaseLost = new Error(
            'The profile media cleanup lease was lost before completion.',
          );
          leaseLost.name = 'ProfileMediaCleanupLeaseLostError';
          throw leaseLost;
        }
      } catch (error) {
        await this.recordFailure(candidate, error);
        result.failed += 1;
      }
    }
    return result;
  }

  private claimNext(now: Date): Promise<ClaimedProfileMediaCleanup | null> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const candidate = await transaction
          .selectFrom('profile_media')
          .select(['id', 'object_key', 'status', 'storage_version_id'])
          .where('object_deleted_at', 'is', null)
          .where('expires_at', '<=', now)
          .where('cleanup_next_attempt_at', '<=', now)
          .where('status', 'in', [
            'pending_upload',
            'rejected',
            'removed',
            'superseded',
          ])
          .where((expression) =>
            expression.or([
              expression('cleanup_lease_expires_at', 'is', null),
              expression('cleanup_lease_expires_at', '<=', now),
            ]),
          )
          .orderBy('cleanup_next_attempt_at')
          .orderBy('created_at')
          .forUpdate()
          .skipLocked()
          .executeTakeFirst();
        if (!candidate) return null;

        const leaseToken = randomUUID();
        const claimed = await transaction
          .updateTable('profile_media')
          .set({
            cleanup_attempt_count: sql<number>`cleanup_attempt_count + 1`,
            cleanup_failure_code: null,
            cleanup_lease_expires_at: new Date(
              now.getTime() + this.leaseSeconds * 1_000,
            ),
            cleanup_lease_token: leaseToken,
            updated_at: now,
          })
          .where('id', '=', candidate.id)
          .returning('cleanup_attempt_count')
          .executeTakeFirstOrThrow();
        return {
          attemptCount: claimed.cleanup_attempt_count,
          id: candidate.id,
          leaseToken,
          objectKey: candidate.object_key,
          status: candidate.status,
          storageVersionId: candidate.storage_version_id,
        };
      });
  }

  private async recordFailure(
    candidate: ClaimedProfileMediaCleanup,
    error: unknown,
  ): Promise<void> {
    const now = new Date();
    const retryDelaySeconds = Math.min(
      6 * 60 * 60,
      30 * 2 ** Math.min(candidate.attemptCount, 9),
    );
    await this.database.connection
      .updateTable('profile_media')
      .set({
        cleanup_failure_code: this.safeFailureCode(error),
        cleanup_lease_expires_at: null,
        cleanup_lease_token: null,
        cleanup_next_attempt_at: new Date(
          now.getTime() + retryDelaySeconds * 1_000,
        ),
        updated_at: now,
      })
      .where('id', '=', candidate.id)
      .where('cleanup_lease_token', '=', candidate.leaseToken)
      .where('cleanup_lease_expires_at', '>', now)
      .execute();
  }

  private safeFailureCode(error: unknown): string {
    return error instanceof Error
      ? error.name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 120) || 'Error'
      : 'UnknownError';
  }

  private requireBucket(): string {
    if (!this.bucket) {
      throw new ServiceUnavailableException({
        code: 'PROFILE_MEDIA_UNAVAILABLE',
        message: 'Profile media is not available.',
      });
    }
    return this.bucket;
  }
}

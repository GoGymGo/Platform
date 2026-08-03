import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import {
  PRIVATE_OBJECT_STORAGE,
  type PrivateObjectStorage,
} from '../storage/private-object-storage';

export interface ProfileMediaCleanupResult {
  deleted: number;
  failed: number;
}

@Injectable()
export class ProfileMediaCleanupService {
  private readonly bucket?: string;
  private readonly enabled: boolean;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly database: DatabaseService,
    @Inject(PRIVATE_OBJECT_STORAGE)
    private readonly objectStorage: PrivateObjectStorage,
  ) {
    this.bucket = config.get('PRIVATE_CONTENT_BUCKET', { infer: true });
    this.enabled = config.get('PROFILE_MEDIA_ENABLED', { infer: true });
  }

  async process(limit = 50): Promise<ProfileMediaCleanupResult> {
    if (!this.enabled) {
      return { deleted: 0, failed: 0 };
    }
    const bucket = this.requireBucket();
    const now = new Date();
    const candidates = await this.database.connection
      .selectFrom('profile_media')
      .select(['id', 'object_key', 'status'])
      .where('object_deleted_at', 'is', null)
      .where('expires_at', '<=', now)
      .where('status', 'in', [
        'pending_upload',
        'rejected',
        'removed',
        'superseded',
      ])
      .orderBy('created_at')
      .limit(limit)
      .execute();
    const result = { deleted: 0, failed: 0 };
    for (const candidate of candidates) {
      try {
        await this.objectStorage.deleteObject(bucket, candidate.object_key);
        const deletedAt = new Date();
        const updated = await this.database.connection
          .updateTable('profile_media')
          .set({
            object_deleted_at: deletedAt,
            status:
              candidate.status === 'pending_upload'
                ? 'expired'
                : candidate.status,
            updated_at: deletedAt,
          })
          .where('id', '=', candidate.id)
          .where('status', '=', candidate.status)
          .where('object_deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (updated) {
          result.deleted += 1;
        }
      } catch {
        result.failed += 1;
      }
    }
    return result;
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

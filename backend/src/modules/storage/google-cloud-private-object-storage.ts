import { Storage } from '@google-cloud/storage';
import type {
  PrivateObjectStorage,
  PutPrivateJsonInput,
} from './private-object-storage';
import { PrivateObjectStorageError } from './private-object-storage';

interface ErrorWithCode {
  code?: number | string;
}

export class GoogleCloudPrivateObjectStorage implements PrivateObjectStorage {
  constructor(private readonly storage: Storage) {}

  async putJsonIfAbsent(
    input: PutPrivateJsonInput,
  ): Promise<{ sha256: string }> {
    this.assertLocation(input.bucket, input.objectKey);
    if (!/^[a-f0-9]{64}$/.test(input.sha256)) {
      throw new PrivateObjectStorageError('OBJECT_SHA256_INVALID');
    }
    const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const file = this.storage.bucket(input.bucket).file(input.objectKey);
    try {
      await file.save(input.data, {
        metadata: {
          cacheControl: 'private, no-store, max-age=0',
          contentDisposition: `attachment; filename="${safeFileName}"`,
          contentType: 'application/json; charset=utf-8',
          metadata: { sha256: input.sha256 },
        },
        preconditionOpts: { ifGenerationMatch: 0 },
        resumable: false,
        validation: 'crc32c',
      });
      return { sha256: input.sha256 };
    } catch (error) {
      if (!this.hasCode(error, 412)) {
        throw new PrivateObjectStorageError('OBJECT_WRITE_FAILED');
      }

      try {
        const [metadata] = await file.getMetadata();
        const existingSha256 = metadata.metadata?.sha256;
        if (
          typeof existingSha256 === 'string' &&
          /^[a-f0-9]{64}$/.test(existingSha256)
        ) {
          return { sha256: existingSha256 };
        }
      } catch {
        throw new PrivateObjectStorageError('OBJECT_METADATA_READ_FAILED');
      }
      throw new PrivateObjectStorageError('OBJECT_METADATA_INVALID');
    }
  }

  async createSignedReadUrl(
    bucket: string,
    objectKey: string,
    expiresAt: Date,
  ): Promise<string> {
    this.assertLocation(bucket, objectKey);
    if (expiresAt.getTime() <= Date.now()) {
      throw new PrivateObjectStorageError('SIGNED_URL_EXPIRY_INVALID');
    }
    try {
      const [url] = await this.storage
        .bucket(bucket)
        .file(objectKey)
        .getSignedUrl({ action: 'read', expires: expiresAt, version: 'v4' });
      return url;
    } catch {
      throw new PrivateObjectStorageError('SIGNED_URL_CREATE_FAILED');
    }
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    this.assertLocation(bucket, objectKey);
    try {
      await this.storage.bucket(bucket).file(objectKey).delete();
    } catch (error) {
      if (!this.hasCode(error, 404)) {
        throw new PrivateObjectStorageError('OBJECT_DELETE_FAILED');
      }
    }
  }

  private assertLocation(bucket: string, objectKey: string): void {
    if (
      !bucket.trim() ||
      !objectKey.trim() ||
      objectKey.startsWith('/') ||
      objectKey.split('/').includes('..')
    ) {
      throw new PrivateObjectStorageError('OBJECT_LOCATION_INVALID');
    }
  }

  private hasCode(error: unknown, expected: number): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const code = (error as ErrorWithCode).code;
    return code === expected || code === String(expected);
  }
}

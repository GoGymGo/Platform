import { Storage } from '@google-cloud/storage';
import type {
  CreateSignedUploadUrlInput,
  PrivateObjectStorage,
  PutPrivateJsonInput,
  SignedUploadAction,
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

  async createSignedUploadUrl(
    input: CreateSignedUploadUrlInput,
  ): Promise<SignedUploadAction> {
    this.assertLocation(input.bucket, input.objectKey);
    if (
      input.expiresAt.getTime() <= Date.now() ||
      !Number.isSafeInteger(input.contentLength) ||
      input.contentLength < 1 ||
      !input.contentType.trim() ||
      !input.mediaId.trim()
    ) {
      throw new PrivateObjectStorageError('SIGNED_UPLOAD_INPUT_INVALID');
    }
    const headers = {
      'cache-control': 'private, no-store, max-age=0',
      'content-type': input.contentType,
      'x-goog-content-length-range': `${input.contentLength},${input.contentLength}`,
      'x-goog-if-generation-match': '0',
      'x-goog-meta-media-id': input.mediaId,
    };
    try {
      const [url] = await this.storage
        .bucket(input.bucket)
        .file(input.objectKey)
        .getSignedUrl({
          action: 'write',
          contentType: input.contentType,
          expires: input.expiresAt,
          extensionHeaders: {
            'cache-control': headers['cache-control'],
            'x-goog-content-length-range':
              headers['x-goog-content-length-range'],
            'x-goog-if-generation-match': headers['x-goog-if-generation-match'],
            'x-goog-meta-media-id': headers['x-goog-meta-media-id'],
          },
          version: 'v4',
        });
      return { headers, url };
    } catch {
      throw new PrivateObjectStorageError('SIGNED_UPLOAD_URL_CREATE_FAILED');
    }
  }

  async getObjectMetadata(bucket: string, objectKey: string) {
    this.assertLocation(bucket, objectKey);
    try {
      const [metadata] = await this.storage
        .bucket(bucket)
        .file(objectKey)
        .getMetadata();
      const contentLength = Number(metadata.size);
      const contentEncoding = metadata.contentEncoding;
      const contentType = metadata.contentType;
      const generation = metadata.generation;
      if (
        !Number.isSafeInteger(contentLength) ||
        contentLength < 1 ||
        (contentEncoding !== undefined &&
          contentEncoding !== null &&
          typeof contentEncoding !== 'string') ||
        typeof contentType !== 'string' ||
        !contentType.trim() ||
        typeof generation !== 'string' ||
        !generation.trim()
      ) {
        throw new PrivateObjectStorageError('OBJECT_METADATA_INVALID');
      }
      const mediaId = metadata.metadata?.['media-id'];
      return {
        contentEncoding: contentEncoding ?? null,
        contentLength,
        contentType,
        generation,
        mediaId: typeof mediaId === 'string' ? mediaId : null,
      };
    } catch (error) {
      if (error instanceof PrivateObjectStorageError) {
        throw error;
      }
      if (this.hasCode(error, 404)) {
        throw new PrivateObjectStorageError('OBJECT_NOT_FOUND');
      }
      throw new PrivateObjectStorageError('OBJECT_METADATA_READ_FAILED');
    }
  }

  async readObjectPrefix(
    bucket: string,
    objectKey: string,
    length: number,
  ): Promise<Buffer> {
    this.assertLocation(bucket, objectKey);
    if (!Number.isSafeInteger(length) || length < 1 || length > 64) {
      throw new PrivateObjectStorageError('OBJECT_PREFIX_LENGTH_INVALID');
    }
    try {
      const [data] = await this.storage
        .bucket(bucket)
        .file(objectKey)
        .download({ end: length - 1, start: 0 });
      if (!Buffer.isBuffer(data) || data.length < length) {
        throw new PrivateObjectStorageError('OBJECT_PREFIX_INVALID');
      }
      return data.subarray(0, length);
    } catch (error) {
      if (error instanceof PrivateObjectStorageError) {
        throw error;
      }
      if (this.hasCode(error, 404)) {
        throw new PrivateObjectStorageError('OBJECT_NOT_FOUND');
      }
      throw new PrivateObjectStorageError('OBJECT_PREFIX_READ_FAILED');
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

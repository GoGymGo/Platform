import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  CreateSignedUploadUrlInput,
  PrivateObjectIdentity,
  PrivateObjectStorage,
  PutPrivateJsonInput,
  SignedUploadAction,
} from './private-object-storage';
import { PrivateObjectStorageError } from './private-object-storage';

interface AwsError {
  $metadata?: { httpStatusCode?: number };
  name?: string;
}

type Presign = (
  client: S3Client,
  command: GetObjectCommand | PutObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

export class AwsS3PrivateObjectStorage implements PrivateObjectStorage {
  constructor(
    private readonly s3: S3Client,
    private readonly presign: Presign = getSignedUrl,
  ) {}

  async putJsonIfAbsent(
    input: PutPrivateJsonInput,
  ): Promise<{ sha256: string }> {
    this.assertLocation(input.bucket, input.objectKey);
    if (!/^[a-f0-9]{64}$/.test(input.sha256)) {
      throw new PrivateObjectStorageError('OBJECT_SHA256_INVALID');
    }
    const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    try {
      await this.s3.send(
        new PutObjectCommand({
          Body: input.data,
          Bucket: input.bucket,
          CacheControl: 'private, no-store, max-age=0',
          ContentDisposition: `attachment; filename="${safeFileName}"`,
          ContentType: 'application/json; charset=utf-8',
          IfNoneMatch: '*',
          Key: input.objectKey,
          Metadata: { sha256: input.sha256 },
        }),
      );
      return { sha256: input.sha256 };
    } catch (error) {
      if (!this.hasStatus(error, 412)) {
        throw new PrivateObjectStorageError('OBJECT_WRITE_FAILED');
      }
      try {
        const metadata = await this.s3.send(
          new HeadObjectCommand({
            Bucket: input.bucket,
            Key: input.objectKey,
          }),
        );
        const existingSha256 = metadata.Metadata?.sha256;
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
    identity?: PrivateObjectIdentity,
  ): Promise<string> {
    this.assertLocation(bucket, objectKey);
    const expiresIn = this.expiresInSeconds(expiresAt);
    try {
      return await this.presign(
        this.s3,
        new GetObjectCommand({
          Bucket: bucket,
          ...(identity ? { IfMatch: identity.etag } : {}),
          Key: objectKey,
          ...(identity?.versionId ? { VersionId: identity.versionId } : {}),
        }),
        { expiresIn },
      );
    } catch {
      throw new PrivateObjectStorageError('SIGNED_URL_CREATE_FAILED');
    }
  }

  async createSignedUploadUrl(
    input: CreateSignedUploadUrlInput,
  ): Promise<SignedUploadAction> {
    this.assertLocation(input.bucket, input.objectKey);
    if (
      !Number.isSafeInteger(input.contentLength) ||
      input.contentLength < 1 ||
      !input.contentType.trim() ||
      !input.mediaId.trim()
    ) {
      throw new PrivateObjectStorageError('SIGNED_UPLOAD_INPUT_INVALID');
    }
    const expiresIn = this.expiresInSeconds(input.expiresAt);
    const headers = {
      'cache-control': 'private, no-store, max-age=0',
      'content-type': input.contentType,
      'if-none-match': '*',
      'x-amz-meta-media-id': input.mediaId,
    };
    try {
      const url = await this.presign(
        this.s3,
        new PutObjectCommand({
          Bucket: input.bucket,
          CacheControl: headers['cache-control'],
          ContentLength: input.contentLength,
          ContentType: input.contentType,
          IfNoneMatch: headers['if-none-match'],
          Key: input.objectKey,
          Metadata: { 'media-id': input.mediaId },
        }),
        { expiresIn },
      );
      return { headers, url };
    } catch {
      throw new PrivateObjectStorageError('SIGNED_UPLOAD_URL_CREATE_FAILED');
    }
  }

  async getObjectMetadata(bucket: string, objectKey: string) {
    this.assertLocation(bucket, objectKey);
    try {
      const metadata = await this.s3.send(
        new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
      const contentLength = metadata.ContentLength;
      const contentType = metadata.ContentType;
      const etag = metadata.ETag;
      if (
        typeof contentLength !== 'number' ||
        !Number.isSafeInteger(contentLength) ||
        contentLength < 1 ||
        typeof contentType !== 'string' ||
        !contentType.trim() ||
        typeof etag !== 'string' ||
        !etag.trim()
      ) {
        throw new PrivateObjectStorageError('OBJECT_METADATA_INVALID');
      }
      const mediaId = metadata.Metadata?.['media-id'];
      return {
        contentEncoding: metadata.ContentEncoding ?? null,
        contentLength,
        contentType,
        etag,
        mediaId: typeof mediaId === 'string' ? mediaId : null,
        versionId:
          typeof metadata.VersionId === 'string' && metadata.VersionId.trim()
            ? metadata.VersionId
            : null,
      };
    } catch (error) {
      if (error instanceof PrivateObjectStorageError) throw error;
      if (this.isNotFound(error)) {
        throw new PrivateObjectStorageError('OBJECT_NOT_FOUND');
      }
      throw new PrivateObjectStorageError('OBJECT_METADATA_READ_FAILED');
    }
  }

  async readObject(
    bucket: string,
    objectKey: string,
    expectedLength: number,
    identity: PrivateObjectIdentity,
  ): Promise<Buffer> {
    this.assertLocation(bucket, objectKey);
    if (
      !Number.isSafeInteger(expectedLength) ||
      expectedLength < 1 ||
      expectedLength > 5 * 1_024 * 1_024 ||
      !identity.etag.trim()
    ) {
      throw new PrivateObjectStorageError('OBJECT_READ_INPUT_INVALID');
    }
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          IfMatch: identity.etag,
          Key: objectKey,
          Range: `bytes=0-${expectedLength - 1}`,
          ...(identity.versionId ? { VersionId: identity.versionId } : {}),
        }),
      );
      if (!response.Body) {
        throw new PrivateObjectStorageError('OBJECT_READ_INVALID');
      }
      const data = Buffer.from(await response.Body.transformToByteArray());
      if (data.length !== expectedLength) {
        throw new PrivateObjectStorageError('OBJECT_READ_INVALID');
      }
      return data;
    } catch (error) {
      if (error instanceof PrivateObjectStorageError) throw error;
      if (this.isNotFound(error)) {
        throw new PrivateObjectStorageError('OBJECT_NOT_FOUND');
      }
      if (this.hasStatus(error, 412)) {
        throw new PrivateObjectStorageError('OBJECT_IDENTITY_MISMATCH');
      }
      throw new PrivateObjectStorageError('OBJECT_READ_FAILED');
    }
  }

  async deleteObject(
    bucket: string,
    objectKey: string,
    versionId?: string | null,
  ): Promise<void> {
    this.assertLocation(bucket, objectKey);
    try {
      let resolvedVersionId = versionId;
      if (!resolvedVersionId) {
        const metadata = await this.s3.send(
          new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
        );
        resolvedVersionId =
          typeof metadata.VersionId === 'string' && metadata.VersionId.trim()
            ? metadata.VersionId
            : null;
      }
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ...(resolvedVersionId ? { VersionId: resolvedVersionId } : {}),
        }),
      );
    } catch (error) {
      if (!this.isNotFound(error)) {
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

  private expiresInSeconds(expiresAt: Date): number {
    const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1_000);
    if (expiresIn < 1 || expiresIn > 900) {
      throw new PrivateObjectStorageError('SIGNED_URL_EXPIRY_INVALID');
    }
    return expiresIn;
  }

  private hasStatus(error: unknown, expected: number): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as AwsError).$metadata?.httpStatusCode === expected
    );
  }

  private isNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const awsError = error as AwsError;
    return (
      awsError.$metadata?.httpStatusCode === 404 ||
      awsError.name === 'NoSuchKey' ||
      awsError.name === 'NotFound'
    );
  }
}

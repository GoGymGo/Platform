export const PRIVATE_OBJECT_STORAGE = Symbol('PRIVATE_OBJECT_STORAGE');

export interface PutPrivateJsonInput {
  bucket: string;
  data: Buffer;
  fileName: string;
  objectKey: string;
  sha256: string;
}

export interface CreateSignedUploadUrlInput {
  bucket: string;
  contentLength: number;
  contentType: string;
  expiresAt: Date;
  mediaId: string;
  objectKey: string;
}

export interface PrivateObjectMetadata {
  contentEncoding: string | null;
  contentLength: number;
  contentType: string;
  generation: string;
  mediaId: string | null;
}

export interface SignedUploadAction {
  headers: Record<string, string>;
  url: string;
}

export interface PrivateObjectStorage {
  createSignedReadUrl(
    bucket: string,
    objectKey: string,
    expiresAt: Date,
  ): Promise<string>;
  createSignedUploadUrl(
    input: CreateSignedUploadUrlInput,
  ): Promise<SignedUploadAction>;
  deleteObject(bucket: string, objectKey: string): Promise<void>;
  getObjectMetadata(
    bucket: string,
    objectKey: string,
  ): Promise<PrivateObjectMetadata>;
  putJsonIfAbsent(input: PutPrivateJsonInput): Promise<{ sha256: string }>;
  readObjectPrefix(
    bucket: string,
    objectKey: string,
    length: number,
  ): Promise<Buffer>;
}

export class PrivateObjectStorageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PrivateObjectStorageError';
  }
}

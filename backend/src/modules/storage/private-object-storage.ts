export const PRIVATE_OBJECT_STORAGE = Symbol('PRIVATE_OBJECT_STORAGE');

export interface PutPrivateJsonInput {
  bucket: string;
  data: Buffer;
  fileName: string;
  objectKey: string;
  sha256: string;
}

export interface PrivateObjectStorage {
  createSignedReadUrl(
    bucket: string,
    objectKey: string,
    expiresAt: Date,
  ): Promise<string>;
  deleteObject(bucket: string, objectKey: string): Promise<void>;
  putJsonIfAbsent(input: PutPrivateJsonInput): Promise<{ sha256: string }>;
}

export class PrivateObjectStorageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PrivateObjectStorageError';
  }
}

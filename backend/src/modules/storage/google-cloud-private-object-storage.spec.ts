import type { Storage } from '@google-cloud/storage';
import { createHash } from 'node:crypto';
import { GoogleCloudPrivateObjectStorage } from './google-cloud-private-object-storage';

describe('GoogleCloudPrivateObjectStorage', () => {
  const data = Buffer.from('{"safe":true}\n');
  const sha256 = createHash('sha256').update(data).digest('hex');

  function setup() {
    const file = {
      delete: jest.fn(),
      download: jest.fn(),
      getMetadata: jest.fn(),
      getSignedUrl: jest.fn(),
      save: jest.fn(),
    };
    const bucket = { file: jest.fn(() => file) };
    const storage = {
      bucket: jest.fn(() => bucket),
    } as unknown as Storage;
    return {
      bucket,
      client: new GoogleCloudPrivateObjectStorage(storage),
      file,
      storage,
    };
  }

  it('writes JSON once with private cache metadata and an integrity hash', async () => {
    const { client, file } = setup();

    await expect(
      client.putJsonIfAbsent({
        bucket: 'private-exports',
        data,
        fileName: 'export.json',
        objectKey: 'privacy-exports/user/request.json',
        sha256,
      }),
    ).resolves.toEqual({ sha256 });
    expect(file.save).toHaveBeenCalledWith(
      data,
      expect.objectContaining({
        metadata: expect.objectContaining({
          cacheControl: 'private, no-store, max-age=0',
          contentType: 'application/json; charset=utf-8',
          metadata: { sha256 },
        }),
        preconditionOpts: { ifGenerationMatch: 0 },
        resumable: false,
        validation: 'crc32c',
      }),
    );
  });

  it('treats an atomic create conflict as a retry and trusts stored metadata', async () => {
    const { client, file } = setup();
    file.save.mockRejectedValue({ code: 412 });
    file.getMetadata.mockResolvedValue([{ metadata: { sha256 } }]);

    await expect(
      client.putJsonIfAbsent({
        bucket: 'private-exports',
        data,
        fileName: 'export.json',
        objectKey: 'privacy-exports/user/request.json',
        sha256: 'f'.repeat(64),
      }),
    ).resolves.toEqual({ sha256 });
  });

  it('creates bounded V4 read URLs and makes deletion idempotent', async () => {
    const { client, file } = setup();
    const expiresAt = new Date(Date.now() + 60_000);
    file.getSignedUrl.mockResolvedValue([
      'https://storage.googleapis.com/signed',
    ]);
    file.delete.mockRejectedValue({ code: 404 });

    await expect(
      client.createSignedReadUrl(
        'private-exports',
        'privacy-exports/user/request.json',
        expiresAt,
      ),
    ).resolves.toBe('https://storage.googleapis.com/signed');
    expect(file.getSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expiresAt,
      version: 'v4',
    });
    await expect(
      client.deleteObject(
        'private-exports',
        'privacy-exports/user/request.json',
      ),
    ).resolves.toBeUndefined();
  });

  it('creates a bounded single-write URL with exact upload constraints', async () => {
    const { client, file } = setup();
    const expiresAt = new Date(Date.now() + 60_000);
    file.getSignedUrl.mockResolvedValue([
      'https://storage.googleapis.com/upload',
    ]);

    await expect(
      client.createSignedUploadUrl({
        bucket: 'private-content',
        contentLength: 512,
        contentType: 'image/jpeg',
        expiresAt,
        mediaId: '10000000-0000-4000-8000-000000000001',
        objectKey:
          'avatars/20000000-0000-4000-8000-000000000002/10000000-0000-4000-8000-000000000001.jpg',
      }),
    ).resolves.toEqual({
      headers: {
        'cache-control': 'private, no-store, max-age=0',
        'content-type': 'image/jpeg',
        'x-goog-content-length-range': '512,512',
        'x-goog-if-generation-match': '0',
        'x-goog-meta-media-id': '10000000-0000-4000-8000-000000000001',
      },
      url: 'https://storage.googleapis.com/upload',
    });
    expect(file.getSignedUrl).toHaveBeenCalledWith({
      action: 'write',
      contentType: 'image/jpeg',
      expires: expiresAt,
      extensionHeaders: {
        'cache-control': 'private, no-store, max-age=0',
        'x-goog-content-length-range': '512,512',
        'x-goog-if-generation-match': '0',
        'x-goog-meta-media-id': '10000000-0000-4000-8000-000000000001',
      },
      version: 'v4',
    });
  });

  it('reads normalized upload metadata and fails closed when it is missing', async () => {
    const { client, file } = setup();
    file.getMetadata.mockResolvedValue([
      {
        contentType: 'image/jpeg',
        generation: '1234',
        metadata: { 'media-id': 'media-1' },
        size: '512',
      },
    ]);

    await expect(
      client.getObjectMetadata('private-content', 'avatars/user/media.jpg'),
    ).resolves.toEqual({
      contentEncoding: null,
      contentLength: 512,
      contentType: 'image/jpeg',
      generation: '1234',
      mediaId: 'media-1',
    });

    file.getMetadata.mockRejectedValue({ code: 404 });
    await expect(
      client.getObjectMetadata('private-content', 'avatars/user/missing.jpg'),
    ).rejects.toMatchObject({ code: 'OBJECT_NOT_FOUND' });
  });

  it('reads only a bounded object prefix for media signature validation', async () => {
    const { client, file } = setup();
    file.download.mockResolvedValue([Buffer.from('0123456789abcdef')]);

    await expect(
      client.readObjectPrefix('private-content', 'avatars/user/media.jpg', 12),
    ).resolves.toEqual(Buffer.from('0123456789ab'));
    expect(file.download).toHaveBeenCalledWith({ end: 11, start: 0 });
  });
});

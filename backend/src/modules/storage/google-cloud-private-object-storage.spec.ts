import type { Storage } from '@google-cloud/storage';
import { createHash } from 'node:crypto';
import { GoogleCloudPrivateObjectStorage } from './google-cloud-private-object-storage';

describe('GoogleCloudPrivateObjectStorage', () => {
  const data = Buffer.from('{"safe":true}\n');
  const sha256 = createHash('sha256').update(data).digest('hex');

  function setup() {
    const file = {
      delete: jest.fn(),
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
});

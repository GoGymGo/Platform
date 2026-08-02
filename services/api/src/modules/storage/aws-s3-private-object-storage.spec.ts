import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { AwsS3PrivateObjectStorage } from './aws-s3-private-object-storage';

describe('AwsS3PrivateObjectStorage', () => {
  const data = Buffer.from('{"safe":true}\n');
  const sha256 = createHash('sha256').update(data).digest('hex');

  function setup() {
    const send = jest.fn<Promise<unknown>, [unknown]>();
    const presign = jest
      .fn<
        Promise<string>,
        [S3Client, GetObjectCommand | PutObjectCommand, { expiresIn: number }]
      >()
      .mockResolvedValue('https://s3.example/signed');
    return {
      client: new AwsS3PrivateObjectStorage(
        { send } as unknown as S3Client,
        presign,
      ),
      presign,
      send,
    };
  }

  it('creates privacy JSON atomically with private metadata', async () => {
    const { client, send } = setup();
    send.mockResolvedValue({});

    await expect(
      client.putJsonIfAbsent({
        bucket: 'private-exports',
        data,
        fileName: 'export.json',
        objectKey: 'privacy-exports/user/request.json',
        sha256,
      }),
    ).resolves.toEqual({ sha256 });

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual(
      expect.objectContaining({
        Bucket: 'private-exports',
        CacheControl: 'private, no-store, max-age=0',
        IfNoneMatch: '*',
        Key: 'privacy-exports/user/request.json',
        Metadata: { sha256 },
      }),
    );
  });

  it('treats a conditional-write conflict as an idempotent retry', async () => {
    const { client, send } = setup();
    send
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } })
      .mockResolvedValueOnce({ Metadata: { sha256 } });

    await expect(
      client.putJsonIfAbsent({
        bucket: 'private-exports',
        data,
        fileName: 'export.json',
        objectKey: 'privacy-exports/user/request.json',
        sha256: 'f'.repeat(64),
      }),
    ).resolves.toEqual({ sha256 });
    expect(send.mock.calls[1][0] as HeadObjectCommand).toBeInstanceOf(
      HeadObjectCommand,
    );
  });

  it('signs bounded read and exact-size conditional upload actions', async () => {
    const { client, presign } = setup();
    const expiresAt = new Date(Date.now() + 60_000);

    await expect(
      client.createSignedReadUrl(
        'private-content',
        'avatars/user/avatar.jpg',
        expiresAt,
      ),
    ).resolves.toBe('https://s3.example/signed');
    expect(presign.mock.calls[0][1]).toBeInstanceOf(GetObjectCommand);

    await expect(
      client.createSignedUploadUrl({
        bucket: 'private-content',
        contentLength: 1024,
        contentType: 'image/jpeg',
        expiresAt,
        mediaId: 'media-1',
        objectKey: 'avatars/user/avatar.jpg',
      }),
    ).resolves.toEqual({
      headers: {
        'cache-control': 'private, no-store, max-age=0',
        'content-type': 'image/jpeg',
        'if-none-match': '*',
        'x-amz-meta-media-id': 'media-1',
      },
      url: 'https://s3.example/signed',
    });
    const upload = presign.mock.calls[1][1];
    expect(upload).toBeInstanceOf(PutObjectCommand);
    expect(upload.input).toEqual(
      expect.objectContaining({
        ContentLength: 1024,
        IfNoneMatch: '*',
        Metadata: { 'media-id': 'media-1' },
      }),
    );
  });

  it('maps S3 metadata and ranged reads to the portable contract', async () => {
    const { client, send } = setup();
    send
      .mockResolvedValueOnce({
        ContentEncoding: undefined,
        ContentLength: 12,
        ContentType: 'image/png',
        ETag: '"etag-1"',
        Metadata: { 'media-id': 'media-1' },
      })
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () =>
            Promise.resolve(Uint8Array.from(Buffer.from('0123456789ab'))),
        },
      });

    await expect(
      client.getObjectMetadata('private-content', 'avatars/user/avatar.png'),
    ).resolves.toEqual({
      contentEncoding: null,
      contentLength: 12,
      contentType: 'image/png',
      generation: '"etag-1"',
      mediaId: 'media-1',
    });
    await expect(
      client.readObjectPrefix('private-content', 'avatars/user/avatar.png', 12),
    ).resolves.toEqual(Buffer.from('0123456789ab'));
    const rangedRead = send.mock.calls[1][0] as GetObjectCommand;
    expect(rangedRead).toBeInstanceOf(GetObjectCommand);
    expect(rangedRead.input.Range).toBe('bytes=0-11');
  });

  it('makes deletion idempotent and rejects unsafe object keys', async () => {
    const { client, send } = setup();
    send.mockResolvedValue({});
    await expect(
      client.deleteObject('private-content', 'avatars/user/avatar.png'),
    ).resolves.toBeUndefined();
    expect(send.mock.calls[0][0] as DeleteObjectCommand).toBeInstanceOf(
      DeleteObjectCommand,
    );

    await expect(
      client.deleteObject('private-content', '../unsafe'),
    ).rejects.toMatchObject({ code: 'OBJECT_LOCATION_INVALID' });
  });
});

import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { PrivateObjectStorage } from '../storage/private-object-storage';
import { ProfileMediaService } from './profile-media.service';
import type { ProfilesService } from './profiles.service';

const principal: AuthenticatedPrincipal = {
  email: 'member@example.test',
  emailVerified: true,
  firebaseUid: 'member-firebase',
  roles: [],
  signInProvider: 'password',
  tokenIssuedAt: 1_787_965_200,
};

function config(
  enabled: boolean,
  bucket?: string,
): ConfigService<Environment, true> {
  return {
    get: jest.fn((key: keyof Environment) => {
      if (key === 'PRIVATE_CONTENT_BUCKET') return bucket;
      if (key === 'PROFILE_MEDIA_ENABLED') return enabled;
      if (key === 'PROFILE_MEDIA_MAX_BYTES') return 2 * 1_024 * 1_024;
      if (key === 'PROFILE_MEDIA_READ_TTL_SECONDS') return 300;
      if (key === 'PROFILE_MEDIA_UPLOAD_TTL_SECONDS') return 300;
      return undefined;
    }),
  } as unknown as ConfigService<Environment, true>;
}

function service(enabled: boolean, bucket?: string) {
  return new ProfileMediaService(
    config(enabled, bucket),
    {} as DatabaseService,
    {} as ProfilesService,
    {} as PrivateObjectStorage,
  );
}

describe('ProfileMediaService capabilities', () => {
  it.each([
    [false, undefined, 'disabled', false],
    [true, undefined, 'unconfigured', false],
    [true, 'private-bucket', 'configured', true],
  ] as const)(
    'reports the authoritative provider state',
    (enabled, bucket, status, uploadAvailable) => {
      expect(service(enabled, bucket).getCapabilities()).toEqual({
        maxBytes: 2 * 1_024 * 1_024,
        maxDimension: 2_048,
        minDimension: 64,
        status,
        uploadAvailable,
      });
    },
  );

  it.each([
    [false, undefined],
    [true, undefined],
  ] as const)(
    'fails before database or storage work when upload authority is absent',
    async (enabled, bucket) => {
      await expect(
        service(enabled, bucket).createUpload(principal, 'request-key', {
          contentLength: 128,
          contentType: 'image/png',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );
});

describe('ProfileMediaService owner presentation', () => {
  const approved = {
    actual_size_bytes: 128,
    cleanup_attempt_count: 0,
    cleanup_failure_code: null,
    cleanup_lease_expires_at: null,
    cleanup_lease_token: null,
    cleanup_next_attempt_at: new Date(),
    completed_at: new Date(),
    content_sha256: 'a'.repeat(64),
    content_type: 'image/png',
    created_at: new Date(),
    decision_reason: 'Approved by a different operator.',
    expected_size_bytes: 128,
    expires_at: new Date(Date.now() - 60_000),
    id: '20000000-0000-4000-8000-000000000002',
    image_height: 128,
    image_width: 128,
    inspection_version: 'avatar-image-v1',
    object_deleted_at: null,
    object_key:
      'avatars/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.png',
    request_key: 'request-key',
    review_version: 2,
    reviewed_at: new Date(),
    reviewed_by_user_id: '30000000-0000-4000-8000-000000000003',
    status: 'approved' as const,
    storage_generation: '"etag-1"',
    storage_version_id: 'storage-version-1',
    updated_at: new Date(),
    user_id: '10000000-0000-4000-8000-000000000001',
  };

  function harness(enabled: boolean, signedRead?: jest.Mock) {
    const query = (result: unknown) => {
      const value: Record<string, jest.Mock> = {};
      for (const method of ['orderBy', 'selectAll', 'where']) {
        value[method] = jest.fn(() => value);
      }
      value.executeTakeFirst = jest.fn().mockResolvedValue(result);
      return value;
    };
    const active = query(approved);
    const latest = query(approved);
    const transaction = {
      selectFrom: jest
        .fn()
        .mockReturnValueOnce(active)
        .mockReturnValueOnce(latest),
    };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (handler: (value: typeof transaction) => unknown) =>
            handler(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const profiles = {
      ensureProfile: jest.fn().mockResolvedValue({
        avatar_object_key: approved.object_key,
      }),
      ensureUser: jest.fn().mockResolvedValue({ id: approved.user_id }),
    } as unknown as ProfilesService;
    const createSignedReadUrl = signedRead ?? jest.fn();
    const objectStorage = {
      createSignedReadUrl,
    } as unknown as PrivateObjectStorage;
    return {
      createSignedReadUrl,
      profileMedia: new ProfileMediaService(
        config(enabled, 'private-bucket'),
        database,
        profiles,
        objectStorage,
      ),
    };
  }

  it('keeps approved metadata but exposes no signed presentation when disabled', async () => {
    const { createSignedReadUrl, profileMedia } = harness(false);
    await expect(profileMedia.getAvatar(principal)).resolves.toEqual({
      active: expect.objectContaining({
        id: approved.id,
        readUrl: null,
        readUrlExpiresAt: null,
        status: 'approved',
        version: 2,
      }),
      latest: expect.objectContaining({ id: approved.id }),
    });
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('fails closed when private signed presentation cannot be created', async () => {
    const { profileMedia } = harness(
      true,
      jest.fn().mockRejectedValue(new Error('provider detail')),
    );
    await expect(profileMedia.getAvatar(principal)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

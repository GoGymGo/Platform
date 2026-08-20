import { sql } from 'kysely';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { ProfileMediaCleanupService } from '../src/modules/profiles/profile-media-cleanup.service';
import { ProfileMediaModerationService } from '../src/modules/profiles/profile-media-moderation.service';
import { ProfileMediaService } from '../src/modules/profiles/profile-media.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import type {
  CreateSignedUploadUrlInput,
  PrivateObjectStorage,
} from '../src/modules/storage/private-object-storage';
import {
  createTestConfig,
  MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const userPrincipal: AuthenticatedPrincipal = {
  email: 'profile-media-user@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-profile-media-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const operatorPrincipal: AuthenticatedPrincipal = {
  email: 'profile-media-operator@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-profile-media-operator',
  roles: ['operator'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describeWithDatabase('critical private profile-media workflow', () => {
  jest.setTimeout(240_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let operatorUserId: string;
  let cleanup: ProfileMediaCleanupService;
  let moderation: ProfileMediaModerationService;
  let profileMedia: ProfileMediaService;
  let profiles: ProfilesService;
  let storage: jest.Mocked<PrivateObjectStorage>;
  const uploadActions = new Map<string, CreateSignedUploadUrlInput>();

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    const config = createTestConfig(migrated.databaseUrl, {
      PRIVATE_CONTENT_BUCKET: 'private-content',
      PROFILE_MEDIA_ENABLED: 'true',
      PROFILE_MEDIA_MAX_BYTES: '2097152',
    });
    database = new DatabaseService(config);
    profiles = new ProfilesService(database);
    storage = {
      createSignedReadUrl: jest.fn((_bucket, objectKey, expiresAt) =>
        Promise.resolve(
          `https://storage.example.test/read/${encodeURIComponent(objectKey)}?expires=${expiresAt.getTime()}`,
        ),
      ),
      createSignedUploadUrl: jest.fn((input) => {
        uploadActions.set(input.mediaId, input);
        return Promise.resolve({
          headers: {
            'content-type': input.contentType,
            'x-goog-content-length-range': `${input.contentLength},${input.contentLength}`,
            'x-goog-if-generation-match': '0',
            'x-goog-meta-media-id': input.mediaId,
          },
          url: `https://storage.example.test/upload/${input.mediaId}`,
        });
      }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      getObjectMetadata: jest.fn((_bucket, objectKey) => {
        const upload = [...uploadActions.values()].find(
          (item) => item.objectKey === objectKey,
        );
        if (!upload) {
          throw new Error('Missing fake upload action.');
        }
        return Promise.resolve({
          contentEncoding: null,
          contentLength: upload.contentLength,
          contentType: upload.contentType,
          generation: `generation-${upload.mediaId}`,
          mediaId: upload.mediaId,
        });
      }),
      putJsonIfAbsent: jest.fn(),
      readObjectPrefix: jest.fn((_bucket, objectKey, length) => {
        const upload = [...uploadActions.values()].find(
          (item) => item.objectKey === objectKey,
        );
        if (!upload) {
          throw new Error('Missing fake upload action.');
        }
        const signature =
          upload.contentType === 'image/jpeg'
            ? Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
            : upload.contentType === 'image/png'
              ? Buffer.from([
                  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
                ])
              : Buffer.from('RIFF0000WEBP');
        return Promise.resolve(signature.subarray(0, length));
      }),
    };
    profileMedia = new ProfileMediaService(config, database, profiles, storage);
    moderation = new ProfileMediaModerationService(
      config,
      database,
      new IdempotencyService(database),
      profiles,
      storage,
    );
    cleanup = new ProfileMediaCleanupService(config, database, storage);
    const operator = await profiles.ensureUser(
      operatorPrincipal,
      database.connection,
    );
    operatorUserId = operator.id;
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', operatorUserId)
      .executeTakeFirstOrThrow();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('keeps signed actions ephemeral while enforcing moderation and cleanup', async () => {
    const first = await profileMedia.createUpload(
      userPrincipal,
      'profile-media-first-upload',
      { contentLength: 512, contentType: 'image/jpeg' },
    );
    expect(first).toEqual(
      expect.objectContaining({
        contentLength: 512,
        contentType: 'image/jpeg',
        status: 'pending_upload',
        upload: expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-content-length-range': '512,512',
            'x-goog-if-generation-match': '0',
          }),
          method: 'PUT',
        }),
      }),
    );
    await expect(
      profileMedia.createUpload(userPrincipal, 'profile-media-first-upload', {
        contentLength: 512,
        contentType: 'image/jpeg',
      }),
    ).resolves.toMatchObject({ id: first.id });
    await expect(
      profileMedia.createUpload(userPrincipal, 'profile-media-first-upload', {
        contentLength: 513,
        contentType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });

    await expect(
      profileMedia.completeUpload(userPrincipal, first.id),
    ).resolves.toEqual({ id: first.id, status: 'pending_review' });
    await expect(
      profileMedia.completeUpload(userPrincipal, first.id),
    ).resolves.toEqual({ id: first.id, status: 'pending_review' });

    const beforeApproval = await profileMedia.getAvatar(userPrincipal);
    expect(beforeApproval.active).toBeNull();
    expect(beforeApproval.latest).toMatchObject({
      id: first.id,
      readUrl: expect.stringContaining('/read/'),
      status: 'pending_review',
    });
    await expect(
      moderation.createReviewAction(first.id),
    ).resolves.toMatchObject({
      contentLength: 512,
      contentType: 'image/jpeg',
      id: first.id,
      url: expect.stringContaining('/read/'),
    });

    const approved = await moderation.decide({
      decision: 'approved',
      mediaId: first.id,
      operatorUserId,
      reason: 'Approved after avatar moderation review.',
      requestId: 'profile-media-first-decision',
    });
    await expect(
      moderation.decide({
        decision: 'approved',
        mediaId: first.id,
        operatorUserId,
        reason: 'Approved after avatar moderation review.',
        requestId: 'profile-media-first-decision',
      }),
    ).resolves.toEqual(approved);

    const firstStored = await database.connection
      .selectFrom('profile_media as media')
      .innerJoin('profiles as profile', 'profile.user_id', 'media.user_id')
      .select(['media.object_key', 'media.status', 'profile.avatar_object_key'])
      .where('media.id', '=', first.id)
      .executeTakeFirstOrThrow();
    expect(firstStored.status).toBe('approved');
    expect(firstStored.avatar_object_key).toBe(firstStored.object_key);

    const second = await profileMedia.createUpload(
      userPrincipal,
      'profile-media-rejected-upload',
      { contentLength: 640, contentType: 'image/png' },
    );
    await profileMedia.completeUpload(userPrincipal, second.id);
    await moderation.decide({
      decision: 'rejected',
      mediaId: second.id,
      operatorUserId,
      reason: 'Rejected because the submitted avatar violates policy.',
      requestId: 'profile-media-rejected-decision',
    });
    expect((await profileMedia.getAvatar(userPrincipal)).active?.id).toBe(
      first.id,
    );
    await expect(cleanup.process()).resolves.toEqual({
      deleted: 0,
      failed: 0,
    });

    const expired = await profileMedia.createUpload(
      userPrincipal,
      'profile-media-expired-upload',
      { contentLength: 400, contentType: 'image/webp' },
    );
    await database.connection
      .updateTable('profile_media')
      .set({ expires_at: sql<Date>`created_at + interval '1 millisecond'` })
      .where('id', 'in', [expired.id, second.id])
      .execute();

    await expect(cleanup.process()).resolves.toEqual({
      deleted: 2,
      failed: 0,
    });
    const cleanupStates = await database.connection
      .selectFrom('profile_media')
      .select(['id', 'object_deleted_at', 'status'])
      .where('id', 'in', [second.id, expired.id])
      .orderBy('id')
      .execute();
    expect(cleanupStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: second.id,
          object_deleted_at: expect.any(Date),
          status: 'rejected',
        }),
        expect.objectContaining({
          id: expired.id,
          object_deleted_at: expect.any(Date),
          status: 'expired',
        }),
      ]),
    );

    await expect(profileMedia.removeAvatar(userPrincipal)).resolves.toEqual({
      status: 'removed',
    });
    await expect(profileMedia.removeAvatar(userPrincipal)).resolves.toEqual({
      status: 'removed',
    });
    await expect(cleanup.process()).resolves.toEqual({
      deleted: 0,
      failed: 0,
    });
    await database.connection
      .updateTable('profile_media')
      .set({ expires_at: sql<Date>`created_at + interval '1 millisecond'` })
      .where('id', '=', first.id)
      .executeTakeFirstOrThrow();
    await expect(cleanup.process()).resolves.toEqual({
      deleted: 1,
      failed: 0,
    });
    expect((await profileMedia.getAvatar(userPrincipal)).active).toBeNull();

    const auditCount = await database.connection
      .selectFrom('operator_audit_events')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .where('entity_type', '=', 'profile_media')
      .executeTakeFirstOrThrow();
    expect(Number(auditCount.count)).toBe(2);
    const user = await database.connection
      .selectFrom('users')
      .select('id')
      .where('firebase_uid', '=', userPrincipal.firebaseUid)
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('privacy_requests')
      .values({
        confirmation_code: 'DELETE_MY_ACCOUNT',
        confirmed_at: new Date(),
        request_type: 'delete',
        status: 'requested',
        user_id: user.id,
      })
      .executeTakeFirstOrThrow();
    await expect(
      profileMedia.createUpload(
        userPrincipal,
        'profile-media-after-deletion-request',
        { contentLength: 512, contentType: 'image/jpeg' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ACCOUNT_DELETION_IN_PROGRESS',
      }),
    });
    const signedUrlsStored = await migrated.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM profile_media
       WHERE object_key LIKE 'http%'
          OR request_key LIKE 'http%'`,
    );
    expect(Number(signedUrlsStored.rows[0].count)).toBe(0);
  });
});

import { ConflictException, GoneException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { ProfilesService } from '../profiles/profiles.service';
import type { PrivateObjectStorage } from '../storage/private-object-storage';
import { PrivacyService } from './privacy.service';

describe('PrivacyService download actions', () => {
  const principal: AuthenticatedPrincipal = {
    emailVerified: true,
    firebaseUid: 'firebase-user',
    roles: ['user'],
    signInProvider: 'password',
    tokenIssuedAt: 1,
  };

  function setup(result: {
    export_expires_at: Date | null;
    request_type: 'delete' | 'export';
    result_deleted_at: Date | null;
    result_object_key: string | null;
    status: 'completed' | 'processing' | 'rejected' | 'requested';
  }) {
    const query = {
      executeTakeFirst: jest.fn().mockResolvedValue(result),
      select: jest.fn(),
      where: jest.fn(),
    };
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const transaction = { selectFrom: jest.fn(() => query) };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (callback: (value: typeof transaction) => unknown) =>
            callback(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const profiles = {
      ensureUser: jest.fn().mockResolvedValue({ id: 'internal-user' }),
    } as unknown as ProfilesService;
    const config = {
      get: jest.fn((key: string) =>
        key === 'PRIVACY_EXPORT_BUCKET' ? 'private-exports' : 300,
      ),
    } as unknown as ConfigService<Environment, true>;
    let signedExpiry: Date | undefined;
    const createSignedReadUrl = jest.fn(
      (_bucket: string, _objectKey: string, expiresAt: Date) => {
        signedExpiry = expiresAt;
        return Promise.resolve('https://storage.googleapis.com/signed');
      },
    );
    const objectStorage: PrivateObjectStorage = {
      createSignedReadUrl,
      createSignedUploadUrl: jest.fn(),
      deleteObject: jest.fn(),
      getObjectMetadata: jest.fn(),
      putJsonIfAbsent: jest.fn(),
      readObjectPrefix: jest.fn(),
    };
    const service = new PrivacyService(
      database,
      {} as IdempotencyService,
      profiles,
      config,
      objectStorage,
    );
    return {
      createSignedReadUrl,
      getSignedExpiry: () => signedExpiry,
      service,
    };
  }

  it('returns an owner-authorized URL bounded by the configured TTL', async () => {
    const exportExpiresAt = new Date(Date.now() + 10 * 60_000);
    const { createSignedReadUrl, getSignedExpiry, service } = setup({
      export_expires_at: exportExpiresAt,
      request_type: 'export',
      result_deleted_at: null,
      result_object_key: 'privacy-exports/user/request.json',
      status: 'completed',
    });
    const before = Date.now();

    await expect(
      service.createDownloadAction(
        principal,
        '10000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toEqual({
      expiresAt: expect.any(String),
      url: 'https://storage.googleapis.com/signed',
    });
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'private-exports',
      'privacy-exports/user/request.json',
      expect.any(Date),
    );
    const signedExpiry = getSignedExpiry();
    expect(signedExpiry).toBeDefined();
    if (!signedExpiry) {
      throw new Error('Expected a signed expiry.');
    }
    expect(signedExpiry.getTime()).toBeGreaterThanOrEqual(before + 299_000);
    expect(signedExpiry.getTime()).toBeLessThanOrEqual(before + 301_000);
    expect(signedExpiry.getTime()).toBeLessThan(exportExpiresAt.getTime());
  });

  it('does not issue a URL for a request that is still processing', async () => {
    const { createSignedReadUrl, service } = setup({
      export_expires_at: null,
      request_type: 'export',
      result_deleted_at: null,
      result_object_key: null,
      status: 'processing',
    });

    await expect(
      service.createDownloadAction(
        principal,
        '10000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('does not issue a URL after the export object is expired or deleted', async () => {
    const { createSignedReadUrl, service } = setup({
      export_expires_at: new Date(Date.now() - 1),
      request_type: 'export',
      result_deleted_at: new Date(),
      result_object_key: 'privacy-exports/user/request.json',
      status: 'completed',
    });

    await expect(
      service.createDownloadAction(
        principal,
        '10000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toBeInstanceOf(GoneException);
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });
});

import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { AccountIdentityAdmin } from '../auth/account-identity-admin';
import type { PrivateObjectStorage } from '../storage/private-object-storage';
import { PrivateObjectStorageError } from '../storage/private-object-storage';
import type { PrivacyExportBuilder } from './privacy-export.builder';
import type { PrivacyOperationsRepository } from './privacy-operations.repository';
import { PrivacyOperationsService } from './privacy-operations.service';
import type { ClaimedPrivacyJob } from './privacy-operations.types';

describe('PrivacyOperationsService', () => {
  const exportJob: ClaimedPrivacyJob = {
    attemptCount: 1,
    id: '10000000-0000-4000-8000-000000000001',
    leaseToken: '20000000-0000-4000-8000-000000000002',
    requestType: 'export',
    userId: '30000000-0000-4000-8000-000000000003',
  };

  function setup(
    options: {
      contentBucket?: string;
      enabled?: boolean;
      job?: ClaimedPrivacyJob;
    } = {},
  ) {
    const values: Record<string, unknown> = {
      GCP_STORAGE_BUCKET: options.contentBucket,
      PRIVACY_EXPORT_BUCKET: 'private-exports',
      PRIVACY_EXPORT_RETENTION_DAYS: 7,
      PRIVACY_JOB_LEASE_SECONDS: 600,
      PRIVACY_OPERATIONS_ENABLED: options.enabled ?? true,
      PRIVACY_PSEUDONYMIZATION_KEY: 'k'.repeat(32),
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService<Environment, true>;
    const exportBuilder = {
      build: jest.fn().mockResolvedValue({ account: { id: exportJob.userId } }),
    } as unknown as jest.Mocked<PrivacyExportBuilder>;
    const claimNext = jest
      .fn()
      .mockResolvedValueOnce(options.job ?? exportJob)
      .mockResolvedValueOnce(null);
    const completeDeletion = jest.fn();
    const completeExport = jest.fn();
    const listExpiredExportObjects = jest.fn().mockResolvedValue([]);
    const markExportObjectDeleted = jest.fn().mockResolvedValue(true);
    const recordFailure = jest.fn();
    const repository = {
      claimNext,
      completeDeletion,
      completeExport,
      getDeletionContext: jest.fn(),
      listExpiredExportObjects,
      markExportObjectDeleted,
      recordFailure,
    } as unknown as jest.Mocked<PrivacyOperationsRepository>;
    const deleteAccount = jest.fn();
    const identityAdmin: jest.Mocked<AccountIdentityAdmin> = {
      deleteAccount,
    };
    const deleteObject = jest.fn();
    const putJsonIfAbsent = jest
      .fn()
      .mockResolvedValue({ sha256: 'a'.repeat(64) });
    const objectStorage: jest.Mocked<PrivateObjectStorage> = {
      createSignedReadUrl: jest.fn(),
      createSignedUploadUrl: jest.fn(),
      deleteObject,
      getObjectMetadata: jest.fn(),
      putJsonIfAbsent,
      readObjectPrefix: jest.fn(),
    };
    const service = new PrivacyOperationsService(
      config,
      exportBuilder,
      repository,
      identityAdmin,
      objectStorage,
    );
    return {
      calls: {
        claimNext,
        completeDeletion,
        completeExport,
        deleteAccount,
        deleteObject,
        listExpiredExportObjects,
        markExportObjectDeleted,
        putJsonIfAbsent,
        recordFailure,
      },
      exportBuilder,
      identityAdmin,
      objectStorage,
      repository,
      service,
    };
  }

  it('builds, atomically stores, and completes an export', async () => {
    const { calls, service } = setup();

    await expect(service.processPending()).resolves.toEqual({
      completed: 1,
      expiredExportsDeleted: 0,
      failed: 0,
    });
    expect(calls.putJsonIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'private-exports',
        fileName: `gogymgo-data-export-${exportJob.id}.json`,
        objectKey: `privacy-exports/${exportJob.userId}/${exportJob.id}.json`,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(calls.completeExport).toHaveBeenCalledWith(
      exportJob,
      `privacy-exports/${exportJob.userId}/${exportJob.id}.json`,
      'a'.repeat(64),
      expect.any(Date),
    );
  });

  it('deletes external access and objects before pseudonymizing the database', async () => {
    const deletionJob = { ...exportJob, requestType: 'delete' as const };
    const { calls, repository, service } = setup({
      contentBucket: 'user-content',
      job: deletionJob,
    });
    repository.getDeletionContext.mockResolvedValue({
      activeMediaUploadExpiresAt: null,
      avatarObjectKeys: ['avatars/me.jpg', 'avatars/me-pending.jpg'],
      exportObjectKeys: ['privacy-exports/me/old.json'],
      firebaseUid: 'firebase-user',
      hasOpenCompetition: false,
      hasOpenPayout: false,
      userId: deletionJob.userId,
      userStatus: 'active',
    });

    await expect(service.processPending()).resolves.toEqual({
      completed: 1,
      expiredExportsDeleted: 0,
      failed: 0,
    });
    expect(calls.deleteAccount).toHaveBeenCalledWith('firebase-user');
    expect(calls.deleteObject).toHaveBeenCalledWith(
      'user-content',
      'avatars/me.jpg',
    );
    expect(calls.deleteObject).toHaveBeenCalledWith(
      'user-content',
      'avatars/me-pending.jpg',
    );
    expect(calls.deleteObject).toHaveBeenCalledWith(
      'private-exports',
      'privacy-exports/me/old.json',
    );
    expect(calls.completeDeletion).toHaveBeenCalledWith(
      deletionJob,
      expect.stringMatching(/^deleted:[a-f0-9]{64}$/),
      expect.stringMatching(/^GG-DELETED-[A-F0-9]{12}$/),
    );
    expect(calls.deleteObject.mock.invocationCallOrder[1]).toBeLessThan(
      calls.deleteAccount.mock.invocationCallOrder[0],
    );
  });

  it('does not remove access while a payout still requires the winner', async () => {
    const deletionJob = { ...exportJob, requestType: 'delete' as const };
    const { calls, repository, service } = setup({ job: deletionJob });
    repository.getDeletionContext.mockResolvedValue({
      activeMediaUploadExpiresAt: null,
      avatarObjectKeys: [],
      exportObjectKeys: [],
      firebaseUid: 'firebase-user',
      hasOpenCompetition: false,
      hasOpenPayout: true,
      userId: deletionJob.userId,
      userStatus: 'active',
    });

    await expect(service.processPending()).resolves.toEqual({
      completed: 0,
      expiredExportsDeleted: 0,
      failed: 1,
    });
    expect(calls.deleteAccount).not.toHaveBeenCalled();
    expect(calls.recordFailure).toHaveBeenCalledWith(
      deletionJob,
      'OPEN_PAYOUT_REQUIRES_REVIEW',
    );
  });

  it('waits for signed avatar upload actions to expire before erasure', async () => {
    const deletionJob = { ...exportJob, requestType: 'delete' as const };
    const { calls, repository, service } = setup({
      contentBucket: 'user-content',
      job: deletionJob,
    });
    repository.getDeletionContext.mockResolvedValue({
      activeMediaUploadExpiresAt: new Date(Date.now() + 60_000),
      avatarObjectKeys: ['avatars/pending.jpg'],
      exportObjectKeys: [],
      firebaseUid: 'firebase-user',
      hasOpenCompetition: false,
      hasOpenPayout: false,
      userId: deletionJob.userId,
      userStatus: 'active',
    });

    await expect(service.processPending()).resolves.toEqual({
      completed: 0,
      expiredExportsDeleted: 0,
      failed: 1,
    });
    expect(calls.deleteObject).not.toHaveBeenCalled();
    expect(calls.deleteAccount).not.toHaveBeenCalled();
    expect(calls.recordFailure).toHaveBeenCalledWith(
      deletionJob,
      'PROFILE_MEDIA_UPLOAD_ACTION_ACTIVE',
    );
  });

  it('records a safe retry code without abandoning the processing queue', async () => {
    const { calls, objectStorage, service } = setup();
    objectStorage.putJsonIfAbsent.mockRejectedValue(
      new PrivateObjectStorageError('OBJECT_WRITE_FAILED'),
    );

    await expect(service.processPending()).resolves.toEqual({
      completed: 0,
      expiredExportsDeleted: 0,
      failed: 1,
    });
    expect(calls.recordFailure).toHaveBeenCalledWith(
      exportJob,
      'OBJECT_WRITE_FAILED',
    );
  });

  it('deletes expired export objects even if bucket lifecycle processing lags', async () => {
    const { calls, service } = setup();
    calls.claimNext.mockReset().mockResolvedValue(null);
    calls.listExpiredExportObjects.mockResolvedValue([
      {
        objectKey: 'privacy-exports/me/expired.json',
        privacyRequestId: exportJob.id,
      },
    ]);

    await expect(service.processPending()).resolves.toEqual({
      completed: 0,
      expiredExportsDeleted: 1,
      failed: 0,
    });
    expect(calls.deleteObject).toHaveBeenCalledWith(
      'private-exports',
      'privacy-exports/me/expired.json',
    );
    expect(calls.markExportObjectDeleted).toHaveBeenCalledWith(
      exportJob.id,
      'privacy-exports/me/expired.json',
      expect.any(Date),
    );
  });

  it('does no work when privacy execution is disabled', async () => {
    const { calls, service } = setup({ enabled: false });
    await expect(service.processPending()).resolves.toEqual({
      completed: 0,
      expiredExportsDeleted: 0,
      failed: 0,
    });
    expect(calls.claimNext).not.toHaveBeenCalled();
  });
});

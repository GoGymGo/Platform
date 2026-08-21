import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { PrivateObjectStorage } from '../storage/private-object-storage';
import { ProfileMediaCleanupService } from './profile-media-cleanup.service';

function builder(result?: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'forUpdate',
    'orderBy',
    'returning',
    'select',
    'set',
    'skipLocked',
    'where',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query.execute = jest.fn().mockResolvedValue([]);
  query.executeTakeFirst = jest.fn().mockResolvedValue(result);
  query.executeTakeFirstOrThrow = jest.fn().mockResolvedValue(result ?? {});
  return query;
}

function config(): ConfigService<Environment, true> {
  return {
    get: jest.fn((key: keyof Environment) => {
      if (key === 'PROFILE_MEDIA_ENABLED') return true;
      if (key === 'PRIVATE_CONTENT_BUCKET') return 'private-bucket';
      if (key === 'PROFILE_MEDIA_CLEANUP_LEASE_SECONDS') return 600;
      return undefined;
    }),
  } as unknown as ConfigService<Environment, true>;
}

describe('ProfileMediaCleanupService', () => {
  it('claims cleanup candidates with a locked, skip-locked lease query', async () => {
    const selection: Record<string, jest.Mock> = {};
    for (const method of [
      'forUpdate',
      'orderBy',
      'select',
      'skipLocked',
      'where',
    ]) {
      selection[method] = jest.fn(() => selection);
    }
    selection.executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const transaction = { selectFrom: jest.fn(() => selection) };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (handler: (value: typeof transaction) => unknown) =>
            handler(transaction),
        })),
      },
    } as unknown as DatabaseService;
    const deleteObject = jest.fn();
    const objectStorage = { deleteObject } as unknown as PrivateObjectStorage;
    const service = new ProfileMediaCleanupService(
      config(),
      database,
      objectStorage,
    );

    await expect(service.process()).resolves.toEqual({ deleted: 0, failed: 0 });
    expect(selection.forUpdate).toHaveBeenCalledTimes(1);
    expect(selection.skipLocked).toHaveBeenCalledTimes(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('deletes the exact stored object version and fences completion to the lease', async () => {
    const selection = builder();
    selection.executeTakeFirst
      .mockResolvedValueOnce({
        id: 'media-id',
        object_key: 'avatars/member/media.jpg',
        status: 'rejected',
        storage_version_id: 'storage-version-1',
      })
      .mockResolvedValue(undefined);
    const claim = builder({ cleanup_attempt_count: 1 });
    const completion = builder({ id: 'media-id' });
    const transaction = {
      selectFrom: jest.fn(() => selection),
      updateTable: jest.fn(() => claim),
    };
    const updateTable = jest.fn(() => completion);
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (handler: (value: typeof transaction) => unknown) =>
            handler(transaction),
        })),
        updateTable,
      },
    } as unknown as DatabaseService;
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const service = new ProfileMediaCleanupService(config(), database, {
      deleteObject,
    } as unknown as PrivateObjectStorage);

    await expect(service.process()).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(deleteObject).toHaveBeenCalledWith(
      'private-bucket',
      'avatars/member/media.jpg',
      'storage-version-1',
    );
    expect(completion.where).toHaveBeenCalledWith(
      'cleanup_lease_token',
      '=',
      expect.any(String),
    );
    expect(completion.where).toHaveBeenCalledWith(
      'cleanup_lease_expires_at',
      '>',
      expect.any(Date),
    );
  });

  it('records a bounded retry behind the same lease after a storage failure', async () => {
    const selection = builder();
    selection.executeTakeFirst
      .mockResolvedValueOnce({
        id: 'media-id',
        object_key: 'avatars/member/media.jpg',
        status: 'superseded',
        storage_version_id: null,
      })
      .mockResolvedValue(undefined);
    const claim = builder({ cleanup_attempt_count: 2 });
    const failure = builder();
    const transaction = {
      selectFrom: jest.fn(() => selection),
      updateTable: jest.fn(() => claim),
    };
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (handler: (value: typeof transaction) => unknown) =>
            handler(transaction),
        })),
        updateTable: jest.fn(() => failure),
      },
    } as unknown as DatabaseService;
    const storageError = new Error('secret provider detail');
    storageError.name = 'ObjectDeleteRetryableError';
    const deleteObject = jest.fn().mockRejectedValue(storageError);
    const service = new ProfileMediaCleanupService(config(), database, {
      deleteObject,
    } as unknown as PrivateObjectStorage);

    await expect(service.process()).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(failure.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanup_failure_code: 'ObjectDeleteRetryableError',
        cleanup_lease_expires_at: null,
        cleanup_lease_token: null,
        cleanup_next_attempt_at: expect.any(Date),
      }),
    );
    expect(failure.where).toHaveBeenCalledWith(
      'cleanup_lease_token',
      '=',
      expect.any(String),
    );
    expect(JSON.stringify(failure.set.mock.calls)).not.toContain(
      'secret provider detail',
    );
  });

  it('does not mark a deleted object complete after its lease is lost', async () => {
    const selection = builder();
    selection.executeTakeFirst
      .mockResolvedValueOnce({
        id: 'media-id',
        object_key: 'avatars/member/media.jpg',
        status: 'removed',
        storage_version_id: null,
      })
      .mockResolvedValue(undefined);
    const claim = builder({ cleanup_attempt_count: 1 });
    const lostCompletion = builder(undefined);
    const fencedFailure = builder();
    const transaction = {
      selectFrom: jest.fn(() => selection),
      updateTable: jest.fn(() => claim),
    };
    const updateTable = jest
      .fn()
      .mockReturnValueOnce(lostCompletion)
      .mockReturnValueOnce(fencedFailure);
    const database = {
      connection: {
        transaction: jest.fn(() => ({
          execute: (handler: (value: typeof transaction) => unknown) =>
            handler(transaction),
        })),
        updateTable,
      },
    } as unknown as DatabaseService;
    const service = new ProfileMediaCleanupService(config(), database, {
      deleteObject: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrivateObjectStorage);

    await expect(service.process()).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(fencedFailure.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanup_failure_code: 'ProfileMediaCleanupLeaseLostError',
      }),
    );
    expect(fencedFailure.where).toHaveBeenCalledWith(
      'cleanup_lease_token',
      '=',
      expect.any(String),
    );
  });
});

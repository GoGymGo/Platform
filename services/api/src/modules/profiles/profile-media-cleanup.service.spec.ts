import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { PrivateObjectStorage } from '../storage/private-object-storage';
import { ProfileMediaCleanupService } from './profile-media-cleanup.service';

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
    const config = {
      get: jest.fn((key: keyof Environment) => {
        if (key === 'PROFILE_MEDIA_ENABLED') return true;
        if (key === 'PRIVATE_CONTENT_BUCKET') return 'private-bucket';
        if (key === 'PROFILE_MEDIA_CLEANUP_LEASE_SECONDS') return 600;
        return undefined;
      }),
    } as unknown as ConfigService<Environment, true>;
    const deleteObject = jest.fn();
    const objectStorage = { deleteObject } as unknown as PrivateObjectStorage;
    const service = new ProfileMediaCleanupService(
      config,
      database,
      objectStorage,
    );

    await expect(service.process()).resolves.toEqual({ deleted: 0, failed: 0 });
    expect(selection.forUpdate).toHaveBeenCalledTimes(1);
    expect(selection.skipLocked).toHaveBeenCalledTimes(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

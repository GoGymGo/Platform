import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import {
  WorkerHeartbeatLeaseLostError,
  WorkerObservabilityService,
} from './worker-observability.service';

function workerResult() {
  return {
    competitionPeriodsSettled: 0,
    competitionsActivated: 0,
    competitionsCancelled: 0,
    incompleteGymSessionsExpired: 0,
    notificationsSent: 0,
    privacyExportsDeleted: 0,
    privacyOperationsCompleted: 0,
    privacyOperationsFailed: 0,
    profileMediaCleanupFailed: 0,
    profileMediaDeleted: 0,
    socialInvitationsExpired: 0,
    socialInvitationsPurged: 0,
  };
}

describe('WorkerObservabilityService', () => {
  it('fences a stale worker instance from overwriting a newer heartbeat', async () => {
    const update: Record<string, jest.Mock> = {};
    for (const method of ['returning', 'set', 'where']) {
      update[method] = jest.fn(() => update);
    }
    update.executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const database = {
      connection: { updateTable: jest.fn(() => update) },
    } as unknown as DatabaseService;
    const config = {
      get: jest.fn().mockReturnValue(0),
    } as unknown as ConfigService<Environment, true>;
    const service = new WorkerObservabilityService(database, config);

    await expect(
      service.runObserved('old-instance', () =>
        Promise.resolve(workerResult()),
      ),
    ).rejects.toBeInstanceOf(WorkerHeartbeatLeaseLostError);
    expect(update.where).toHaveBeenCalledWith(
      'instance_id',
      '=',
      'old-instance',
    );
  });
});

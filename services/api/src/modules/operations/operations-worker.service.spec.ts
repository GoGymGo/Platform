import { CompetitionLifecycleService } from '../competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../competitions/competition-scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivacyOperationsService } from '../privacy/privacy-operations.service';
import { ProfileMediaCleanupService } from '../profiles/profile-media-cleanup.service';
import { OperationsWorkerService } from './operations-worker.service';

function createWorker(overrides?: {
  competitionLifecycle?: jest.Mock;
  competitionScoring?: jest.Mock;
  notifications?: jest.Mock;
  privacy?: jest.Mock;
  profileMedia?: jest.Mock;
}): {
  calls: {
    competitionLifecycle: jest.Mock;
    competitionScoring: jest.Mock;
    notifications: jest.Mock;
    privacy: jest.Mock;
    profileMedia: jest.Mock;
  };
  worker: OperationsWorkerService;
} {
  const calls = {
    competitionLifecycle:
      overrides?.competitionLifecycle ??
      jest.fn().mockResolvedValue({ activated: 2, cancelled: 1 }),
    competitionScoring:
      overrides?.competitionScoring ?? jest.fn().mockResolvedValue(3),
    notifications: overrides?.notifications ?? jest.fn().mockResolvedValue(4),
    privacy:
      overrides?.privacy ??
      jest.fn().mockResolvedValue({
        completed: 5,
        expiredExportsDeleted: 6,
        failed: 7,
      }),
    profileMedia:
      overrides?.profileMedia ??
      jest.fn().mockResolvedValue({ deleted: 8, failed: 9 }),
  };

  return {
    calls,
    worker: new OperationsWorkerService(
      {
        processDueStarts: calls.competitionLifecycle,
      } as unknown as CompetitionLifecycleService,
      {
        processDuePeriods: calls.competitionScoring,
      } as unknown as CompetitionScoringService,
      {
        processPending: calls.notifications,
      } as unknown as NotificationsService,
      { process: calls.profileMedia } as unknown as ProfileMediaCleanupService,
      { processPending: calls.privacy } as unknown as PrivacyOperationsService,
    ),
  };
}

describe('OperationsWorkerService', () => {
  it('reports the completed work from every subsystem', async () => {
    const { worker } = createWorker();

    await expect(worker.runOnce()).resolves.toEqual({
      competitionsActivated: 2,
      competitionsCancelled: 1,
      competitionPeriodsSettled: 3,
      notificationsSent: 4,
      privacyExportsDeleted: 6,
      privacyOperationsCompleted: 5,
      privacyOperationsFailed: 7,
      profileMediaCleanupFailed: 9,
      profileMediaDeleted: 8,
    });
  });

  it('continues running later subsystems before reporting a batch failure', async () => {
    const competitionLifecycle = jest
      .fn()
      .mockRejectedValue(new Error('database timeout'));
    const { calls, worker } = createWorker({ competitionLifecycle });

    await expect(worker.runOnce()).rejects.toBeInstanceOf(AggregateError);
    expect(calls.competitionScoring).toHaveBeenCalledTimes(1);
    expect(calls.profileMedia).toHaveBeenCalledTimes(1);
    expect(calls.privacy).toHaveBeenCalledTimes(1);
    expect(calls.notifications).toHaveBeenCalledTimes(1);
  });
});

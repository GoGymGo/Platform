import { CompetitionLifecycleService } from '../competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../competitions/competition-scoring.service';
import { GymsService } from '../gyms/gyms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivacyOperationsService } from '../privacy/privacy-operations.service';
import { ProfileMediaCleanupService } from '../profiles/profile-media-cleanup.service';
import { SocialInvitationCleanupService } from '../social/social-invitation-cleanup.service';
import { OperationsWorkerService } from './operations-worker.service';
import { PartnerApplicationRetentionService } from './partner-application-retention.service';

function createWorker(overrides?: {
  competitionLifecycle?: jest.Mock;
  competitionScoring?: jest.Mock;
  gyms?: jest.Mock;
  landingIntake?: jest.Mock;
  notifications?: jest.Mock;
  partners?: jest.Mock;
  privacy?: jest.Mock;
  profileMedia?: jest.Mock;
  socialInvitations?: jest.Mock;
}): {
  calls: {
    competitionLifecycle: jest.Mock;
    competitionScoring: jest.Mock;
    gyms: jest.Mock;
    landingIntake: jest.Mock;
    notifications: jest.Mock;
    partners: jest.Mock;
    privacy: jest.Mock;
    profileMedia: jest.Mock;
    socialInvitations: jest.Mock;
  };
  worker: OperationsWorkerService;
} {
  const calls = {
    competitionLifecycle:
      overrides?.competitionLifecycle ??
      jest.fn().mockResolvedValue({ activated: 2, cancelled: 1 }),
    competitionScoring:
      overrides?.competitionScoring ?? jest.fn().mockResolvedValue(3),
    gyms: overrides?.gyms ?? jest.fn().mockResolvedValue(10),
    landingIntake:
      overrides?.landingIntake ??
      jest.fn().mockResolvedValue({ interestDeleted: 13, waitlistDeleted: 14 }),
    notifications: overrides?.notifications ?? jest.fn().mockResolvedValue(4),
    partners: overrides?.partners ?? jest.fn().mockResolvedValue(15),
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
    socialInvitations:
      overrides?.socialInvitations ??
      jest.fn().mockResolvedValue({ expired: 11, purged: 12 }),
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
        expireIncompleteSessions: calls.gyms,
        purgeExpiredLandingIntake: calls.landingIntake,
      } as unknown as GymsService,
      {
        processPending: calls.notifications,
      } as unknown as NotificationsService,
      {
        purgeExpired: calls.partners,
      } as unknown as PartnerApplicationRetentionService,
      { process: calls.profileMedia } as unknown as ProfileMediaCleanupService,
      { processPending: calls.privacy } as unknown as PrivacyOperationsService,
      {
        process: calls.socialInvitations,
      } as unknown as SocialInvitationCleanupService,
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
      incompleteGymSessionsExpired: 10,
      landingInterestDeleted: 13,
      landingWaitlistDeleted: 14,
      notificationsSent: 4,
      partnerApplicationsDeleted: 15,
      privacyExportsDeleted: 6,
      privacyOperationsCompleted: 5,
      privacyOperationsFailed: 7,
      profileMediaCleanupFailed: 9,
      profileMediaDeleted: 8,
      socialInvitationsExpired: 11,
      socialInvitationsPurged: 12,
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
    expect(calls.gyms).toHaveBeenCalledTimes(1);
    expect(calls.landingIntake).toHaveBeenCalledTimes(1);
    expect(calls.privacy).toHaveBeenCalledTimes(1);
    expect(calls.notifications).toHaveBeenCalledTimes(1);
    expect(calls.partners).toHaveBeenCalledTimes(1);
    expect(calls.socialInvitations).toHaveBeenCalledTimes(1);
  });
});

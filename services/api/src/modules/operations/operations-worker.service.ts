import { Injectable } from '@nestjs/common';
import { CompetitionLifecycleService } from '../competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../competitions/competition-scoring.service';
import { GymsService } from '../gyms/gyms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivacyOperationsService } from '../privacy/privacy-operations.service';
import { ProfileMediaCleanupService } from '../profiles/profile-media-cleanup.service';
import { SocialInvitationCleanupService } from '../social/social-invitation-cleanup.service';

export interface WorkerRunResult {
  competitionsActivated: number;
  competitionsCancelled: number;
  competitionPeriodsSettled: number;
  incompleteGymSessionsExpired: number;
  landingInterestDeleted: number;
  landingWaitlistDeleted: number;
  notificationsSent: number;
  profileMediaCleanupFailed: number;
  profileMediaDeleted: number;
  privacyExportsDeleted: number;
  privacyOperationsCompleted: number;
  privacyOperationsFailed: number;
  socialInvitationsExpired: number;
  socialInvitationsPurged: number;
}

@Injectable()
export class OperationsWorkerService {
  constructor(
    private readonly competitions: CompetitionLifecycleService,
    private readonly competitionScoring: CompetitionScoringService,
    private readonly gyms: GymsService,
    private readonly notifications: NotificationsService,
    private readonly profileMedia: ProfileMediaCleanupService,
    private readonly privacy: PrivacyOperationsService,
    private readonly socialInvitations: SocialInvitationCleanupService,
  ) {}

  async runOnce(): Promise<WorkerRunResult> {
    const failures: unknown[] = [];
    const attempt = async <Result>(
      operation: () => Promise<Result>,
      fallback: Result,
    ): Promise<Result> => {
      try {
        return await operation();
      } catch (error) {
        failures.push(error);
        return fallback;
      }
    };

    const competitions = await attempt(
      () => this.competitions.processDueStarts(),
      { activated: 0, cancelled: 0 },
    );
    const competitionPeriodsSettled = await attempt(
      () => this.competitionScoring.processDuePeriods(),
      0,
    );
    const incompleteGymSessionsExpired = await attempt(
      () => this.gyms.expireIncompleteSessions(),
      0,
    );
    const landingIntake = await attempt(
      () => this.gyms.purgeExpiredLandingIntake(),
      { interestDeleted: 0, waitlistDeleted: 0 },
    );
    const profileMedia = await attempt(() => this.profileMedia.process(), {
      deleted: 0,
      failed: 0,
    });
    const privacy = await attempt(() => this.privacy.processPending(), {
      completed: 0,
      expiredExportsDeleted: 0,
      failed: 0,
    });
    const notificationsSent = await attempt(
      () => this.notifications.processPending(),
      0,
    );
    const socialInvitations = await attempt(
      () => this.socialInvitations.process(),
      { expired: 0, purged: 0 },
    );

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `${failures.length} worker operation(s) failed.`,
      );
    }

    return {
      competitionsActivated: competitions.activated,
      competitionsCancelled: competitions.cancelled,
      competitionPeriodsSettled,
      incompleteGymSessionsExpired,
      landingInterestDeleted: landingIntake.interestDeleted,
      landingWaitlistDeleted: landingIntake.waitlistDeleted,
      notificationsSent,
      profileMediaCleanupFailed: profileMedia.failed,
      profileMediaDeleted: profileMedia.deleted,
      privacyExportsDeleted: privacy.expiredExportsDeleted,
      privacyOperationsCompleted: privacy.completed,
      privacyOperationsFailed: privacy.failed,
      socialInvitationsExpired: socialInvitations.expired,
      socialInvitationsPurged: socialInvitations.purged,
    };
  }
}

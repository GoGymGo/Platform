import { Injectable } from '@nestjs/common';
import { CompetitionLifecycleService } from '../competitions/competition-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivacyOperationsService } from '../privacy/privacy-operations.service';
import { ProfileMediaCleanupService } from '../profiles/profile-media-cleanup.service';

export interface WorkerRunResult {
  competitionsActivated: number;
  competitionsCancelled: number;
  notificationsSent: number;
  profileMediaCleanupFailed: number;
  profileMediaDeleted: number;
  privacyExportsDeleted: number;
  privacyOperationsCompleted: number;
  privacyOperationsFailed: number;
}

@Injectable()
export class OperationsWorkerService {
  constructor(
    private readonly competitions: CompetitionLifecycleService,
    private readonly notifications: NotificationsService,
    private readonly profileMedia: ProfileMediaCleanupService,
    private readonly privacy: PrivacyOperationsService,
  ) {}

  async runOnce(): Promise<WorkerRunResult> {
    const competitions = await this.competitions.processDueStarts();
    const profileMedia = await this.profileMedia.process();
    const privacy = await this.privacy.processPending();
    const notificationsSent = await this.notifications.processPending();
    return {
      competitionsActivated: competitions.activated,
      competitionsCancelled: competitions.cancelled,
      notificationsSent,
      profileMediaCleanupFailed: profileMedia.failed,
      profileMediaDeleted: profileMedia.deleted,
      privacyExportsDeleted: privacy.expiredExportsDeleted,
      privacyOperationsCompleted: privacy.completed,
      privacyOperationsFailed: privacy.failed,
    };
  }
}

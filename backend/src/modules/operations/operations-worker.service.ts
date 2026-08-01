import { Injectable } from '@nestjs/common';
import { CompetitionLifecycleService } from '../competitions/competition-lifecycle.service';
import { CompetitionScoringService } from '../competitions/competition-scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivacyOperationsService } from '../privacy/privacy-operations.service';
import { ProfileMediaCleanupService } from '../profiles/profile-media-cleanup.service';

export interface WorkerRunResult {
  competitionsActivated: number;
  competitionsCancelled: number;
  competitionPeriodsSettled: number;
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
    private readonly competitionScoring: CompetitionScoringService,
    private readonly notifications: NotificationsService,
    private readonly profileMedia: ProfileMediaCleanupService,
    private readonly privacy: PrivacyOperationsService,
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
      notificationsSent,
      profileMediaCleanupFailed: profileMedia.failed,
      profileMediaDeleted: profileMedia.deleted,
      privacyExportsDeleted: privacy.expiredExportsDeleted,
      privacyOperationsCompleted: privacy.completed,
      privacyOperationsFailed: privacy.failed,
    };
  }
}

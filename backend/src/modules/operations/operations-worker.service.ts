import { Injectable } from '@nestjs/common';
import { CompetitionLifecycleService } from '../competitions/competition-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';
import { HyperwalletWebhooksService } from '../payouts/webhooks/hyperwallet-webhooks.service';
import { PrivacyOperationsService } from '../privacy/privacy-operations.service';
import { ProfileMediaCleanupService } from '../profiles/profile-media-cleanup.service';

export interface WorkerRunResult {
  competitionsActivated: number;
  competitionsCancelled: number;
  notificationsSent: number;
  paymentsReconciled: number;
  profileMediaCleanupFailed: number;
  profileMediaDeleted: number;
  privacyExportsDeleted: number;
  privacyOperationsCompleted: number;
  privacyOperationsFailed: number;
  webhooksProcessed: number;
}

@Injectable()
export class OperationsWorkerService {
  constructor(
    private readonly competitions: CompetitionLifecycleService,
    private readonly notifications: NotificationsService,
    private readonly payouts: PayoutsService,
    private readonly profileMedia: ProfileMediaCleanupService,
    private readonly privacy: PrivacyOperationsService,
    private readonly webhooks: HyperwalletWebhooksService,
  ) {}

  async runOnce(): Promise<WorkerRunResult> {
    const competitions = await this.competitions.processDueStarts();
    const webhooksProcessed = await this.webhooks.processPending();
    const paymentsReconciled = await this.payouts.reconcileUncertainPayments();
    const profileMedia = await this.profileMedia.process();
    const privacy = await this.privacy.processPending();
    const notificationsSent = await this.notifications.processPending();
    return {
      competitionsActivated: competitions.activated,
      competitionsCancelled: competitions.cancelled,
      notificationsSent,
      paymentsReconciled,
      profileMediaCleanupFailed: profileMedia.failed,
      profileMediaDeleted: profileMedia.deleted,
      privacyExportsDeleted: privacy.expiredExportsDeleted,
      privacyOperationsCompleted: privacy.completed,
      privacyOperationsFailed: privacy.failed,
      webhooksProcessed,
    };
  }
}

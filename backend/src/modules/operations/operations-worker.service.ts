import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';
import { HyperwalletWebhooksService } from '../payouts/webhooks/hyperwallet-webhooks.service';

export interface WorkerRunResult {
  notificationsSent: number;
  paymentsReconciled: number;
  webhooksProcessed: number;
}

@Injectable()
export class OperationsWorkerService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly payouts: PayoutsService,
    private readonly webhooks: HyperwalletWebhooksService,
  ) {}

  async runOnce(): Promise<WorkerRunResult> {
    const webhooksProcessed = await this.webhooks.processPending();
    const paymentsReconciled = await this.payouts.reconcileUncertainPayments();
    const notificationsSent = await this.notifications.processPending();
    return { notificationsSent, paymentsReconciled, webhooksProcessed };
  }
}

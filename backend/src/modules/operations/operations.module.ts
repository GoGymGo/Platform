import { Module } from '@nestjs/common';
import { CompetitionsModule } from '../competitions/competitions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { OperationsWorkerService } from './operations-worker.service';

@Module({
  exports: [OperationsWorkerService],
  imports: [
    CompetitionsModule,
    NotificationsModule,
    PayoutsModule,
    PrivacyModule,
  ],
  providers: [OperationsWorkerService],
})
export class OperationsModule {}

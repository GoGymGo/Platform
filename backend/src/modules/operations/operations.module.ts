import { Module } from '@nestjs/common';
import { CompetitionsModule } from '../competitions/competitions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { OperationsWorkerService } from './operations-worker.service';
import { WorkerObservabilityService } from './worker-observability.service';

@Module({
  exports: [OperationsWorkerService, WorkerObservabilityService],
  imports: [
    CompetitionsModule,
    NotificationsModule,
    PayoutsModule,
    PrivacyModule,
    ProfilesModule,
  ],
  providers: [OperationsWorkerService, WorkerObservabilityService],
})
export class OperationsModule {}

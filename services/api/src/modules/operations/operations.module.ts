import { Module } from '@nestjs/common';
import { CompetitionsModule } from '../competitions/competitions.module';
import { DrawsModule } from '../draws/draws.module';
import { GymsModule } from '../gyms/gyms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SocialModule } from '../social/social.module';
import { OperationsWorkerService } from './operations-worker.service';
import { WorkerObservabilityService } from './worker-observability.service';
import { PartnerApplicationRetentionService } from './partner-application-retention.service';

@Module({
  exports: [OperationsWorkerService, WorkerObservabilityService],
  imports: [
    CompetitionsModule,
    DrawsModule,
    GymsModule,
    NotificationsModule,
    PrivacyModule,
    ProfilesModule,
    SocialModule,
  ],
  providers: [
    OperationsWorkerService,
    PartnerApplicationRetentionService,
    WorkerObservabilityService,
  ],
})
export class OperationsModule {}

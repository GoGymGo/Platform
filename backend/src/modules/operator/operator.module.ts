import { Module } from '@nestjs/common';
import { DrawsModule } from '../draws/draws.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AdminAuthorizationModule } from './admin-authorization.module';
import { AdminCompetitionConfigurationService } from './admin-competition-configuration.service';
import { AdminConfigurationController } from './admin-configuration.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminRegionConfigurationService } from './admin-region-configuration.service';
import { AdminWorkoutConfigurationService } from './admin-workout-configuration.service';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';

@Module({
  controllers: [AdminConfigurationController, OperatorController],
  imports: [
    AdminAuthorizationModule,
    DrawsModule,
    NotificationsModule,
    ProfilesModule,
    SessionsModule,
  ],
  providers: [
    AdminCompetitionConfigurationService,
    AdminDashboardService,
    AdminRegionConfigurationService,
    AdminWorkoutConfigurationService,
    OperatorService,
  ],
})
export class OperatorModule {}

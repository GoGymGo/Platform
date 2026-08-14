import { Module } from '@nestjs/common';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { ProfilesModule } from '../profiles/profiles.module';
import {
  GymOperatorController,
  GymScansController,
  MemberRegionWaitlistController,
  PilotSubmissionsController,
} from './gyms.controller';
import { GymsService } from './gyms.service';

@Module({
  controllers: [
    GymOperatorController,
    GymScansController,
    MemberRegionWaitlistController,
    PilotSubmissionsController,
  ],
  exports: [GymsService],
  imports: [AdminAuthorizationModule, ProfilesModule],
  providers: [GymsService],
})
export class GymsModule {}

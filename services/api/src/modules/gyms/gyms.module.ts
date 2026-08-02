import { Module } from '@nestjs/common';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { ProfilesModule } from '../profiles/profiles.module';
import {
  GymOperatorController,
  GymScansController,
  PilotSubmissionsController,
} from './gyms.controller';
import { GymsService } from './gyms.service';

@Module({
  controllers: [
    GymOperatorController,
    GymScansController,
    PilotSubmissionsController,
  ],
  exports: [GymsService],
  imports: [AdminAuthorizationModule, ProfilesModule],
  providers: [GymsService],
})
export class GymsModule {}

import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { AdminAuthorizationService } from './admin-authorization.service';

@Module({
  exports: [AdminAuthorizationService],
  imports: [ProfilesModule],
  providers: [AdminAuthorizationService],
})
export class AdminAuthorizationModule {}

import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { SocialInvitationCleanupService } from './social-invitation-cleanup.service';

@Module({
  controllers: [SocialController],
  imports: [ProfilesModule],
  exports: [SocialInvitationCleanupService],
  providers: [SocialInvitationCleanupService, SocialService],
})
export class SocialModule {}

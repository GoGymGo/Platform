import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { PrivateObjectStorageModule } from '../storage/private-object-storage.module';
import { ProfileMediaController } from './profile-media.controller';
import { ProfileMediaCleanupService } from './profile-media-cleanup.service';
import { ProfileMediaModerationService } from './profile-media-moderation.service';
import { ProfileMediaService } from './profile-media.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  controllers: [ProfileMediaController, ProfilesController],
  exports: [
    ProfileMediaCleanupService,
    ProfileMediaModerationService,
    ProfileMediaService,
    ProfilesService,
  ],
  imports: [IdempotencyModule, PrivateObjectStorageModule],
  providers: [
    ProfileMediaCleanupService,
    ProfileMediaModerationService,
    ProfileMediaService,
    ProfilesService,
  ],
})
export class ProfilesModule {}

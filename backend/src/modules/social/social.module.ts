import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController],
  imports: [ProfilesModule],
  providers: [SocialService],
})
export class SocialModule {}

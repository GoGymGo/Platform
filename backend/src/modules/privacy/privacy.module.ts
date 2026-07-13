import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  controllers: [PrivacyController],
  imports: [ProfilesModule],
  providers: [PrivacyService],
})
export class PrivacyModule {}

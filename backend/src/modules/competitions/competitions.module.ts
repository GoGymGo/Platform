import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LegalModule } from '../legal/legal.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { CompetitionLifecycleService } from './competition-lifecycle.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';

@Module({
  controllers: [CompetitionsController],
  exports: [CompetitionLifecycleService, CompetitionsService],
  imports: [LegalModule, NotificationsModule, ProfilesModule],
  providers: [CompetitionLifecycleService, CompetitionsService],
})
export class CompetitionsModule {}

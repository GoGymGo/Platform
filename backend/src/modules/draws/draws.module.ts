import { Module } from '@nestjs/common';
import { CompetitionsModule } from '../competitions/competitions.module';
import { RewardsModule } from '../rewards/rewards.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DrawsService } from './draws.service';

@Module({
  exports: [DrawsService],
  imports: [CompetitionsModule, NotificationsModule, RewardsModule],
  providers: [DrawsService],
})
export class DrawsModule {}

import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DrawsService } from './draws.service';

@Module({
  exports: [DrawsService],
  imports: [NotificationsModule, RewardsModule],
  providers: [DrawsService],
})
export class DrawsModule {}

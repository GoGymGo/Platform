import { Module } from '@nestjs/common';
import { CompetitionsModule } from '../competitions/competitions.module';
import { RewardsModule } from '../rewards/rewards.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DrawsService } from './draws.service';
import { AutomaticDrawSettlementService } from './automatic-draw-settlement.service';

@Module({
  exports: [AutomaticDrawSettlementService, DrawsService],
  imports: [CompetitionsModule, NotificationsModule, RewardsModule],
  providers: [AutomaticDrawSettlementService, DrawsService],
})
export class DrawsModule {}

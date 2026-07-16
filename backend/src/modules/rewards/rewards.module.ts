import { Module } from '@nestjs/common';
import { AdminAuthorizationModule } from '../operator/admin-authorization.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { AdminRewardsController } from './admin-rewards.controller';
import { AdminRewardsService } from './admin-rewards.service';
import { AdminRewardAwardsController } from './admin-reward-awards.controller';
import { AdminRewardAwardsService } from './admin-reward-awards.service';
import { RewardCodeCipherService } from './reward-code-cipher.service';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  controllers: [
    AdminRewardAwardsController,
    AdminRewardsController,
    RewardsController,
  ],
  exports: [RewardsService],
  imports: [AdminAuthorizationModule, ProfilesModule],
  providers: [
    AdminRewardAwardsService,
    AdminRewardsService,
    RewardCodeCipherService,
    RewardsService,
  ],
})
export class RewardsModule {}

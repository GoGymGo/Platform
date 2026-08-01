import { ConflictException } from '@nestjs/common';
import type {
  RewardAwardStatus,
  RewardType,
} from '../../database/database.types';
import { RewardAwardStatusAction } from './dto/reward.dto';

export function transitionRewardAwardStatus(
  current: RewardAwardStatus,
  rewardType: RewardType,
  action: RewardAwardStatusAction,
): RewardAwardStatus {
  if (action === RewardAwardStatusAction.CANCEL && current === 'awarded') {
    return 'cancelled';
  }
  if (
    action === RewardAwardStatusAction.FULFILL &&
    rewardType === 'physical' &&
    current === 'claimed'
  ) {
    return 'fulfilled';
  }
  if (
    action === RewardAwardStatusAction.REDEEM &&
    rewardType === 'coupon' &&
    current === 'claimed'
  ) {
    return 'redeemed';
  }
  throw new ConflictException({
    code: 'REWARD_AWARD_STATUS_TRANSITION_INVALID',
    message: `The ${rewardType} reward cannot apply ${action} while ${current}.`,
  });
}

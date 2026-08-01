import { ConflictException } from '@nestjs/common';
import { RewardAwardStatusAction } from './dto/reward.dto';
import { transitionRewardAwardStatus } from './reward-award-status';

describe('reward award status transitions', () => {
  it('supports only the fulfillment path for the reward type', () => {
    expect(
      transitionRewardAwardStatus(
        'awarded',
        'coupon',
        RewardAwardStatusAction.CANCEL,
      ),
    ).toBe('cancelled');
    expect(
      transitionRewardAwardStatus(
        'claimed',
        'coupon',
        RewardAwardStatusAction.REDEEM,
      ),
    ).toBe('redeemed');
    expect(
      transitionRewardAwardStatus(
        'claimed',
        'physical',
        RewardAwardStatusAction.FULFILL,
      ),
    ).toBe('fulfilled');
  });

  it('rejects cancellation after claim and cross-type completion', () => {
    expect(() =>
      transitionRewardAwardStatus(
        'claimed',
        'coupon',
        RewardAwardStatusAction.CANCEL,
      ),
    ).toThrow(ConflictException);
    expect(() =>
      transitionRewardAwardStatus(
        'claimed',
        'physical',
        RewardAwardStatusAction.REDEEM,
      ),
    ).toThrow(ConflictException);
  });
});

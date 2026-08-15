import { BadRequestException } from '@nestjs/common';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { AdminAuthorizationService } from '../operator/admin-authorization.service';
import {
  RewardAwardStatusAction,
  RewardTypeDto,
  type CreateRewardCatalogItemDto,
} from './dto/reward.dto';
import { AdminRewardAwardsService } from './admin-reward-awards.service';
import { AdminRewardsService } from './admin-rewards.service';
import type { RewardCodeCipherService } from './reward-code-cipher.service';

const principal: AuthenticatedPrincipal = {
  email: 'admin@example.test',
  emailVerified: true,
  firebaseUid: 'admin-reward-unit',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const physicalReward = {
  claimUrl: 'https://sponsor.example.test/claim',
  competitionId: '00000000-0000-4000-8000-000000000001',
  description: 'A sponsor-funded physical reward.',
  imageUrl: 'https://cdn.example.test/reward.jpg',
  inventoryTotal: 1,
  reason: 'Configure the approved physical reward.',
  rewardType: RewardTypeDto.PHYSICAL,
  sponsorName: 'Sponsor',
  termsUrl: 'https://sponsor.example.test/terms',
  title: 'Training pack',
} satisfies CreateRewardCatalogItemDto;

describe('AdminRewardsService validation', () => {
  const idempotency = {} as IdempotencyService;
  const service = new AdminRewardsService(
    {} as AdminAuthorizationService,
    {} as RewardCodeCipherService,
    idempotency,
  );

  it('requires exactly one physical fulfillment path', () => {
    expectBadRequest(
      () =>
        service.create(principal, 'physical-two-paths', {
          ...physicalReward,
          fulfillmentInstructions: 'Collect from the partner gym.',
        }),
      'REWARD_FULFILLMENT_PATH_REQUIRED',
    );
    expectBadRequest(
      () =>
        service.create(principal, 'physical-no-path', {
          ...physicalReward,
          claimUrl: undefined,
        }),
      'REWARD_FULFILLMENT_PATH_REQUIRED',
    );
  });

  it('forbids physical claim fields on coupon rewards', () => {
    expectBadRequest(
      () =>
        service.create(principal, 'coupon-physical-path', {
          ...physicalReward,
          rewardType: RewardTypeDto.COUPON,
        }),
      'REWARD_COUPON_CLAIM_PATH_FORBIDDEN',
    );
  });

  it('requires bounded cash value and a manual-only fulfillment path', () => {
    const cashReward = {
      ...physicalReward,
      cashAmountCents: 10000,
      cashCurrency: 'CAD',
      claimUrl: undefined,
      fulfillmentInstructions: 'Hand cash to the settled winner in person.',
      rewardType: RewardTypeDto.CASH,
    };
    expectBadRequest(
      () =>
        service.create(principal, 'cash-wrong-value', {
          ...cashReward,
          cashAmountCents: undefined,
        }),
      'CASH_REWARD_VALUE_REQUIRED',
    );
    expectBadRequest(
      () =>
        service.create(principal, 'cash-claim-url', {
          ...cashReward,
          claimUrl: 'https://provider.example.test/claim',
        }),
      'CASH_REWARD_MANUAL_HANDOFF_REQUIRED',
    );
  });

  it('requires a specific audit reason', () => {
    expectBadRequest(
      () =>
        service.create(principal, 'short-reason', {
          ...physicalReward,
          reason: 'short',
        }),
      'OPERATOR_REASON_INVALID',
    );
  });

  it('rejects duplicate coupon codes after Unicode normalization', () => {
    expectBadRequest(
      () =>
        service.addCouponCodes(
          principal,
          physicalReward.competitionId,
          'codes',
          {
            codes: ['WIN-ABC-001', ' WIN-ＡＢＣ-001 '],
            expectedVersion: 1,
            reason: 'Load the approved coupon inventory.',
          },
        ),
      'REWARD_COUPON_CODE_DUPLICATE',
    );
  });

  it('rejects coupon codes that normalize below the minimum length', () => {
    expectBadRequest(
      () =>
        service.addCouponCodes(
          principal,
          physicalReward.competitionId,
          'codes',
          {
            codes: ['  Ａ  '],
            expectedVersion: 1,
            reason: 'Load the approved coupon inventory.',
          },
        ),
      'REWARD_COUPON_CODE_INVALID',
    );
  });

  it('requires a specific award-status reason before persistence', () => {
    const awards = new AdminRewardAwardsService(
      {} as AdminAuthorizationService,
      idempotency,
    );
    expectBadRequest(
      () =>
        awards.changeStatus(principal, physicalReward.competitionId, 'award', {
          action: RewardAwardStatusAction.FULFILL,
          expectedVersion: 1,
          reason: 'short',
        }),
      'OPERATOR_REASON_INVALID',
    );
  });
});

function expectBadRequest(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code,
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type {
  JsonObject,
  RewardAwardStatus,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import {
  type AdminRewardAwardResponseDto,
  type RewardAwardStatusActionDto,
} from './dto/reward.dto';
import { transitionRewardAwardStatus } from './reward-award-status';

interface AdminRewardAwardJson extends JsonObject {
  id: string;
  status: RewardAwardStatus;
}

@Injectable()
export class AdminRewardAwardsService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly idempotency: IdempotencyService,
  ) {}

  changeStatus(
    principal: AuthenticatedPrincipal,
    awardId: string,
    idempotencyKey: string,
    input: RewardAwardStatusActionDto,
  ): Promise<AdminRewardAwardResponseDto> {
    return this.idempotency.execute<AdminRewardAwardJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, awardId },
        scope: `admin-reward-awards:${awardId}:status`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const award = await transaction
          .selectFrom('reward_awards as award')
          .innerJoin(
            'reward_catalog_items as item',
            'item.id',
            'award.reward_catalog_item_id',
          )
          .select(['award.id', 'award.status', 'item.reward_type'])
          .where('award.id', '=', awardId)
          .forUpdate()
          .executeTakeFirst();
        if (!award) {
          throw new NotFoundException({
            code: 'REWARD_AWARD_NOT_FOUND',
            message: 'The reward award was not found.',
          });
        }

        const nextStatus = transitionRewardAwardStatus(
          award.status,
          award.reward_type,
          input.action,
        );
        const now = new Date();
        await transaction
          .updateTable('reward_awards')
          .set({
            fulfilled_at: nextStatus === 'fulfilled' ? now : undefined,
            redeemed_at: nextStatus === 'redeemed' ? now : undefined,
            status: nextStatus,
            updated_at: now,
          })
          .where('id', '=', award.id)
          .where('status', '=', award.status)
          .executeTakeFirstOrThrow();
        if (nextStatus === 'redeemed') {
          await transaction
            .updateTable('reward_coupon_codes')
            .set({ redeemed_at: now })
            .where('assigned_award_id', '=', award.id)
            .executeTakeFirstOrThrow();
        }
        await this.authorization.audit(transaction, {
          action: `reward_award.${nextStatus}`,
          actorUserId: admin.id,
          entityId: award.id,
          entityType: 'reward_awards',
          nextState: { status: nextStatus },
          previousState: { status: award.status },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { id: award.id, status: nextStatus };
      },
    );
  }
}

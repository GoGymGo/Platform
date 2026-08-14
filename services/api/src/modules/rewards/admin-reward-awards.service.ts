import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'kysely';
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
  version: number;
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
    if (input.reason.trim().length < 8) {
      throw new BadRequestException({
        code: 'OPERATOR_REASON_INVALID',
        message:
          'Provide a specific audit reason of at least eight characters.',
      });
    }
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
          .select([
            'award.id',
            'award.status',
            'award.version',
            'item.reward_type',
          ])
          .where('award.id', '=', awardId)
          .forUpdate()
          .executeTakeFirst();
        if (!award) {
          throw new NotFoundException({
            code: 'REWARD_AWARD_NOT_FOUND',
            message: 'The reward award was not found.',
          });
        }
        if (award.version !== input.expectedVersion) {
          throw new ConflictException({
            code: 'REWARD_AWARD_VERSION_CONFLICT',
            message: 'The reward award changed; reload it before retrying.',
          });
        }

        const nextStatus = transitionRewardAwardStatus(
          award.status,
          award.reward_type,
          input.action,
        );
        const now = new Date();
        const updated = await transaction
          .updateTable('reward_awards')
          .set({
            cancelled_at: nextStatus === 'cancelled' ? now : undefined,
            fulfilled_at: nextStatus === 'fulfilled' ? now : undefined,
            redeemed_at: nextStatus === 'redeemed' ? now : undefined,
            status: nextStatus,
            updated_at: now,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', award.id)
          .where('status', '=', award.status)
          .where('version', '=', input.expectedVersion)
          .returning(['status', 'version'])
          .executeTakeFirst();
        if (!updated) {
          throw new ConflictException({
            code: 'REWARD_AWARD_VERSION_CONFLICT',
            message: 'The reward award changed; reload it before retrying.',
          });
        }
        if (nextStatus === 'redeemed') {
          const coupon = await transaction
            .updateTable('reward_coupon_codes')
            .set({ redeemed_at: now })
            .where('assigned_award_id', '=', award.id)
            .where('redeemed_at', 'is', null)
            .returning('id')
            .executeTakeFirst();
          if (!coupon) {
            throw new ConflictException({
              code: 'REWARD_COUPON_NOT_ASSIGNED',
              message:
                'The coupon award has no unredeemed assigned code and cannot be redeemed.',
            });
          }
        }
        await this.authorization.audit(transaction, {
          action: `reward_award.${nextStatus}`,
          actorUserId: admin.id,
          entityId: award.id,
          entityType: 'reward_awards',
          nextState: { status: updated.status, version: updated.version },
          previousState: { status: award.status, version: award.version },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          id: award.id,
          status: updated.status,
          version: updated.version,
        };
      },
    );
  }
}

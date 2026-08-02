import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type {
  Database,
  JsonObject,
  RewardType,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import {
  type AddRewardCouponCodesDto,
  type AddedCouponCodesResponseDto,
  type AdminRewardResponseDto,
  type CreateRewardCatalogItemDto,
  RewardCatalogStatusAction,
  type RewardCatalogStatusActionDto,
  RewardTypeDto,
  type UpdateRewardCatalogItemDto,
} from './dto/reward.dto';
import { RewardCodeCipherService } from './reward-code-cipher.service';

interface AdminRewardJson extends JsonObject {
  id: string;
  status: 'archived' | 'draft' | 'published';
  version: number;
}

interface AddedCodesJson extends JsonObject {
  added: number;
  rewardId: string;
}

@Injectable()
export class AdminRewardsService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly cipher: RewardCodeCipherService,
    private readonly idempotency: IdempotencyService,
  ) {}

  create(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateRewardCatalogItemDto,
  ): Promise<AdminRewardResponseDto> {
    this.assertClaimPath(input);
    this.assertAvailabilityWindow(input.availableFrom, input.availableUntil);
    return this.idempotency.execute<AdminRewardJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope: 'admin-rewards:create',
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        await this.assertEditableCompetition(transaction, input.competitionId);
        const now = new Date();
        const reward = await transaction
          .insertInto('reward_catalog_items')
          .values({
            available_from: input.availableFrom
              ? new Date(input.availableFrom)
              : null,
            available_until: input.availableUntil
              ? new Date(input.availableUntil)
              : null,
            claim_url: input.claimUrl ?? null,
            competition_id: input.competitionId,
            created_at: now,
            description: input.description.trim(),
            display_order: input.displayOrder ?? 0,
            fulfillment_instructions:
              input.fulfillmentInstructions?.trim() ?? null,
            image_url: input.imageUrl ?? null,
            inventory_total: input.inventoryTotal,
            reward_type: input.rewardType,
            sponsor_name: input.sponsorName.trim(),
            status: 'draft',
            terms_url: input.termsUrl ?? null,
            title: input.title.trim(),
            updated_at: now,
            version: 1,
          })
          .returning(['id', 'status', 'version'])
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'reward.created',
          actorUserId: admin.id,
          entityId: reward.id,
          entityType: 'reward_catalog_items',
          nextState: this.auditState(input, reward.status, reward.version),
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return reward;
      },
    );
  }

  update(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
    input: UpdateRewardCatalogItemDto,
  ): Promise<AdminRewardResponseDto> {
    this.assertClaimPath(input);
    this.assertAvailabilityWindow(input.availableFrom, input.availableUntil);
    return this.idempotency.execute<AdminRewardJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...(input as unknown as JsonObject), rewardId },
        scope: `admin-rewards:${rewardId}:update`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const current = await this.getForUpdate(transaction, rewardId);
        if (current.status !== 'draft') {
          throw new ConflictException({
            code: 'REWARD_CONFIGURATION_LOCKED',
            message: 'Only draft rewards can be edited.',
          });
        }
        this.assertVersion(current.version, input.expectedVersion);
        await this.assertEditableCompetition(transaction, input.competitionId);
        const award = await transaction
          .selectFrom('reward_awards')
          .select('id')
          .where('reward_catalog_item_id', '=', rewardId)
          .executeTakeFirst();
        if (award) {
          throw new ConflictException({
            code: 'REWARD_ALREADY_AWARDED',
            message: 'A reward with winner awards cannot be reconfigured.',
          });
        }
        const requestedRewardType: RewardType = input.rewardType;
        if (current.reward_type !== requestedRewardType) {
          const couponCode = await transaction
            .selectFrom('reward_coupon_codes')
            .select('id')
            .where('reward_catalog_item_id', '=', rewardId)
            .executeTakeFirst();
          if (couponCode) {
            throw new ConflictException({
              code: 'REWARD_TYPE_HAS_COUPON_INVENTORY',
              message:
                'A reward type cannot change after coupon inventory has been uploaded.',
            });
          }
        }

        const updated = await transaction
          .updateTable('reward_catalog_items')
          .set({
            available_from: input.availableFrom
              ? new Date(input.availableFrom)
              : null,
            available_until: input.availableUntil
              ? new Date(input.availableUntil)
              : null,
            claim_url: input.claimUrl ?? null,
            competition_id: input.competitionId,
            description: input.description.trim(),
            display_order: input.displayOrder ?? 0,
            fulfillment_instructions:
              input.fulfillmentInstructions?.trim() ?? null,
            image_url: input.imageUrl ?? null,
            inventory_total: input.inventoryTotal,
            reward_type: input.rewardType,
            sponsor_name: input.sponsorName.trim(),
            terms_url: input.termsUrl ?? null,
            title: input.title.trim(),
            updated_at: new Date(),
            version: sql<number>`version + 1`,
          })
          .where('id', '=', rewardId)
          .where('version', '=', input.expectedVersion)
          .returning(['id', 'status', 'version'])
          .executeTakeFirst();
        if (!updated) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: 'reward.updated',
          actorUserId: admin.id,
          entityId: rewardId,
          entityType: 'reward_catalog_items',
          nextState: this.auditState(input, updated.status, updated.version),
          previousState: {
            inventoryTotal: current.inventory_total,
            status: current.status,
            title: current.title,
            version: current.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return updated;
      },
    );
  }

  changeStatus(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
    input: RewardCatalogStatusActionDto,
  ): Promise<AdminRewardResponseDto> {
    return this.idempotency.execute<AdminRewardJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, rewardId },
        scope: `admin-rewards:${rewardId}:status`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const current = await this.getForUpdate(transaction, rewardId);
        this.assertVersion(current.version, input.expectedVersion);
        const nextStatus =
          input.action === RewardCatalogStatusAction.PUBLISH
            ? 'published'
            : 'archived';
        if (
          (nextStatus === 'published' && current.status !== 'draft') ||
          (nextStatus === 'archived' && current.status !== 'published')
        ) {
          throw new ConflictException({
            code: 'REWARD_STATUS_TRANSITION_INVALID',
            message: `The reward cannot move from ${current.status} to ${nextStatus}.`,
          });
        }
        if (nextStatus === 'published') {
          await this.assertEditableCompetition(
            transaction,
            current.competition_id,
          );
          if (current.reward_type === 'coupon') {
            const codeInventory = await transaction
              .selectFrom('reward_coupon_codes')
              .select((expression) =>
                expression.fn.countAll<string>().as('count'),
              )
              .where('reward_catalog_item_id', '=', rewardId)
              .executeTakeFirstOrThrow();
            if (Number(codeInventory.count) < current.inventory_total) {
              throw new ConflictException({
                code: 'REWARD_COUPON_CODES_INSUFFICIENT',
                message:
                  'Upload at least one unique coupon code for every inventory unit before publishing.',
              });
            }
          }
        } else {
          await this.assertArchiveSafe(
            transaction,
            current.competition_id,
            rewardId,
          );
        }
        const updated = await transaction
          .updateTable('reward_catalog_items')
          .set({
            status: nextStatus,
            updated_at: new Date(),
            version: sql<number>`version + 1`,
          })
          .where('id', '=', rewardId)
          .where('version', '=', input.expectedVersion)
          .returning(['id', 'status', 'version'])
          .executeTakeFirst();
        if (!updated) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: `reward.${nextStatus}`,
          actorUserId: admin.id,
          entityId: rewardId,
          entityType: 'reward_catalog_items',
          nextState: { status: updated.status, version: updated.version },
          previousState: {
            status: current.status,
            version: current.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return updated;
      },
    );
  }

  addCouponCodes(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
    input: AddRewardCouponCodesDto,
  ): Promise<AddedCouponCodesResponseDto> {
    return this.idempotency.execute<AddedCodesJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { rewardId, codes: input.codes },
        responseCode: 201,
        scope: `admin-rewards:${rewardId}:coupon-codes`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const reward = await this.getForUpdate(transaction, rewardId);
        if (reward.reward_type !== 'coupon') {
          throw new BadRequestException({
            code: 'REWARD_NOT_COUPON',
            message: 'Coupon codes can only be added to coupon rewards.',
          });
        }
        if (reward.status === 'archived') {
          throw new ConflictException({
            code: 'REWARD_ARCHIVED',
            message: 'Coupon codes cannot be added to an archived reward.',
          });
        }
        const normalizedCodes = input.codes.map((code) => code.trim());
        if (normalizedCodes.some((code) => code.length < 3)) {
          throw new BadRequestException({
            code: 'REWARD_COUPON_CODE_INVALID',
            message:
              'Coupon codes must contain at least three non-space characters.',
          });
        }
        if (new Set(normalizedCodes).size !== normalizedCodes.length) {
          throw new BadRequestException({
            code: 'REWARD_COUPON_CODE_DUPLICATE',
            message: 'Coupon codes must be unique after whitespace is trimmed.',
          });
        }
        const encrypted = normalizedCodes.map((code) =>
          this.cipher.encrypt(code),
        );
        const existing = await transaction
          .selectFrom('reward_coupon_codes')
          .select('code_fingerprint')
          .where(
            'code_fingerprint',
            'in',
            encrypted.map((code) => code.fingerprint),
          )
          .execute();
        if (existing.length > 0) {
          throw new ConflictException({
            code: 'REWARD_COUPON_CODE_DUPLICATE',
            message: 'One or more coupon codes were already uploaded.',
          });
        }
        const now = new Date();
        await transaction
          .insertInto('reward_coupon_codes')
          .values(
            encrypted.map((code) => ({
              assigned_at: null,
              assigned_award_id: null,
              code_fingerprint: code.fingerprint,
              created_at: now,
              encrypted_code: code.encryptedCode,
              redeemed_at: null,
              reward_catalog_item_id: rewardId,
            })),
          )
          .execute();
        await this.authorization.audit(transaction, {
          action: 'reward.coupon_codes_added',
          actorUserId: admin.id,
          entityId: rewardId,
          entityType: 'reward_catalog_items',
          nextState: { codesAdded: encrypted.length },
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { added: encrypted.length, rewardId };
      },
    );
  }

  private async getForUpdate(
    transaction: Transaction<Database>,
    rewardId: string,
  ) {
    const reward = await transaction
      .selectFrom('reward_catalog_items')
      .selectAll()
      .where('id', '=', rewardId)
      .forUpdate()
      .executeTakeFirst();
    if (!reward) {
      throw new NotFoundException({
        code: 'REWARD_NOT_FOUND',
        message: 'The reward catalog item was not found.',
      });
    }
    return reward;
  }

  private async assertEditableCompetition(
    transaction: Transaction<Database>,
    competitionId: string,
  ): Promise<void> {
    const competition = await transaction
      .selectFrom('competitions')
      .select(['id', 'status'])
      .where('id', '=', competitionId)
      .executeTakeFirst();
    if (!competition) {
      throw new NotFoundException({
        code: 'REWARD_COMPETITION_NOT_FOUND',
        message: 'The reward competition was not found.',
      });
    }
    if (!['draft', 'registration'].includes(competition.status)) {
      throw new ConflictException({
        code: 'REWARD_COMPETITION_LOCKED',
        message:
          'Rewards can only be configured before the competition becomes active.',
      });
    }
  }

  private async assertArchiveSafe(
    transaction: Transaction<Database>,
    competitionId: string,
    rewardId: string,
  ): Promise<void> {
    const competition = await transaction
      .selectFrom('competitions')
      .select('status')
      .where('id', '=', competitionId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!['draft', 'registration'].includes(competition.status)) {
      throw new ConflictException({
        code: 'REWARD_COMPETITION_LOCKED',
        message:
          'Rewards cannot be archived after the competition becomes active.',
      });
    }
    if (competition.status === 'registration') {
      const replacement = await transaction
        .selectFrom('reward_catalog_items')
        .select('id')
        .where('competition_id', '=', competitionId)
        .where('status', '=', 'published')
        .where('id', '!=', rewardId)
        .executeTakeFirst();
      if (!replacement) {
        throw new ConflictException({
          code: 'COMPETITION_REWARD_REQUIRED',
          message:
            'Publish a replacement reward before archiving the last reward in a registration-stage competition.',
        });
      }
    }
  }

  private assertClaimPath(input: CreateRewardCatalogItemDto): void {
    if (
      (input.rewardType === RewardTypeDto.PHYSICAL ||
        input.rewardType === RewardTypeDto.CASH) &&
      !input.claimUrl &&
      !input.fulfillmentInstructions?.trim()
    ) {
      throw new BadRequestException({
        code: 'REWARD_FULFILLMENT_PATH_REQUIRED',
        message:
          'Physical and cash rewards require a secure claim URL or fulfillment instructions.',
      });
    }
  }

  private assertAvailabilityWindow(from?: string, until?: string): void {
    if (from && until && new Date(from) >= new Date(until)) {
      throw new BadRequestException({
        code: 'REWARD_AVAILABILITY_WINDOW_INVALID',
        message: 'Reward availability must end after it starts.',
      });
    }
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw this.versionConflict();
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'REWARD_VERSION_CONFLICT',
      message: 'The reward changed; reload it before retrying.',
    });
  }

  private auditState(
    input: CreateRewardCatalogItemDto,
    status: 'archived' | 'draft' | 'published',
    version: number,
  ): JsonObject {
    return {
      competitionId: input.competitionId,
      inventoryTotal: input.inventoryTotal,
      rewardType: input.rewardType,
      sponsorName: input.sponsorName,
      status,
      title: input.title,
      version,
    };
  }
}

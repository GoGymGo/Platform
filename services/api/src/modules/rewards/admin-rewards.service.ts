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
import { canDeleteReward } from '../operator/admin-deletion-policy';
import type {
  AdminDeletedEntityResponseDto,
  DeleteVersionedAdminEntityDto,
} from '../operator/dto/admin-configuration.dto';
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
import {
  isSeptemberPilotCompetition,
  septemberPilotRewardConfigurationErrors,
} from './september-pilot-cash-policy';
import { resolveRewardTermsUrl } from './reward-defaults';

interface AdminRewardJson extends JsonObject {
  id: string;
  status: 'archived' | 'draft' | 'published';
  version: number;
}

interface AddedCodesJson extends JsonObject {
  added: number;
  rewardId: string;
  version: number;
}

interface DeletedRewardJson extends JsonObject {
  id: string;
  status: 'deleted';
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
    this.assertCashConfiguration(input);
    this.assertAvailabilityWindow(input.availableFrom, input.availableUntil);
    this.assertReason(input.reason);
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
            cash_amount_cents: input.cashAmountCents ?? null,
            cash_currency: input.cashCurrency?.trim().toUpperCase() ?? null,
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
            terms_url: resolveRewardTermsUrl(input.termsUrl),
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
    this.assertCashConfiguration(input);
    this.assertAvailabilityWindow(input.availableFrom, input.availableUntil);
    this.assertReason(input.reason);
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
            cash_amount_cents: input.cashAmountCents ?? null,
            cash_currency: input.cashCurrency?.trim().toUpperCase() ?? null,
            competition_id: input.competitionId,
            description: input.description.trim(),
            display_order: input.displayOrder ?? 0,
            fulfillment_instructions:
              input.fulfillmentInstructions?.trim() ?? null,
            image_url: input.imageUrl ?? null,
            inventory_total: input.inventoryTotal,
            reward_type: input.rewardType,
            sponsor_name: input.sponsorName.trim(),
            terms_url: resolveRewardTermsUrl(input.termsUrl),
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
    this.assertReason(input.reason);
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
          const publicationReward = {
            ...current,
            terms_url: resolveRewardTermsUrl(current.terms_url),
          };
          this.assertPublicationTerms(publicationReward);
          await this.assertSeptemberPilotPublication(
            transaction,
            publicationReward,
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
            terms_url:
              nextStatus === 'published'
                ? resolveRewardTermsUrl(current.terms_url)
                : current.terms_url,
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

  delete(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
    input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    this.assertReason(input.reason);
    return this.idempotency.execute<DeletedRewardJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, rewardId },
        scope: `admin-rewards:${rewardId}:delete`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const reward = await this.getForUpdate(transaction, rewardId);
        this.assertVersion(reward.version, input.expectedVersion);
        if (!canDeleteReward(reward.status)) {
          throw new ConflictException({
            code: 'REWARD_DELETE_REQUIRES_INACTIVE_STATUS',
            message:
              'Only draft or archived rewards can be deleted from the dashboard.',
          });
        }

        const deletedAt = new Date();
        const deleted = await transaction
          .updateTable('reward_catalog_items')
          .set({
            deleted_at: deletedAt,
            updated_at: deletedAt,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', rewardId)
          .where('version', '=', input.expectedVersion)
          .where('deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!deleted) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: 'reward.deleted',
          actorUserId: admin.id,
          entityId: rewardId,
          entityType: 'reward_catalog_items',
          nextState: {
            deletedAt: deletedAt.toISOString(),
            status: 'deleted',
          },
          previousState: {
            competitionId: reward.competition_id,
            status: reward.status,
            title: reward.title,
            version: reward.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { id: deleted.id, status: 'deleted' };
      },
    );
  }

  addCouponCodes(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
    input: AddRewardCouponCodesDto,
  ): Promise<AddedCouponCodesResponseDto> {
    this.assertReason(input.reason);
    const normalizedCodes = input.codes.map((code) =>
      code.trim().normalize('NFKC'),
    );
    if (normalizedCodes.some((code) => code.length < 3 || code.length > 256)) {
      throw new BadRequestException({
        code: 'REWARD_COUPON_CODE_INVALID',
        message:
          'Coupon codes must contain between three and 256 normalized non-space characters.',
      });
    }
    if (new Set(normalizedCodes).size !== normalizedCodes.length) {
      throw new BadRequestException({
        code: 'REWARD_COUPON_CODE_DUPLICATE',
        message: 'Coupon codes must be unique after normalization.',
      });
    }
    return this.idempotency.execute<AddedCodesJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          codes: normalizedCodes,
          expectedVersion: input.expectedVersion,
          reason: input.reason.trim(),
          rewardId,
        },
        responseCode: 201,
        scope: `admin-rewards:${rewardId}:coupon-codes`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const reward = await this.getForUpdate(transaction, rewardId);
        this.assertVersion(reward.version, input.expectedVersion);
        if (reward.reward_type !== 'coupon') {
          throw new BadRequestException({
            code: 'REWARD_NOT_COUPON',
            message: 'Coupon codes can only be added to coupon rewards.',
          });
        }
        if (reward.status !== 'draft') {
          throw new ConflictException({
            code: 'REWARD_COUPON_CONFIGURATION_LOCKED',
            message: 'Coupon codes can only be added to a draft reward.',
          });
        }
        const encrypted = normalizedCodes.map((code) =>
          this.cipher.encrypt(code),
        );
        const now = new Date();
        const inserted = await transaction
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
          .onConflict((conflict) =>
            conflict.column('code_fingerprint').doNothing(),
          )
          .returning('id')
          .execute();
        if (inserted.length !== encrypted.length) {
          throw new ConflictException({
            code: 'REWARD_COUPON_CODE_DUPLICATE',
            message: 'One or more coupon codes were already uploaded.',
          });
        }
        const updated = await transaction
          .updateTable('reward_catalog_items')
          .set({
            updated_at: now,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', rewardId)
          .where('version', '=', input.expectedVersion)
          .returning('version')
          .executeTakeFirst();
        if (!updated) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: 'reward.coupon_codes_added',
          actorUserId: admin.id,
          entityId: rewardId,
          entityType: 'reward_catalog_items',
          nextState: {
            codesAdded: encrypted.length,
            version: updated.version,
          },
          previousState: { version: reward.version },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          added: encrypted.length,
          rewardId,
          version: updated.version,
        };
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
      .where('deleted_at', 'is', null)
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
      .where('deleted_at', 'is', null)
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
        .where('deleted_at', 'is', null)
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
    const hasClaimUrl = Boolean(input.claimUrl);
    const hasInstructions = Boolean(input.fulfillmentInstructions?.trim());
    if (input.rewardType === RewardTypeDto.COUPON) {
      if (hasClaimUrl || hasInstructions) {
        throw new BadRequestException({
          code: 'REWARD_COUPON_CLAIM_PATH_FORBIDDEN',
          message:
            'Coupon rewards reveal only their assigned encrypted code and cannot define a physical claim path.',
        });
      }
      return;
    }
    if (input.rewardType === RewardTypeDto.CASH) {
      if (hasClaimUrl || !hasInstructions) {
        throw new BadRequestException({
          code: 'CASH_REWARD_MANUAL_HANDOFF_REQUIRED',
          message:
            'Cash rewards require in-person fulfillment instructions and cannot define a payment or claim URL.',
        });
      }
      return;
    }
    if (hasClaimUrl === hasInstructions) {
      throw new BadRequestException({
        code: 'REWARD_FULFILLMENT_PATH_REQUIRED',
        message:
          'Physical rewards require exactly one secure claim URL or fulfillment instruction path.',
      });
    }
  }

  private assertCashConfiguration(input: CreateRewardCatalogItemDto): void {
    if (input.rewardType === RewardTypeDto.CASH) {
      if (
        !Number.isInteger(input.cashAmountCents) ||
        !input.cashAmountCents ||
        input.cashAmountCents <= 0 ||
        !/^[A-Za-z]{3}$/.test(input.cashCurrency ?? '')
      ) {
        throw new BadRequestException({
          code: 'CASH_REWARD_VALUE_REQUIRED',
          message:
            'Cash rewards require a positive immutable amount and a three-letter currency.',
        });
      }
      return;
    }
    if (
      input.cashAmountCents !== undefined ||
      input.cashCurrency !== undefined
    ) {
      throw new BadRequestException({
        code: 'NON_CASH_REWARD_VALUE_FORBIDDEN',
        message: 'Cash amount and currency apply only to cash rewards.',
      });
    }
  }

  private async assertSeptemberPilotPublication(
    transaction: Transaction<Database>,
    reward: Awaited<ReturnType<AdminRewardsService['getForUpdate']>>,
  ): Promise<void> {
    const competition = await transaction
      .selectFrom('competitions as competition')
      .innerJoin(
        'region_policies as region',
        'region.id',
        'competition.region_policy_id',
      )
      .select([
        'competition.month_key',
        'competition.name',
        'region.code as region_code',
      ])
      .where('competition.id', '=', reward.competition_id)
      .executeTakeFirstOrThrow();
    if (
      !isSeptemberPilotCompetition({
        monthKey: competition.month_key,
        name: competition.name,
        regionCode: competition.region_code,
      })
    ) {
      return;
    }
    const errors = septemberPilotRewardConfigurationErrors({
      cashAmountCents: reward.cash_amount_cents,
      cashCurrency: reward.cash_currency,
      claimUrl: reward.claim_url,
      fulfillmentInstructions: reward.fulfillment_instructions,
      imageUrl: reward.image_url,
      inventoryTotal: reward.inventory_total,
      rewardType: reward.reward_type,
      sponsorName: reward.sponsor_name,
      termsUrl: reward.terms_url,
      title: reward.title,
    });
    const otherPublished = await transaction
      .selectFrom('reward_catalog_items')
      .select('id')
      .where('competition_id', '=', reward.competition_id)
      .where('status', '=', 'published')
      .where('deleted_at', 'is', null)
      .where('id', '!=', reward.id)
      .executeTakeFirst();
    if (otherPublished) {
      errors.push('the pilot already has another published reward');
    }
    if (errors.length > 0) {
      throw new ConflictException({
        code: 'SEPTEMBER_PILOT_REWARD_INVALID',
        message: `The September pilot reward cannot be published: ${errors.join('; ')}.`,
      });
    }
  }

  private assertPublicationTerms(input: { terms_url: string | null }): void {
    if (!input.terms_url) {
      throw new ConflictException({
        code: 'REWARD_PUBLICATION_TERMS_REQUIRED',
        message: 'A valid HTTPS terms link is required to publish the reward.',
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

  private assertReason(reason: string): void {
    if (reason.trim().length < 8) {
      throw new BadRequestException({
        code: 'OPERATOR_REASON_INVALID',
        message:
          'Provide a specific audit reason of at least eight characters.',
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
      cashAmountCents: input.cashAmountCents ?? null,
      cashCurrency: input.cashCurrency?.trim().toUpperCase() ?? null,
      inventoryTotal: input.inventoryTotal,
      rewardType: input.rewardType,
      sponsorName: input.sponsorName,
      status,
      title: input.title,
      version,
    };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  ClaimRewardResponseDto,
  RewardAwardResponseDto,
  RewardCatalogItemResponseDto,
} from './dto/reward.dto';
import { RewardCodeCipherService } from './reward-code-cipher.service';

interface ClaimRewardJson extends JsonObject {
  awardRank: number;
  awardedAt: string;
  claimUrl: string | null;
  claimedAt: string | null;
  cashAmountCents: number | null;
  cashCurrency: string | null;
  couponCode: string | null;
  fulfilledAt: string | null;
  fulfillmentInstructions: string | null;
  id: string;
  imageUrl: string | null;
  rewardType: 'cash' | 'coupon' | 'physical';
  sponsorName: string;
  status: 'awarded' | 'cancelled' | 'claimed' | 'fulfilled' | 'redeemed';
  title: string;
}

export interface RewardAwardSlot {
  availableFrom: Date | null;
  availableUntil: Date | null;
  catalogVersion: number;
  cashAmountCents: number | null;
  cashCurrency: string | null;
  displayOrder: number;
  inventoryTotal: number;
  rewardCatalogItemId: string;
  rewardType: 'cash' | 'coupon' | 'physical';
  sponsorName: string;
  title: string;
}

export function allocateRewardSlots(
  items: readonly {
    awardedCount: number;
    availableFrom: Date | null;
    availableUntil: Date | null;
    catalogVersion: number;
    cashAmountCents: number | null;
    cashCurrency: string | null;
    displayOrder: number;
    inventoryTotal: number;
    rewardCatalogItemId: string;
    rewardType: 'cash' | 'coupon' | 'physical';
    sponsorName: string;
    title: string;
  }[],
  maximumSlots: number,
): RewardAwardSlot[] {
  const slots: RewardAwardSlot[] = [];
  const limit = Math.max(0, Math.floor(maximumSlots));
  for (const item of items) {
    const available = Math.max(item.inventoryTotal - item.awardedCount, 0);
    const count = Math.min(available, limit - slots.length);
    for (let index = 0; index < count; index += 1) {
      slots.push({
        availableFrom: item.availableFrom,
        availableUntil: item.availableUntil,
        catalogVersion: item.catalogVersion,
        cashAmountCents: item.cashAmountCents,
        cashCurrency: item.cashCurrency,
        displayOrder: item.displayOrder,
        inventoryTotal: item.inventoryTotal,
        rewardCatalogItemId: item.rewardCatalogItemId,
        rewardType: item.rewardType,
        sponsorName: item.sponsorName,
        title: item.title,
      });
    }
    if (slots.length >= limit) break;
  }
  return slots;
}

@Injectable()
export class RewardsService {
  constructor(
    private readonly cipher: RewardCodeCipherService,
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  async getCatalog(
    regionCode: string,
    monthKey?: string,
  ): Promise<RewardCatalogItemResponseDto[]> {
    const now = new Date();
    let query = this.database.connection
      .selectFrom('reward_catalog_items as item')
      .innerJoin(
        'competitions as competition',
        'competition.id',
        'item.competition_id',
      )
      .innerJoin(
        'region_policies as region',
        'region.id',
        'competition.region_policy_id',
      )
      .select([
        'competition.id as competition_id',
        'competition.month_key',
        'competition.name as competition_name',
        'item.available_from',
        'item.available_until',
        'item.cash_amount_cents',
        'item.cash_currency',
        'item.description',
        'item.id',
        'item.image_url',
        'item.inventory_total',
        'item.reward_type',
        'item.sponsor_name',
        'item.terms_url',
        'item.title',
        'region.code as region_code',
        'region.metro_name as region_name',
        'region.timezone as region_timezone',
        sql<string>`GREATEST(
          item.inventory_total - (
            SELECT COUNT(*)
            FROM reward_awards AS award
            WHERE award.reward_catalog_item_id = item.id
              AND award.status <> 'cancelled'
          ),
          0
        )`.as('inventory_remaining'),
      ])
      .where('competition.deleted_at', 'is', null)
      .where('item.deleted_at', 'is', null)
      .where('region.deleted_at', 'is', null)
      .where('region.code', '=', regionCode)
      .where('region.competition_enabled', '=', true)
      .where('region.valid_from', '<=', now)
      .where((expression) =>
        expression.or([
          expression('region.valid_to', 'is', null),
          expression('region.valid_to', '>', now),
        ]),
      )
      .where('competition.status', 'in', ['registration', 'active'])
      .where('item.status', '=', 'published')
      .where((expression) =>
        expression.or([
          expression('item.reward_type', '!=', 'cash'),
          expression.and([
            expression('item.cash_amount_cents', 'is not', null),
            expression('item.cash_currency', 'is not', null),
          ]),
        ]),
      )
      .where((expression) =>
        expression.or([
          expression('item.available_from', 'is', null),
          expression('item.available_from', '<=', now),
        ]),
      )
      .where((expression) =>
        expression.or([
          expression('item.available_until', 'is', null),
          expression('item.available_until', '>', now),
        ]),
      );

    query = monthKey
      ? query.where('competition.month_key', '=', monthKey)
      : query.where('competition.ends_at', '>', now);

    const items = await query
      .orderBy('competition.starts_at')
      .orderBy('item.display_order')
      .orderBy('item.created_at')
      .execute();

    return items.map((item) => ({
      availableFrom: item.available_from?.toISOString() ?? null,
      availableUntil: item.available_until?.toISOString() ?? null,
      cashAmountCents: item.cash_amount_cents,
      cashCurrency: item.cash_currency,
      competitionId: item.competition_id,
      competitionName: item.competition_name,
      description: item.description,
      id: item.id,
      imageUrl: item.image_url!,
      inventoryRemaining: Number(item.inventory_remaining),
      inventoryTotal: item.inventory_total,
      monthKey: item.month_key,
      regionCode: item.region_code,
      regionName: item.region_name,
      regionTimezone: item.region_timezone,
      rewardType: item.reward_type,
      sponsorName: item.sponsor_name,
      termsUrl: item.terms_url!,
      title: item.title,
    }));
  }

  async getMyAwards(
    principal: AuthenticatedPrincipal,
  ): Promise<RewardAwardResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const awards = await transaction
          .selectFrom('reward_awards as award')
          .innerJoin('draw_reward_slots as slot', (join) =>
            join
              .onRef('slot.draw_id', '=', 'award.draw_id')
              .onRef('slot.slot_position', '=', 'award.award_rank'),
          )
          .innerJoin('draw_reward_catalog_snapshots as snapshot', (join) =>
            join
              .onRef('snapshot.draw_id', '=', 'slot.draw_id')
              .onRef(
                'snapshot.reward_catalog_item_id',
                '=',
                'slot.reward_catalog_item_id',
              ),
          )
          .select([
            'award.award_rank',
            'award.awarded_at',
            'award.claimed_at',
            'award.fulfilled_at',
            'award.id',
            'award.status',
            sql<string | null>`NULL`.as('image_url'),
            'snapshot.cash_amount_cents',
            'snapshot.cash_currency',
            'snapshot.reward_type',
            'snapshot.sponsor_name',
            'snapshot.title',
          ])
          .where('award.user_id', '=', user.id)
          .orderBy('award.awarded_at', 'desc')
          .execute();

        return awards.map((award) => this.awardResponse(award));
      });
  }

  claim(
    principal: AuthenticatedPrincipal,
    awardId: string,
    idempotencyKey: string,
  ): Promise<ClaimRewardResponseDto> {
    return this.idempotency.execute<ClaimRewardJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { awardId },
        scope: `reward-awards:${awardId}:claim`,
        storeResponseBody: false,
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const award = await transaction
          .selectFrom('reward_awards as award')
          .innerJoin(
            'reward_catalog_items as item',
            'item.id',
            'award.reward_catalog_item_id',
          )
          .select([
            'award.award_rank',
            'award.awarded_at',
            'award.claimed_at',
            'award.fulfilled_at',
            'award.id',
            'award.reward_catalog_item_id',
            'award.status',
            'item.claim_url',
            'item.cash_amount_cents',
            'item.cash_currency',
            'item.fulfillment_instructions',
            'item.image_url',
            'item.reward_type',
            'item.sponsor_name',
            'item.title',
          ])
          .where('award.id', '=', awardId)
          .where('award.user_id', '=', user.id)
          .forUpdate()
          .executeTakeFirst();
        if (!award) {
          throw new NotFoundException({
            code: 'REWARD_AWARD_NOT_FOUND',
            message: 'The reward award was not found.',
          });
        }
        if (award.status === 'cancelled') {
          throw new ConflictException({
            code: 'REWARD_AWARD_CANCELLED',
            message: 'This reward award was cancelled and cannot be claimed.',
          });
        }
        if (award.reward_type === 'cash') {
          throw new ConflictException({
            code: 'CASH_REWARD_REQUIRES_IN_PERSON_FULFILLMENT',
            message:
              'Cash rewards are recorded by an administrator during the in-person handoff.',
          });
        }

        const now = new Date();
        let couponCode: string | null = null;
        if (award.reward_type === 'coupon') {
          const code = await this.assignCouponCode(
            transaction,
            award.id,
            award.reward_catalog_item_id,
            now,
          );
          couponCode = this.cipher.decrypt(code.encrypted_code);
        }

        const claimedAt = award.claimed_at ?? now;
        const status = award.status === 'awarded' ? 'claimed' : award.status;
        if (award.status === 'awarded') {
          await transaction
            .updateTable('reward_awards')
            .set({
              claimed_at: claimedAt,
              status,
              updated_at: now,
              version: sql<number>`version + 1`,
            })
            .where('id', '=', award.id)
            .executeTakeFirstOrThrow();
        }

        return {
          awardRank: award.award_rank,
          awardedAt: award.awarded_at.toISOString(),
          cashAmountCents: award.cash_amount_cents,
          cashCurrency: award.cash_currency,
          claimUrl: award.claim_url,
          claimedAt: claimedAt.toISOString(),
          couponCode,
          fulfillmentInstructions: award.fulfillment_instructions,
          fulfilledAt: award.fulfilled_at?.toISOString() ?? null,
          id: award.id,
          imageUrl: award.image_url,
          rewardType: award.reward_type,
          sponsorName: award.sponsor_name,
          status,
          title: award.title,
        };
      },
    );
  }

  async listAvailableAwardSlots(
    transaction: Transaction<Database>,
    competitionId: string,
    at: Date,
    maximumSlots: number,
  ): Promise<RewardAwardSlot[]> {
    const items = await transaction
      .selectFrom('reward_catalog_items as item')
      .select([
        'item.available_from',
        'item.available_until',
        'item.cash_amount_cents',
        'item.cash_currency',
        'item.display_order',
        'item.id',
        'item.inventory_total',
        'item.reward_type',
        'item.sponsor_name',
        'item.title',
        'item.version',
        sql<string>`(
          SELECT COUNT(*)
          FROM reward_awards AS award
          WHERE award.reward_catalog_item_id = item.id
            AND award.status <> 'cancelled'
        )`.as('awarded_count'),
      ])
      .where('item.competition_id', '=', competitionId)
      .where('item.deleted_at', 'is', null)
      .where('item.status', '=', 'published')
      .where((expression) =>
        expression.or([
          expression('item.available_from', 'is', null),
          expression('item.available_from', '<=', at),
        ]),
      )
      .where((expression) =>
        expression.or([
          expression('item.available_until', 'is', null),
          expression('item.available_until', '>', at),
        ]),
      )
      .orderBy('item.display_order')
      .orderBy('item.created_at')
      .forUpdate()
      .execute();

    return allocateRewardSlots(
      items.map((item) => ({
        awardedCount: Number(item.awarded_count),
        availableFrom: item.available_from,
        availableUntil: item.available_until,
        catalogVersion: item.version,
        cashAmountCents: item.cash_amount_cents,
        cashCurrency: item.cash_currency,
        displayOrder: item.display_order,
        inventoryTotal: item.inventory_total,
        rewardCatalogItemId: item.id,
        rewardType: item.reward_type,
        sponsorName: item.sponsor_name,
        title: item.title,
      })),
      maximumSlots,
    );
  }

  private async assignCouponCode(
    transaction: Transaction<Database>,
    awardId: string,
    rewardCatalogItemId: string,
    now: Date,
  ) {
    const existing = await transaction
      .selectFrom('reward_coupon_codes')
      .select(['encrypted_code', 'id'])
      .where('assigned_award_id', '=', awardId)
      .executeTakeFirst();
    if (existing) return existing;

    const available = await transaction
      .selectFrom('reward_coupon_codes')
      .select(['encrypted_code', 'id'])
      .where('reward_catalog_item_id', '=', rewardCatalogItemId)
      .where('assigned_award_id', 'is', null)
      .orderBy('created_at')
      .forUpdate()
      .executeTakeFirst();
    if (!available) {
      throw new ConflictException({
        code: 'REWARD_COUPON_INVENTORY_EXHAUSTED',
        message: 'No unassigned coupon code remains for this reward.',
      });
    }
    await transaction
      .updateTable('reward_coupon_codes')
      .set({ assigned_at: now, assigned_award_id: awardId })
      .where('id', '=', available.id)
      .where('assigned_award_id', 'is', null)
      .executeTakeFirstOrThrow();
    return available;
  }

  private awardResponse(award: {
    award_rank: number;
    awarded_at: Date;
    cash_amount_cents: number | null;
    cash_currency: string | null;
    claimed_at: Date | null;
    fulfilled_at: Date | null;
    id: string;
    image_url: string | null;
    reward_type: 'cash' | 'coupon' | 'physical';
    sponsor_name: string;
    status: 'awarded' | 'cancelled' | 'claimed' | 'fulfilled' | 'redeemed';
    title: string;
  }): RewardAwardResponseDto {
    return {
      awardRank: award.award_rank,
      awardedAt: award.awarded_at.toISOString(),
      cashAmountCents: award.cash_amount_cents,
      cashCurrency: award.cash_currency,
      claimedAt: award.claimed_at?.toISOString() ?? null,
      fulfilledAt: award.fulfilled_at?.toISOString() ?? null,
      id: award.id,
      imageUrl: award.image_url,
      rewardType: award.reward_type,
      sponsorName: award.sponsor_name,
      status: award.status,
      title: award.title,
    };
  }
}

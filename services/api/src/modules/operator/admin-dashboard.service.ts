import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'kysely';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { JsonObject, JsonValue } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AdminAuthorizationService } from './admin-authorization.service';
import type {
  AdminDashboardCompetitionDto,
  AdminDashboardSnapshotDto,
} from './dto/admin-dashboard.dto';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: AdminAuthorizationService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async getSnapshot(
    principal: AuthenticatedPrincipal,
  ): Promise<AdminDashboardSnapshotDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const now = new Date();
        const [
          regions,
          competitions,
          goalBrackets,
          competitionGyms,
          enrollmentCounts,
          rewardCounts,
          rewards,
          couponCounts,
          rewardAwards,
          creatorWorkouts,
          legalDocuments,
          legalDocumentEvents,
          auditEvents,
        ] = await Promise.all([
          transaction
            .selectFrom('region_policies')
            .select([
              'id',
              'boundary_version',
              'code',
              'competition_enabled',
              'configuration_version',
              'country_code',
              'currency',
              'language_codes',
              'metro_name',
              'minimum_age',
              'policy_version',
              'subdivision_code',
              'timezone',
              'valid_from',
              'valid_to',
            ])
            .where('deleted_at', 'is', null)
            .orderBy('created_at', 'desc')
            .execute(),
          transaction
            .selectFrom('competitions as competition')
            .innerJoin(
              'region_policies as region',
              'region.id',
              'competition.region_policy_id',
            )
            .leftJoin(
              'competition_draws as draw',
              'draw.competition_id',
              'competition.id',
            )
            .select([
              'competition.id',
              'competition.configuration_version',
              'competition.ends_at',
              'competition.entrant_cap',
              'competition.minimum_entrants',
              'competition.month_key',
              'competition.name',
              'competition.region_policy_id',
              'competition.registration_closes_at',
              'competition.registration_opens_at',
              'competition.rules',
              'competition.rules_version',
              'competition.starts_at',
              'competition.status',
              'draw.id as draw_id',
              'draw.entrant_count as draw_entrant_count',
              'draw.entrant_snapshot_hash as draw_entrant_snapshot_hash',
              'draw.locked_at as draw_locked_at',
              'draw.public_result_snapshot_hash as draw_public_result_snapshot_hash',
              'draw.reward_slot_count as draw_reward_slot_count',
              'draw.reward_snapshot_hash as draw_reward_snapshot_hash',
              'draw.scoring_snapshot_hash as draw_scoring_snapshot_hash',
              'draw.seed_commitment as draw_seed_commitment',
              'draw.settled_at as draw_settled_at',
              'draw.status as draw_status',
              'draw.total_entries as draw_total_entries',
              'region.code as region_code',
              'region.metro_name as region_name',
            ])
            .where('competition.deleted_at', 'is', null)
            .orderBy('competition.starts_at', 'desc')
            .execute(),
          transaction
            .selectFrom('competition_goal_brackets')
            .select(['competition_id', 'goal_days', 'label'])
            .orderBy('goal_days', 'asc')
            .execute(),
          transaction
            .selectFrom('competition_gym_locations as assignment')
            .innerJoin(
              'gym_locations as gym',
              'gym.id',
              'assignment.gym_location_id',
            )
            .select(['assignment.competition_id', 'assignment.gym_location_id'])
            .where('gym.deleted_at', 'is', null)
            .orderBy('assignment.competition_id')
            .orderBy('assignment.gym_location_id')
            .execute(),
          transaction
            .selectFrom('competition_enrollments')
            .select([
              'competition_id',
              sql<number>`count(*)::integer`.as('count'),
            ])
            .where('status', '=', 'active')
            .groupBy('competition_id')
            .execute(),
          transaction
            .selectFrom('reward_catalog_items')
            .select([
              'competition_id',
              sql<number>`count(*)::integer`.as('count'),
              sql<number>`count(*) filter (where status = 'published')::integer`.as(
                'published_count',
              ),
            ])
            .where('deleted_at', 'is', null)
            .groupBy('competition_id')
            .execute(),
          transaction
            .selectFrom('reward_catalog_items as reward')
            .innerJoin(
              'competitions as competition',
              'competition.id',
              'reward.competition_id',
            )
            .select([
              'reward.id',
              'reward.available_from',
              'reward.available_until',
              'reward.claim_url',
              'reward.cash_amount_cents',
              'reward.cash_currency',
              'reward.competition_id',
              'reward.description',
              'reward.display_order',
              'reward.fulfillment_instructions',
              'reward.image_url',
              'reward.inventory_total',
              'reward.reward_type',
              'reward.sponsor_name',
              'reward.status',
              'reward.terms_url',
              'reward.title',
              'reward.version',
              'competition.name as competition_name',
            ])
            .where('reward.deleted_at', 'is', null)
            .where('competition.deleted_at', 'is', null)
            .orderBy('reward.updated_at', 'desc')
            .execute(),
          transaction
            .selectFrom('reward_coupon_codes')
            .select([
              'reward_catalog_item_id',
              sql<number>`count(*)::integer`.as('count'),
              sql<number>`count(*) filter (where assigned_award_id is not null)::integer`.as(
                'assigned_count',
              ),
            ])
            .groupBy('reward_catalog_item_id')
            .execute(),
          transaction
            .selectFrom('reward_awards as award')
            .innerJoin('competition_draws as draw', 'draw.id', 'award.draw_id')
            .innerJoin('draw_reward_slots as slot', (join) =>
              join
                .onRef('slot.draw_id', '=', 'award.draw_id')
                .onRef('slot.slot_position', '=', 'award.award_rank'),
            )
            .innerJoin('draw_reward_catalog_snapshots as reward', (join) =>
              join
                .onRef('reward.draw_id', '=', 'slot.draw_id')
                .onRef(
                  'reward.reward_catalog_item_id',
                  '=',
                  'slot.reward_catalog_item_id',
                ),
            )
            .innerJoin('draw_public_identities as identity', (join) =>
              join
                .onRef('identity.draw_id', '=', 'award.draw_id')
                .onRef('identity.user_id', '=', 'award.user_id'),
            )
            .leftJoin(
              'cash_fulfillments as cash',
              'cash.reward_award_id',
              'award.id',
            )
            .select([
              'award.id',
              'award.award_rank',
              'award.awarded_at',
              'award.claimed_at',
              'award.fulfilled_at',
              'award.redeemed_at',
              'award.reward_catalog_item_id',
              'award.status',
              'award.version',
              'cash.id as cash_fulfillment_id',
              'draw.competition_id',
              'identity.alias as winner_callsign',
              'reward.cash_amount_cents',
              'reward.cash_currency',
              'reward.reward_type',
              'reward.sponsor_name',
              'reward.title',
            ])
            .orderBy('award.awarded_at', 'desc')
            .execute(),
          transaction
            .selectFrom('creator_workouts')
            .selectAll()
            .where('deleted_at', 'is', null)
            .orderBy('updated_at', 'desc')
            .execute(),
          transaction
            .selectFrom('legal_documents')
            .selectAll()
            .where('deleted_at', 'is', null)
            .orderBy('effective_at', 'desc')
            .execute(),
          transaction
            .selectFrom('legal_document_events')
            .select(['legal_document_id', 'lifecycle_version', 'next_state'])
            .orderBy('lifecycle_version', 'desc')
            .execute(),
          transaction
            .selectFrom('operator_audit_events as audit')
            .leftJoin('users as actor', 'actor.id', 'audit.actor_user_id')
            .select([
              'audit.id',
              'audit.action',
              'audit.created_at',
              'audit.entity_id',
              'audit.entity_type',
              'audit.next_state',
              'audit.previous_state',
              'audit.reason',
              'actor.email as actor_email',
            ])
            .orderBy('audit.created_at', 'desc')
            .limit(100)
            .execute(),
        ]);

        const goalsByCompetition = new Map<
          string,
          { goalDays: number; label: string }[]
        >();
        for (const bracket of goalBrackets) {
          const existing = goalsByCompetition.get(bracket.competition_id) ?? [];
          existing.push({
            goalDays: bracket.goal_days,
            label: bracket.label,
          });
          goalsByCompetition.set(bracket.competition_id, existing);
        }
        const enrollmentsByCompetition = new Map(
          enrollmentCounts.map((row) => [row.competition_id, row.count]),
        );
        const gymsByCompetition = new Map<string, string[]>();
        for (const assignment of competitionGyms) {
          const existing =
            gymsByCompetition.get(assignment.competition_id) ?? [];
          existing.push(assignment.gym_location_id);
          gymsByCompetition.set(assignment.competition_id, existing);
        }
        const rewardsByCompetition = new Map(
          rewardCounts.map((row) => [
            row.competition_id,
            { published: row.published_count, total: row.count },
          ]),
        );
        const couponsByReward = new Map(
          couponCounts.map((row) => [
            row.reward_catalog_item_id,
            { assigned: row.assigned_count, total: row.count },
          ]),
        );
        const legalStateByDocument = new Map<
          string,
          { state: string; version: number }
        >();
        for (const event of legalDocumentEvents) {
          if (!legalStateByDocument.has(event.legal_document_id)) {
            legalStateByDocument.set(event.legal_document_id, {
              state: event.next_state,
              version: event.lifecycle_version,
            });
          }
        }

        return {
          admin: {
            email: admin.email ?? principal.email ?? '',
            id: admin.id,
            roles: admin.roles,
          },
          capabilities: {
            creatorConfigurationEnabled: this.config.get(
              'CREATOR_FEATURES_ENABLED',
              { infer: true },
            ),
            legalPublicationOwner:
              Boolean(
                this.config.get('GOGYMGO_OWNER_EMAIL', { infer: true }),
              ) &&
              admin.email?.trim().toLowerCase() ===
                this.config.get('GOGYMGO_OWNER_EMAIL', { infer: true }),
          },
          auditEvents: auditEvents.map((event) => ({
            action: event.action,
            actorEmail: event.actor_email,
            after: this.minimizeAuditState(event.next_state),
            before: this.minimizeAuditState(event.previous_state),
            createdAt: event.created_at.toISOString(),
            entityId: event.entity_id,
            entityType: event.entity_type,
            id: event.id,
            reason: event.reason,
          })),
          competitions: competitions.map((competition) =>
            this.toCompetition(
              competition,
              goalsByCompetition,
              enrollmentsByCompetition,
              rewardsByCompetition,
              gymsByCompetition,
            ),
          ),
          creatorWorkouts: creatorWorkouts.map((workout) => ({
            creatorName: workout.creator_name,
            creatorUserId: workout.creator_user_id,
            durationMinutes: workout.duration_minutes,
            id: workout.id,
            published: workout.published,
            publishedAt: workout.published_at?.toISOString() ?? null,
            regionCodes: workout.region_codes,
            sponsorName: workout.sponsor_name,
            thumbnailUrl: workout.thumbnail_url,
            title: workout.title,
            version: workout.version,
            videoUrl: workout.video_url,
            workoutStyle: workout.workout_style,
          })),
          generatedAt: now.toISOString(),
          legalDocuments: legalDocuments.map((document) => {
            const lifecycle = legalStateByDocument.get(document.id);
            if (!lifecycle) {
              throw new InternalServerErrorException({
                code: 'LEGAL_DOCUMENT_LIFECYCLE_MISSING',
                message:
                  'A legal document is missing its authoritative lifecycle evidence.',
              });
            }
            return {
              content: document.content as JsonObject,
              contentSha256: document.content_sha256,
              documentKey: document.document_key,
              effectiveAt: document.effective_at.toISOString(),
              id: document.id,
              jurisdictionCode: document.jurisdiction_code,
              locale: document.locale,
              lifecycleVersion: lifecycle.version,
              ownerApprovedAt:
                document.owner_approved_at?.toISOString() ?? null,
              receiptRequirement: document.receipt_requirement,
              status:
                lifecycle.state === 'withdrawn'
                  ? ('withdrawn' as const)
                  : document.effective_at <= now
                    ? ('effective' as const)
                    : ('scheduled' as const),
              title: document.title,
              version: document.version,
            };
          }),
          regions: regions.map((region) => ({
            boundaryVersion: region.boundary_version,
            code: region.code,
            competitionEnabled: region.competition_enabled,
            countryCode: region.country_code,
            currency: region.currency,
            id: region.id,
            languageCodes: region.language_codes,
            metroName: region.metro_name,
            minimumAge: region.minimum_age,
            policyVersion: region.policy_version,
            subdivisionCode: region.subdivision_code,
            timezone: region.timezone,
            validFrom: region.valid_from.toISOString(),
            validTo: region.valid_to?.toISOString() ?? null,
            version: region.configuration_version,
          })),
          rewards: rewards.map((reward) => {
            const coupons = couponsByReward.get(reward.id);
            return {
              assignedCouponCodeCount: coupons?.assigned ?? 0,
              availableFrom: reward.available_from?.toISOString() ?? null,
              availableUntil: reward.available_until?.toISOString() ?? null,
              claimUrl: reward.claim_url,
              cashAmountCents: reward.cash_amount_cents,
              cashCurrency: reward.cash_currency,
              competitionId: reward.competition_id,
              competitionName: reward.competition_name,
              couponCodeCount: coupons?.total ?? 0,
              description: reward.description,
              displayOrder: reward.display_order,
              fulfillmentInstructions: reward.fulfillment_instructions,
              id: reward.id,
              imageUrl: reward.image_url,
              inventoryTotal: reward.inventory_total,
              rewardType: reward.reward_type,
              sponsorName: reward.sponsor_name,
              status: reward.status,
              termsUrl: reward.terms_url,
              title: reward.title,
              version: reward.version,
            };
          }),
          rewardAwards: rewardAwards.map((award) => ({
            awardRank: award.award_rank,
            awardedAt: award.awarded_at.toISOString(),
            cashAmountCents: award.cash_amount_cents,
            cashCurrency: award.cash_currency,
            cashFulfillmentId: award.cash_fulfillment_id,
            claimedAt: award.claimed_at?.toISOString() ?? null,
            competitionId: award.competition_id,
            fulfilledAt: award.fulfilled_at?.toISOString() ?? null,
            id: award.id,
            redeemedAt: award.redeemed_at?.toISOString() ?? null,
            rewardId: award.reward_catalog_item_id,
            rewardType: award.reward_type,
            sponsorName: award.sponsor_name,
            status: award.status,
            title: award.title,
            version: award.version,
            winnerCallsign: award.winner_callsign,
          })),
        };
      });
  }

  private minimizeAuditState(value: unknown): JsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const sensitiveKey =
      /(?:actor|winner)?userId|email|firebase|password|secret|token|qrPayload|(?:coupon|reward|redemption)Code|codeFingerprint|encrypted|claimUrl|fulfillmentInstructions|seedReveal/i;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKey.test(key))
        .slice(0, 16)
        .map(([key, entry]) => [key, this.minimizeAuditValue(entry)]),
    );
  }

  private minimizeAuditValue(value: unknown): JsonValue {
    if (value === null) return null;
    if (
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      return value;
    }
    if (Array.isArray(value)) {
      return value
        .slice(0, 20)
        .filter(
          (entry): entry is boolean | number | string | null =>
            entry === null ||
            ['boolean', 'number', 'string'].includes(typeof entry),
        );
    }
    return this.minimizeAuditState(value);
  }

  private toCompetition(
    competition: {
      configuration_version: number;
      draw_entrant_count: number | null;
      draw_entrant_snapshot_hash: string | null;
      draw_id: string | null;
      draw_locked_at: Date | null;
      draw_public_result_snapshot_hash: string | null;
      draw_reward_slot_count: number | null;
      draw_reward_snapshot_hash: string | null;
      draw_scoring_snapshot_hash: string | null;
      draw_seed_commitment: string | null;
      draw_settled_at: Date | null;
      draw_status: 'cancelled' | 'locked' | 'settled' | null;
      draw_total_entries: string | null;
      ends_at: Date;
      entrant_cap: number | null;
      id: string;
      minimum_entrants: number;
      month_key: string;
      name: string;
      region_code: string;
      region_name: string;
      region_policy_id: string;
      registration_closes_at: Date;
      registration_opens_at: Date;
      rules: unknown;
      rules_version: string;
      starts_at: Date;
      status: string;
    },
    goalsByCompetition: Map<string, { goalDays: number; label: string }[]>,
    enrollmentsByCompetition: Map<string, number>,
    rewardsByCompetition: Map<string, { published: number; total: number }>,
    gymsByCompetition: Map<string, string[]>,
  ): AdminDashboardCompetitionDto {
    const rewardCount = rewardsByCompetition.get(competition.id);
    return {
      assignedGymIds: gymsByCompetition.get(competition.id) ?? [],
      draw:
        competition.draw_id &&
        competition.draw_status &&
        competition.draw_status !== 'cancelled' &&
        competition.draw_locked_at &&
        competition.draw_seed_commitment &&
        competition.draw_entrant_snapshot_hash &&
        competition.draw_scoring_snapshot_hash &&
        competition.draw_reward_snapshot_hash &&
        competition.draw_public_result_snapshot_hash &&
        competition.draw_entrant_count !== null &&
        competition.draw_reward_slot_count !== null &&
        competition.draw_total_entries !== null
          ? {
              entrantCount: competition.draw_entrant_count,
              entrantSnapshotHash: competition.draw_entrant_snapshot_hash,
              id: competition.draw_id,
              lockedAt: competition.draw_locked_at.toISOString(),
              publicResultSnapshotHash:
                competition.draw_public_result_snapshot_hash,
              rewardSlotCount: competition.draw_reward_slot_count,
              rewardSnapshotHash: competition.draw_reward_snapshot_hash,
              scoringSnapshotHash: competition.draw_scoring_snapshot_hash,
              seedCommitment: competition.draw_seed_commitment,
              settledAt: competition.draw_settled_at?.toISOString() ?? null,
              status: competition.draw_status,
              totalEntries: String(competition.draw_total_entries),
            }
          : null,
      endsAt: competition.ends_at.toISOString(),
      enrollmentCount: enrollmentsByCompetition.get(competition.id) ?? 0,
      entrantCap: competition.entrant_cap,
      goalBrackets: goalsByCompetition.get(competition.id) ?? [],
      id: competition.id,
      minimumEntrants: competition.minimum_entrants,
      monthKey: competition.month_key,
      name: competition.name,
      publishedRewardCount: rewardCount?.published ?? 0,
      regionCode: competition.region_code,
      regionName: competition.region_name,
      regionPolicyId: competition.region_policy_id,
      registrationClosesAt: competition.registration_closes_at.toISOString(),
      registrationOpensAt: competition.registration_opens_at.toISOString(),
      rewardCount: rewardCount?.total ?? 0,
      rules: competition.rules as Record<string, unknown>,
      rulesVersion: competition.rules_version,
      startsAt: competition.starts_at.toISOString(),
      status: competition.status,
      version: competition.configuration_version,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { JsonObject } from '../../database/database.types';
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
          enrollmentCounts,
          rewardCounts,
          rewards,
          couponCounts,
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
            .select(['legal_document_id', 'next_state'])
            .orderBy('created_at', 'desc')
            .orderBy('id', 'desc')
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
        const legalStateByDocument = new Map<string, string>();
        for (const event of legalDocumentEvents) {
          if (!legalStateByDocument.has(event.legal_document_id)) {
            legalStateByDocument.set(event.legal_document_id, event.next_state);
          }
        }

        return {
          admin: {
            email: admin.email ?? principal.email ?? '',
            id: admin.id,
            roles: admin.roles,
          },
          auditEvents: auditEvents.map((event) => ({
            action: event.action,
            actorEmail: event.actor_email,
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
            const state = legalStateByDocument.get(document.id);
            return {
              content: document.content as JsonObject,
              contentSha256: document.content_sha256,
              documentKey: document.document_key,
              effectiveAt: document.effective_at.toISOString(),
              id: document.id,
              jurisdictionCode: document.jurisdiction_code,
              locale: document.locale,
              ownerApprovedAt:
                document.owner_approved_at?.toISOString() ?? null,
              receiptRequirement: document.receipt_requirement,
              status:
                state === 'withdrawn'
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
          })),
          rewards: rewards.map((reward) => {
            const coupons = couponsByReward.get(reward.id);
            return {
              assignedCouponCodeCount: coupons?.assigned ?? 0,
              availableFrom: reward.available_from?.toISOString() ?? null,
              availableUntil: reward.available_until?.toISOString() ?? null,
              claimUrl: reward.claim_url,
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
        };
      });
  }

  private toCompetition(
    competition: {
      configuration_version: number;
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
  ): AdminDashboardCompetitionDto {
    const rewardCount = rewardsByCompetition.get(competition.id);
    return {
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

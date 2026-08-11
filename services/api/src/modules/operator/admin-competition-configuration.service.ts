import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type {
  CompetitionStatus,
  JsonObject,
  JsonValue,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  canDeleteCompetition,
  requiresExclusiveCompetitionSlot,
} from './admin-deletion-policy';
import {
  assertUniqueGoalBrackets,
  parseAdminCompetitionRules,
  parseCompetitionSchedule,
} from './admin-configuration.validation';
import { AdminAuthorizationService } from './admin-authorization.service';
import {
  CompetitionStatusAction,
  type AdminDeletedEntityResponseDto,
  type AdminEntityResponseDto,
  type CompetitionStatusActionDto,
  type CreateCompetitionDraftDto,
  type DeleteVersionedAdminEntityDto,
  type UpdateCompetitionDraftDto,
} from './dto/admin-configuration.dto';

interface AdminEntityJson extends JsonObject {
  id: string;
  status: CompetitionStatus;
  version: number;
}

interface DeletedEntityJson extends JsonObject {
  id: string;
  status: 'deleted';
}

const partnerCompetitionRules = parseAdminCompetitionRules({
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: false,
  requireGymQr: true,
  requirePresenceCheck: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 10,
  verifiedSessionPrizeDrawEntries: 2,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
});

@Injectable()
export class AdminCompetitionConfigurationService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
  ) {}

  create(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    const validated = this.validateDraft(input);

    return this.idempotency.execute<AdminEntityJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope: 'admin-competitions:create',
      },
      async (transaction) => {
        const actor = await this.resolveCreateActor(
          principal,
          transaction,
          input,
        );
        this.assertPartnerLimits(input, actor.proposalGymId);
        await this.lockCompetitionSlot(
          transaction,
          input.regionPolicyId,
          input.monthKey,
          actor.proposalGymId,
        );
        await this.assertRegionExists(transaction, input.regionPolicyId);
        await this.assertCompetitionSlotAvailable(
          transaction,
          input.monthKey,
          actor.proposalGymId,
        );

        const now = new Date();
        const competition = await transaction
          .insertInto('competitions')
          .values({
            ends_at: validated.schedule.endsAt,
            entrant_cap: input.entrantCap ?? null,
            minimum_entrants: input.minimumEntrants,
            month_key: input.monthKey,
            name: input.name.trim(),
            region_policy_id: input.regionPolicyId,
            registration_closes_at: validated.schedule.registrationClosesAt,
            registration_opens_at: validated.schedule.registrationOpensAt,
            rules: (actor.proposalGymId
              ? partnerCompetitionRules
              : validated.rules) as unknown as JsonObject,
            rules_version: actor.proposalGymId
              ? 'partner-proposal-v1'
              : input.rulesVersion,
            starts_at: validated.schedule.startsAt,
            status: 'draft',
            created_at: now,
            updated_at: now,
          })
          .returning(['configuration_version', 'id', 'status'])
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('competition_goal_brackets')
          .values(
            input.goalBrackets.map((bracket) => ({
              competition_id: competition.id,
              created_at: now,
              goal_days: bracket.goalDays,
              label: bracket.label.trim(),
            })),
          )
          .execute();
        if (actor.proposalGymId) {
          await transaction
            .insertInto('competition_gym_locations')
            .values({
              competition_id: competition.id,
              created_at: now,
              gym_location_id: actor.proposalGymId,
            })
            .executeTakeFirstOrThrow();
          await transaction
            .insertInto('partner_competition_proposals')
            .values({
              competition_id: competition.id,
              created_at: now,
              gym_location_id: actor.proposalGymId,
              month_key: input.monthKey,
              proposed_by_user_id: actor.user.id,
              updated_at: now,
            })
            .executeTakeFirstOrThrow();
        }
        await this.authorization.audit(transaction, {
          action: actor.proposalGymId
            ? 'competition.partner_draft_created'
            : 'competition.created',
          actorUserId: actor.user.id,
          entityId: competition.id,
          entityType: 'competitions',
          nextState: this.competitionAuditState(
            actor.proposalGymId
              ? { ...input, rulesVersion: 'partner-proposal-v1' }
              : input,
            'draft',
            1,
          ),
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          id: competition.id,
          status: competition.status,
          version: competition.configuration_version,
        };
      },
    );
  }

  update(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: UpdateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    const validated = this.validateDraft(input);

    return this.idempotency.execute<AdminEntityJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId } as unknown as JsonObject,
        scope: `admin-competitions:${competitionId}:update`,
      },
      async (transaction) => {
        const current = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', competitionId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!current) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        if (current.status !== 'draft') {
          throw new ConflictException({
            code: 'COMPETITION_CONFIGURATION_LOCKED',
            message: 'Only draft competitions can be reconfigured.',
          });
        }
        const actor = await this.resolveUpdateActor(
          principal,
          transaction,
          competitionId,
          input,
        );
        this.assertPartnerLimits(input, actor.proposalGymId);
        this.assertExpectedVersion(
          current.configuration_version,
          input.expectedVersion,
        );
        await this.lockCompetitionSlot(
          transaction,
          input.regionPolicyId,
          input.monthKey,
          actor.proposalGymId,
        );
        await this.assertRegionExists(transaction, input.regionPolicyId);
        await this.assertCompetitionSlotAvailable(
          transaction,
          input.monthKey,
          actor.proposalGymId,
          competitionId,
        );

        const now = new Date();
        const updated = await transaction
          .updateTable('competitions')
          .set({
            configuration_version: sql<number>`configuration_version + 1`,
            ends_at: validated.schedule.endsAt,
            entrant_cap: input.entrantCap ?? null,
            minimum_entrants: input.minimumEntrants,
            month_key: input.monthKey,
            name: input.name.trim(),
            region_policy_id: input.regionPolicyId,
            registration_closes_at: validated.schedule.registrationClosesAt,
            registration_opens_at: validated.schedule.registrationOpensAt,
            rules: (actor.proposalGymId
              ? partnerCompetitionRules
              : validated.rules) as unknown as JsonObject,
            rules_version: actor.proposalGymId
              ? 'partner-proposal-v1'
              : input.rulesVersion,
            starts_at: validated.schedule.startsAt,
            updated_at: now,
          })
          .where('id', '=', competitionId)
          .where('configuration_version', '=', input.expectedVersion)
          .returning(['configuration_version', 'id', 'status'])
          .executeTakeFirst();
        if (!updated) {
          throw this.versionConflict();
        }
        await transaction
          .deleteFrom('competition_goal_brackets')
          .where('competition_id', '=', competitionId)
          .execute();
        await transaction
          .insertInto('competition_goal_brackets')
          .values(
            input.goalBrackets.map((bracket) => ({
              competition_id: competitionId,
              created_at: now,
              goal_days: bracket.goalDays,
              label: bracket.label.trim(),
            })),
          )
          .execute();
        if (actor.proposalGymId) {
          await transaction
            .updateTable('partner_competition_proposals')
            .set({ month_key: input.monthKey, updated_at: now })
            .where('competition_id', '=', competitionId)
            .executeTakeFirstOrThrow();
        }
        await this.authorization.audit(transaction, {
          action: actor.proposalGymId
            ? 'competition.partner_draft_updated'
            : 'competition.updated',
          actorUserId: actor.user.id,
          entityId: competitionId,
          entityType: 'competitions',
          nextState: this.competitionAuditState(
            actor.proposalGymId
              ? { ...input, rulesVersion: 'partner-proposal-v1' }
              : input,
            updated.status,
            updated.configuration_version,
          ),
          previousState: {
            monthKey: current.month_key,
            regionPolicyId: current.region_policy_id,
            status: current.status,
            version: current.configuration_version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          id: updated.id,
          status: updated.status,
          version: updated.configuration_version,
        };
      },
    );
  }

  changeStatus(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: CompetitionStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.idempotency.execute<AdminEntityJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId },
        scope: `admin-competitions:${competitionId}:status`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const competition = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', competitionId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!competition) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        this.assertExpectedVersion(
          competition.configuration_version,
          input.expectedVersion,
        );

        const nextStatus =
          input.action === CompetitionStatusAction.PUBLISH
            ? await this.assertPublishable(transaction, competition)
            : this.assertCancellable(competition.status, competition.starts_at);
        const updated = await transaction
          .updateTable('competitions')
          .set({
            configuration_version: sql<number>`configuration_version + 1`,
            status: nextStatus,
            updated_at: new Date(),
          })
          .where('id', '=', competitionId)
          .where('configuration_version', '=', input.expectedVersion)
          .returning(['configuration_version', 'id', 'status'])
          .executeTakeFirst();
        if (!updated) {
          throw this.versionConflict();
        }

        if (
          nextStatus === 'cancelled' &&
          competition.status === 'registration'
        ) {
          const enrollments = await transaction
            .selectFrom('competition_enrollments')
            .select(['id', 'user_id'])
            .where('competition_id', '=', competitionId)
            .where('status', '=', 'active')
            .execute();
          await transaction
            .updateTable('competition_enrollments')
            .set({ status: 'withdrawn' })
            .where('competition_id', '=', competitionId)
            .where('status', '=', 'active')
            .execute();
          for (const enrollment of enrollments) {
            await this.notifications.enqueue(
              transaction,
              enrollment.user_id,
              'competition_cancelled',
              { competitionId },
            );
          }
        }

        await this.authorization.audit(transaction, {
          action: `competition.${nextStatus}`,
          actorUserId: admin.id,
          entityId: competitionId,
          entityType: 'competitions',
          nextState: {
            status: updated.status,
            version: updated.configuration_version,
          },
          previousState: {
            status: competition.status,
            version: competition.configuration_version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          id: updated.id,
          status: updated.status,
          version: updated.configuration_version,
        };
      },
    );
  }

  delete(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.idempotency.execute<DeletedEntityJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId },
        scope: `admin-competitions:${competitionId}:delete`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const competition = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', competitionId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!competition) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        this.assertExpectedVersion(
          competition.configuration_version,
          input.expectedVersion,
        );
        if (!canDeleteCompetition(competition.status)) {
          throw new ConflictException({
            code: 'COMPETITION_DELETE_REQUIRES_TERMINAL_STATUS',
            message:
              'Only draft, cancelled, or settled competitions can be deleted from the dashboard.',
          });
        }

        const deletedAt = new Date();
        const deleted = await transaction
          .updateTable('competitions')
          .set({
            configuration_version: sql<number>`configuration_version + 1`,
            deleted_at: deletedAt,
            updated_at: deletedAt,
          })
          .where('id', '=', competitionId)
          .where('configuration_version', '=', input.expectedVersion)
          .where('deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!deleted) throw this.versionConflict();
        await transaction
          .deleteFrom('partner_competition_proposals')
          .where('competition_id', '=', competitionId)
          .execute();
        await this.authorization.audit(transaction, {
          action: 'competition.deleted',
          actorUserId: admin.id,
          entityId: competitionId,
          entityType: 'competitions',
          nextState: {
            deletedAt: deletedAt.toISOString(),
            status: 'deleted',
          },
          previousState: {
            monthKey: competition.month_key,
            name: competition.name,
            status: competition.status,
            version: competition.configuration_version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { id: deleted.id, status: 'deleted' };
      },
    );
  }

  private validateDraft(input: CreateCompetitionDraftDto) {
    const schedule = parseCompetitionSchedule(input);
    const rules = parseAdminCompetitionRules(input.rules);
    assertUniqueGoalBrackets(input.goalBrackets);
    if (input.minimumEntrants !== 1) {
      throw new BadRequestException({
        code: 'COMPETITION_MINIMUM_ENTRANTS_INVALID',
        message: 'A contest must be able to start with one entrant.',
      });
    }
    if (
      input.entrantCap !== undefined &&
      input.entrantCap !== null &&
      input.entrantCap < input.minimumEntrants
    ) {
      throw new BadRequestException({
        code: 'COMPETITION_ENTRANT_LIMITS_INVALID',
        message: 'The entrant cap cannot be lower than minimum entrants.',
      });
    }
    return { rules, schedule };
  }

  private async resolveCreateActor(
    principal: AuthenticatedPrincipal,
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    input: CreateCompetitionDraftDto,
  ) {
    const access = await this.authorization.resolvePortalAccess(
      principal,
      transaction,
    );
    if (access.kind === 'platform_admin') {
      return { proposalGymId: null, user: access.user };
    }
    if (!input.gymLocationId) {
      throw new BadRequestException({
        code: 'PARTNER_COMPETITION_GYM_REQUIRED',
        message: 'Choose an assigned gym for the competition proposal.',
      });
    }
    const assignment = access.assignments.find(
      (candidate) => candidate.gymLocationId === input.gymLocationId,
    );
    if (!assignment || assignment.accessLevel !== 'admin') {
      throw new ForbiddenException({
        code: 'PARTNER_COMPETITION_ADMIN_REQUIRED',
        message:
          'Gym administrator access is required to propose a competition.',
      });
    }
    await this.assertPartnerGymRegion(
      transaction,
      input.gymLocationId,
      input.regionPolicyId,
    );
    return { proposalGymId: input.gymLocationId, user: access.user };
  }

  private assertPartnerLimits(
    input: CreateCompetitionDraftDto,
    proposalGymId: string | null,
  ): void {
    if (!proposalGymId) return;
    if (input.minimumEntrants > 500) {
      throw new BadRequestException({
        code: 'PARTNER_COMPETITION_MINIMUM_TOO_HIGH',
        message: 'Partner competition minimum entrants cannot exceed 500.',
      });
    }
    if (input.entrantCap !== undefined && input.entrantCap !== null) {
      if (input.entrantCap > 5_000) {
        throw new BadRequestException({
          code: 'PARTNER_COMPETITION_CAP_TOO_HIGH',
          message: 'Partner competition entrant cap cannot exceed 5,000.',
        });
      }
    }
  }

  private async resolveUpdateActor(
    principal: AuthenticatedPrincipal,
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    competitionId: string,
    input: UpdateCompetitionDraftDto,
  ) {
    const [access, proposal] = await Promise.all([
      this.authorization.resolvePortalAccess(principal, transaction),
      transaction
        .selectFrom('partner_competition_proposals')
        .select('gym_location_id')
        .where('competition_id', '=', competitionId)
        .executeTakeFirst(),
    ]);
    if (access.kind === 'gym_partner') {
      if (!proposal) {
        throw new ForbiddenException({
          code: 'PARTNER_COMPETITION_SCOPE_FORBIDDEN',
          message: 'Partners can edit only gym-owned competition proposals.',
        });
      }
      const assignment = access.assignments.find(
        (candidate) => candidate.gymLocationId === proposal.gym_location_id,
      );
      if (!assignment || assignment.accessLevel !== 'admin') {
        throw new ForbiddenException({
          code: 'PARTNER_COMPETITION_ADMIN_REQUIRED',
          message:
            'Gym administrator access is required to edit this competition proposal.',
        });
      }
    }
    if (
      proposal &&
      input.gymLocationId &&
      input.gymLocationId !== proposal.gym_location_id
    ) {
      throw new BadRequestException({
        code: 'PARTNER_COMPETITION_GYM_IMMUTABLE',
        message:
          'A gym-owned competition proposal cannot be moved to another gym.',
      });
    }
    if (proposal) {
      await this.assertPartnerGymRegion(
        transaction,
        proposal.gym_location_id,
        input.regionPolicyId,
      );
    }
    return {
      proposalGymId: proposal?.gym_location_id ?? null,
      user: access.user,
    };
  }

  private async assertPartnerGymRegion(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    gymLocationId: string,
    regionPolicyId: string,
  ): Promise<void> {
    const gym = await transaction
      .selectFrom('gym_locations')
      .select(['id', 'region_policy_id'])
      .where('id', '=', gymLocationId)
      .where('active', '=', true)
      .executeTakeFirst();
    if (!gym) {
      throw new NotFoundException({
        code: 'GYM_LOCATION_NOT_FOUND',
        message: 'The assigned gym was not found or is inactive.',
      });
    }
    if (gym.region_policy_id !== regionPolicyId) {
      throw new BadRequestException({
        code: 'PARTNER_COMPETITION_REGION_MISMATCH',
        message: 'The competition must use the assigned gym region.',
      });
    }
  }

  private async assertRegionExists(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    regionPolicyId: string,
  ): Promise<void> {
    const region = await transaction
      .selectFrom('region_policies')
      .select('id')
      .where('id', '=', regionPolicyId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!region) {
      throw new NotFoundException({
        code: 'REGION_POLICY_NOT_FOUND',
        message: 'The region policy was not found.',
      });
    }
  }

  private async lockCompetitionSlot(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    regionPolicyId: string,
    monthKey: string,
    proposalGymId: string | null,
  ): Promise<void> {
    const slot = proposalGymId
      ? `partner:${proposalGymId}:${monthKey}`
      : `platform:${regionPolicyId}:${monthKey}`;
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${slot}, 0))`.execute(
      transaction,
    );
  }

  private async assertCompetitionSlotAvailable(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    monthKey: string,
    proposalGymId: string | null,
    excludingCompetitionId?: string,
  ): Promise<void> {
    if (!requiresExclusiveCompetitionSlot(proposalGymId)) return;
    const duplicate = await transaction
      .selectFrom('partner_competition_proposals')
      .select('competition_id')
      .where('gym_location_id', '=', proposalGymId!)
      .where('month_key', '=', monthKey)
      .$if(Boolean(excludingCompetitionId), (query) =>
        query.where('competition_id', '!=', excludingCompetitionId!),
      )
      .executeTakeFirst();
    if (duplicate) {
      throw new ConflictException({
        code: 'PARTNER_COMPETITION_GYM_MONTH_EXISTS',
        message: 'This gym already has a competition proposal for that month.',
      });
    }
  }

  private async assertPublishable(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    competition: {
      ends_at: Date;
      id: string;
      region_policy_id: string;
      registration_closes_at: Date;
      registration_opens_at: Date;
      rules: JsonValue;
      starts_at: Date;
      status: CompetitionStatus;
    },
  ): Promise<'registration'> {
    if (competition.status !== 'draft') {
      throw new ConflictException({
        code: 'COMPETITION_CANNOT_BE_PUBLISHED',
        message: 'Only a draft competition can be published.',
      });
    }
    const now = new Date();
    if (competition.ends_at <= now) {
      throw new ConflictException({
        code: 'COMPETITION_PUBLISH_WINDOW_CLOSED',
        message: 'An ended competition cannot be published.',
      });
    }
    const rules = parseAdminCompetitionRules(competition.rules);
    const [region, bracket, reward, activeGym] = await Promise.all([
      transaction
        .selectFrom('region_policies')
        .select(['competition_enabled', 'valid_from', 'valid_to'])
        .where('id', '=', competition.region_policy_id)
        .executeTakeFirst(),
      transaction
        .selectFrom('competition_goal_brackets')
        .select('goal_days')
        .where('competition_id', '=', competition.id)
        .executeTakeFirst(),
      transaction
        .selectFrom('reward_catalog_items')
        .select('id')
        .where('competition_id', '=', competition.id)
        .where('status', '=', 'published')
        .executeTakeFirst(),
      rules.requireGymQr
        ? transaction
            .selectFrom('competition_gym_locations as competition_gym')
            .innerJoin(
              'gym_locations as gym',
              'gym.id',
              'competition_gym.gym_location_id',
            )
            .select('gym.id')
            .where('competition_gym.competition_id', '=', competition.id)
            .where('gym.active', '=', true)
            .executeTakeFirst()
        : Promise.resolve({ id: 'not-required' }),
    ]);
    if (!region) {
      throw new NotFoundException({
        code: 'REGION_POLICY_NOT_FOUND',
        message: 'The region policy was not found.',
      });
    }
    if (!region.competition_enabled) {
      throw new ConflictException({
        code: 'REGION_NOT_ENABLED_FOR_COMPETITION',
        message: 'Competition operations must be enabled for the region.',
      });
    }
    if (
      region.valid_from > competition.registration_opens_at ||
      (region.valid_to !== null && region.valid_to < competition.ends_at)
    ) {
      throw new ConflictException({
        code: 'REGION_POLICY_VALIDITY_TOO_SHORT',
        message:
          'The region policy must cover the entire competition lifecycle.',
      });
    }
    if (!bracket) {
      throw new ConflictException({
        code: 'COMPETITION_GOAL_BRACKET_REQUIRED',
        message: 'At least one goal bracket is required before publishing.',
      });
    }
    if (!reward) {
      throw new ConflictException({
        code: 'COMPETITION_REWARD_REQUIRED',
        message:
          'Publish at least one reward before publishing the competition.',
      });
    }
    if (rules.requireGymQr && !activeGym) {
      throw new ConflictException({
        code: 'COMPETITION_GYM_REQUIRED',
        message:
          'Assign at least one active gym location before publishing a QR-required competition.',
      });
    }
    return 'registration';
  }

  private assertCancellable(
    status: CompetitionStatus,
    startsAt: Date,
  ): 'cancelled' {
    if (
      status !== 'draft' &&
      (status !== 'registration' || startsAt <= new Date())
    ) {
      throw new ConflictException({
        code: 'COMPETITION_CANNOT_BE_CANCELLED',
        message:
          'Only a draft or not-yet-started registration can be cancelled.',
      });
    }
    return 'cancelled';
  }

  private assertExpectedVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw this.versionConflict();
    }
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'COMPETITION_VERSION_CONFLICT',
      message: 'The competition changed; reload it before retrying.',
    });
  }

  private competitionAuditState(
    input: CreateCompetitionDraftDto,
    status: CompetitionStatus,
    version: number,
  ): JsonObject {
    return {
      endsAt: input.endsAt,
      monthKey: input.monthKey,
      regionPolicyId: input.regionPolicyId,
      rulesVersion: input.rulesVersion,
      startsAt: input.startsAt,
      status,
      version,
    };
  }
}

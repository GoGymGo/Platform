import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type {
  CompetitionStatus,
  JsonObject,
  JsonValue,
  PartnerCompetitionProposalStatus,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { closeCompetitionParticipation } from '../competitions/competition-participation';
import { LegalDocumentsService } from '../legal/legal-documents.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  isSeptemberPilotCompetition,
  septemberPilotRewardConfigurationErrors,
} from '../rewards/september-pilot-cash-policy';
import {
  canCancelCompetition,
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
  type AdminCompetitionPublicationPreflightDto,
  type AdminDeletedEntityResponseDto,
  type AdminEntityResponseDto,
  type CompetitionStatusActionDto,
  type CreateCompetitionDraftDto,
  type DeleteVersionedAdminEntityDto,
  type UpdateCompetitionDraftDto,
} from './dto/admin-configuration.dto';
import {
  PartnerProposalAction,
  type PartnerProposalActionResponseDto,
  type PartnerProposalStatusActionDto,
} from './dto/operator-portal.dto';

interface AdminEntityJson extends JsonObject {
  id: string;
  status: CompetitionStatus;
  version: number;
}

interface DeletedEntityJson extends JsonObject {
  id: string;
  status: 'deleted';
}

interface PartnerProposalActionJson extends JsonObject {
  id: string;
  status: PartnerCompetitionProposalStatus;
  version: number;
}

type PublicationEvidence = {
  goalBracketCount: number;
  gymQr: {
    activeAssignedGymCount: number;
    activeCredentialCount: number;
    credentialExpiresAt: string[];
  };
  legal: {
    bundleSha256: string | null;
    configured: boolean;
    documents: Array<{
      contentSha256: string;
      documentKey: string;
      version: string;
    }>;
  };
  region: {
    boundaryVersion: string;
    competitionEnabled: boolean;
    policyVersion: string;
    validFrom: string;
    validTo: string | null;
  } | null;
  rewards: {
    inventoryTotal: number;
    publishedCount: number;
  };
  rules: { requireGymQr: boolean };
  schedule: {
    endsAt: string;
    registrationClosesAt: string;
    registrationOpensAt: string;
    startsAt: string;
  };
  status: CompetitionStatus;
};

const partnerCompetitionRules = parseAdminCompetitionRules({
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: false,
  requireGymQr: true,
  requirePresenceCheck: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
});

@Injectable()
export class AdminCompetitionConfigurationService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly legalDocuments: LegalDocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  getPublicationPreflight(
    principal: AuthenticatedPrincipal,
    competitionId: string,
  ): Promise<AdminCompetitionPublicationPreflightDto> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        await this.authorization.requireAdmin(principal, transaction);
        const competition = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', competitionId)
          .where('deleted_at', 'is', null)
          .executeTakeFirst();
        if (!competition) {
          throw new NotFoundException({
            code: 'COMPETITION_NOT_FOUND',
            message: 'The competition was not found.',
          });
        }
        const evaluatedAt = new Date();
        const evidence = await this.getPublicationEvidence(
          transaction,
          competition,
        );
        let blockingIssue: { code: string; message: string } | null = null;
        try {
          await this.assertPublishable(transaction, competition, evaluatedAt);
        } catch (error) {
          if (!(error instanceof HttpException)) throw error;
          const response = error.getResponse();
          const body =
            typeof response === 'object' && response !== null
              ? (response as { code?: unknown; message?: unknown })
              : null;
          blockingIssue = {
            code:
              typeof body?.code === 'string'
                ? body.code
                : 'COMPETITION_PUBLICATION_BLOCKED',
            message:
              typeof body?.message === 'string'
                ? body.message
                : 'Competition publication prerequisites are not satisfied.',
          };
        }
        return {
          checks: this.publicationChecks(evidence, blockingIssue, evaluatedAt),
          competitionId,
          evaluatedAt: evaluatedAt.toISOString(),
          evidence,
          ready: blockingIssue === null,
          version: competition.configuration_version,
        };
      });
  }

  create(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.createDraft(principal, idempotencyKey, input, 'platform');
  }

  createProposal(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.createDraft(principal, idempotencyKey, input, 'partner');
  }

  private createDraft(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateCompetitionDraftDto,
    mode: 'partner' | 'platform',
  ): Promise<AdminEntityResponseDto> {
    const validated = this.validateDraft(input);

    return this.idempotency.execute<
      AdminEntityJson,
      Awaited<
        ReturnType<AdminCompetitionConfigurationService['resolveCreateActor']>
      >
    >(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope:
          mode === 'partner'
            ? 'partner-competition-proposals:create'
            : 'admin-competitions:create',
      },
      async (transaction, actor) => {
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
              status: 'draft',
              status_changed_by_user_id: actor.user.id,
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
      (transaction) =>
        this.resolveCreateActor(principal, transaction, input, mode),
    );
  }

  update(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: UpdateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.updateDraft(
      principal,
      competitionId,
      idempotencyKey,
      input,
      'platform',
    );
  }

  updateProposal(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: UpdateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.updateDraft(
      principal,
      competitionId,
      idempotencyKey,
      input,
      'partner',
    );
  }

  private updateDraft(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: UpdateCompetitionDraftDto,
    mode: 'partner' | 'platform',
  ): Promise<AdminEntityResponseDto> {
    const validated = this.validateDraft(input);

    return this.idempotency.execute<
      AdminEntityJson,
      Awaited<
        ReturnType<AdminCompetitionConfigurationService['resolveUpdateActor']>
      >
    >(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId } as unknown as JsonObject,
        scope:
          mode === 'partner'
            ? `partner-competition-proposals:${competitionId}:update`
            : `admin-competitions:${competitionId}:update`,
      },
      async (transaction, actor) => {
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
        const currentProposalStatus = actor.proposalGymId
          ? (
              await transaction
                .selectFrom('partner_competition_proposals')
                .select('status')
                .where('competition_id', '=', competitionId)
                .where('gym_location_id', '=', actor.proposalGymId)
                .forUpdate()
                .executeTakeFirstOrThrow()
            ).status
          : null;
        if (
          mode === 'partner' &&
          currentProposalStatus !== 'draft' &&
          currentProposalStatus !== 'withdrawn'
        ) {
          throw new ConflictException({
            code: 'PARTNER_PROPOSAL_NOT_EDITABLE',
            message:
              'Withdraw a submitted proposal before editing it. Published or archived proposals cannot be edited.',
          });
        }
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
      (transaction) =>
        this.resolveUpdateActor(
          principal,
          transaction,
          competitionId,
          input,
          mode,
        ),
    );
  }

  changeStatus(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: CompetitionStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.idempotency.execute<
      AdminEntityJson,
      Awaited<ReturnType<AdminAuthorizationService['requireAdmin']>>
    >(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId },
        scope: `admin-competitions:${competitionId}:status`,
      },
      async (transaction, admin) => {
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
            : this.assertCancellable(competition.status);
        const changedAt = new Date();
        const updated = await transaction
          .updateTable('competitions')
          .set({
            configuration_version: sql<number>`configuration_version + 1`,
            status: nextStatus,
            updated_at: changedAt,
          })
          .where('id', '=', competitionId)
          .where('configuration_version', '=', input.expectedVersion)
          .returning(['configuration_version', 'id', 'status'])
          .executeTakeFirst();
        if (!updated) {
          throw this.versionConflict();
        }

        const proposal = await transaction
          .selectFrom('partner_competition_proposals')
          .select(['lifecycle_version', 'status'])
          .where('competition_id', '=', competitionId)
          .forUpdate()
          .executeTakeFirst();
        if (proposal && nextStatus === 'registration') {
          await transaction
            .updateTable('partner_competition_proposals')
            .set({
              lifecycle_version: sql<number>`lifecycle_version + 1`,
              published_at: changedAt,
              status: 'published',
              status_changed_by_user_id: admin.id,
              updated_at: changedAt,
            })
            .where('competition_id', '=', competitionId)
            .where('lifecycle_version', '=', proposal.lifecycle_version)
            .where('status', '=', 'submitted')
            .executeTakeFirstOrThrow();
        } else if (
          proposal &&
          nextStatus === 'cancelled' &&
          proposal.status !== 'published' &&
          proposal.status !== 'archived'
        ) {
          await transaction
            .updateTable('partner_competition_proposals')
            .set({
              archived_at: changedAt,
              lifecycle_version: sql<number>`lifecycle_version + 1`,
              status: 'archived',
              status_changed_by_user_id: admin.id,
              updated_at: changedAt,
            })
            .where('competition_id', '=', competitionId)
            .where('lifecycle_version', '=', proposal.lifecycle_version)
            .executeTakeFirstOrThrow();
        }

        if (nextStatus === 'cancelled' && competition.status !== 'draft') {
          const enrollments = await closeCompetitionParticipation(
            transaction,
            competitionId,
            changedAt,
          );
          for (const enrollment of enrollments) {
            await this.notifications.enqueue(
              transaction,
              enrollment.userId,
              'competition_cancelled',
              { competitionId },
            );
          }
        }
        if (nextStatus === 'cancelled') {
          await transaction
            .updateTable('gym_qr_credentials')
            .set({
              qr_payload: null,
              revoked_at: changedAt,
              revoked_by_user_id: admin.id,
              revocation_reason: input.reason,
              status: 'revoked',
            })
            .where('competition_id', '=', competitionId)
            .where('status', '=', 'active')
            .execute();
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
      (transaction) => this.authorization.requireAdmin(principal, transaction),
    );
  }

  changeProposalStatus(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: PartnerProposalStatusActionDto,
  ): Promise<PartnerProposalActionResponseDto> {
    return this.idempotency.execute<
      PartnerProposalActionJson,
      Awaited<
        ReturnType<
          AdminCompetitionConfigurationService['requireProposalGymAdmin']
        >
      >
    >(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId },
        scope: `partner-competition-proposals:${competitionId}:status`,
      },
      async (transaction, actor) => {
        const proposal = await transaction
          .selectFrom('partner_competition_proposals')
          .innerJoin(
            'competitions',
            'competitions.id',
            'partner_competition_proposals.competition_id',
          )
          .select([
            'competitions.configuration_version',
            'competitions.deleted_at',
            'competitions.status as competition_status',
            'partner_competition_proposals.archived_at',
            'partner_competition_proposals.lifecycle_version',
            'partner_competition_proposals.published_at',
            'partner_competition_proposals.status',
            'partner_competition_proposals.submitted_at',
            'partner_competition_proposals.withdrawn_at',
          ])
          .where(
            'partner_competition_proposals.competition_id',
            '=',
            competitionId,
          )
          .where(
            'partner_competition_proposals.gym_location_id',
            '=',
            actor.gymLocationId,
          )
          .forUpdate()
          .executeTakeFirst();
        if (!proposal) {
          throw new NotFoundException({
            code: 'PARTNER_PROPOSAL_NOT_FOUND',
            message: 'The gym-owned Contest proposal was not found.',
          });
        }
        if (proposal.lifecycle_version !== input.expectedVersion) {
          throw new ConflictException({
            code: 'PARTNER_PROPOSAL_VERSION_CONFLICT',
            message: 'The proposal changed; reload it before retrying.',
          });
        }
        if (
          proposal.deleted_at !== null ||
          proposal.competition_status !== 'draft'
        ) {
          throw new ConflictException({
            code: 'PARTNER_PROPOSAL_CONFIGURATION_LOCKED',
            message:
              'Only an unpublished Contest draft can change proposal state.',
          });
        }

        const now = new Date();
        const next = this.proposalTransition(proposal.status, input.action);
        const updated = await transaction
          .updateTable('partner_competition_proposals')
          .set({
            archived_at: next === 'archived' ? now : proposal.archived_at,
            lifecycle_version: sql<number>`lifecycle_version + 1`,
            status: next,
            status_changed_by_user_id: actor.user.id,
            submitted_at: next === 'submitted' ? now : proposal.submitted_at,
            updated_at: now,
            withdrawn_at:
              next === 'submitted'
                ? null
                : next === 'withdrawn'
                  ? now
                  : proposal.withdrawn_at,
          })
          .where('competition_id', '=', competitionId)
          .where('lifecycle_version', '=', input.expectedVersion)
          .returning(['competition_id', 'lifecycle_version', 'status'])
          .executeTakeFirst();
        if (!updated) {
          throw new ConflictException({
            code: 'PARTNER_PROPOSAL_VERSION_CONFLICT',
            message: 'The proposal changed; reload it before retrying.',
          });
        }

        if (next === 'archived') {
          await transaction
            .updateTable('competitions')
            .set({
              configuration_version: sql<number>`configuration_version + 1`,
              deleted_at: now,
              updated_at: now,
            })
            .where('id', '=', competitionId)
            .where('configuration_version', '=', proposal.configuration_version)
            .where('deleted_at', 'is', null)
            .executeTakeFirstOrThrow();
          await transaction
            .updateTable('gym_qr_credentials')
            .set({
              qr_payload: null,
              revoked_at: now,
              revoked_by_user_id: actor.user.id,
              revocation_reason: input.reason,
              status: 'revoked',
            })
            .where('competition_id', '=', competitionId)
            .where('status', '=', 'active')
            .execute();
        }

        await this.authorization.audit(transaction, {
          action: `competition.partner_proposal_${next}`,
          actorUserId: actor.user.id,
          entityId: competitionId,
          entityType: 'partner_competition_proposals',
          nextState: { status: next, version: updated.lifecycle_version },
          previousState: {
            status: proposal.status,
            version: proposal.lifecycle_version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return {
          id: updated.competition_id,
          status: updated.status,
          version: updated.lifecycle_version,
        };
      },
      (transaction) =>
        this.requireProposalGymAdmin(principal, transaction, competitionId),
    );
  }

  delete(
    principal: AuthenticatedPrincipal,
    competitionId: string,
    idempotencyKey: string,
    input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.idempotency.execute<
      DeletedEntityJson,
      Awaited<ReturnType<AdminAuthorizationService['requireAdmin']>>
    >(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, competitionId },
        scope: `admin-competitions:${competitionId}:delete`,
      },
      async (transaction, admin) => {
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
        const proposal = await transaction
          .selectFrom('partner_competition_proposals')
          .select('competition_id')
          .where('competition_id', '=', competitionId)
          .executeTakeFirst();
        if (proposal) {
          throw new ConflictException({
            code: 'PARTNER_PROPOSAL_DELETE_FORBIDDEN',
            message:
              'Gym-owned Contest proposal provenance cannot be deleted. Archive the proposal instead.',
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
      (transaction) => this.authorization.requireAdmin(principal, transaction),
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
    mode: 'partner' | 'platform',
  ) {
    if (mode === 'platform') {
      const user = await this.authorization.requireAdmin(
        principal,
        transaction,
      );
      return { proposalGymId: null, proposalStatus: null, user };
    }
    const access = await this.authorization.requirePartnerPortal(
      principal,
      transaction,
    );
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
    return {
      proposalGymId: input.gymLocationId,
      proposalStatus: 'draft' as const,
      user: access.user,
    };
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
    mode: 'partner' | 'platform',
  ) {
    const [userOrAccess, proposal] = await Promise.all([
      mode === 'platform'
        ? this.authorization.requireAdmin(principal, transaction)
        : this.authorization.requirePartnerPortal(principal, transaction),
      transaction
        .selectFrom('partner_competition_proposals')
        .select(['gym_location_id', 'status'])
        .where('competition_id', '=', competitionId)
        .executeTakeFirst(),
    ]);
    if (mode === 'partner') {
      const access = userOrAccess as Awaited<
        ReturnType<AdminAuthorizationService['requirePartnerPortal']>
      >;
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
      proposalStatus: proposal?.status ?? null,
      user:
        mode === 'partner'
          ? (
              userOrAccess as Awaited<
                ReturnType<AdminAuthorizationService['requirePartnerPortal']>
              >
            ).user
          : (userOrAccess as Awaited<
              ReturnType<AdminAuthorizationService['requireAdmin']>
            >),
    };
  }

  private async requireProposalGymAdmin(
    principal: AuthenticatedPrincipal,
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    competitionId: string,
  ) {
    const access = await this.authorization.requirePartnerPortal(
      principal,
      transaction,
    );
    const proposal = await transaction
      .selectFrom('partner_competition_proposals')
      .select('gym_location_id')
      .where('competition_id', '=', competitionId)
      .executeTakeFirst();
    if (!proposal) {
      throw new NotFoundException({
        code: 'PARTNER_PROPOSAL_NOT_FOUND',
        message: 'The gym-owned Contest proposal was not found.',
      });
    }
    const assignment = access.assignments.find(
      (candidate) => candidate.gymLocationId === proposal.gym_location_id,
    );
    if (!assignment || assignment.accessLevel !== 'admin') {
      throw new ForbiddenException({
        code: 'PARTNER_COMPETITION_ADMIN_REQUIRED',
        message:
          'Gym administrator access is required to change this proposal.',
      });
    }
    return {
      gymLocationId: proposal.gym_location_id,
      user: access.user,
    };
  }

  private proposalTransition(
    current: PartnerCompetitionProposalStatus,
    action: PartnerProposalAction,
  ): PartnerCompetitionProposalStatus {
    if (
      action === PartnerProposalAction.SUBMIT &&
      (current === 'draft' || current === 'withdrawn')
    ) {
      return 'submitted';
    }
    if (action === PartnerProposalAction.WITHDRAW && current === 'submitted') {
      return 'withdrawn';
    }
    if (
      action === PartnerProposalAction.ARCHIVE &&
      (current === 'draft' || current === 'withdrawn')
    ) {
      return 'archived';
    }
    throw new ConflictException({
      code: 'PARTNER_PROPOSAL_TRANSITION_INVALID',
      message: `A ${current} proposal cannot perform the ${action} action.`,
    });
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
      .where('deleted_at', 'is', null)
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
      .where('status', '!=', 'archived')
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

  private async getPublicationEvidence(
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
  ): Promise<PublicationEvidence> {
    const rules = parseAdminCompetitionRules(competition.rules);
    const region = await transaction
      .selectFrom('region_policies')
      .select([
        'boundary_version',
        'competition_enabled',
        'country_code',
        'policy_version',
        'subdivision_code',
        'valid_from',
        'valid_to',
      ])
      .where('id', '=', competition.region_policy_id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    const jurisdictionCode = region
      ? `${region.country_code}-${region.subdivision_code}`
      : null;
    const [goalBrackets, rewards, credentials, legalBundle] = await Promise.all(
      [
        transaction
          .selectFrom('competition_goal_brackets')
          .select('goal_days')
          .where('competition_id', '=', competition.id)
          .execute(),
        transaction
          .selectFrom('reward_catalog_items')
          .select(['id', 'inventory_total'])
          .where('competition_id', '=', competition.id)
          .where('status', '=', 'published')
          .where('deleted_at', 'is', null)
          .execute(),
        transaction
          .selectFrom('competition_gym_locations as assignment')
          .innerJoin(
            'gym_locations as gym',
            'gym.id',
            'assignment.gym_location_id',
          )
          .innerJoin('gym_qr_credentials as credential', (join) =>
            join
              .onRef(
                'credential.competition_id',
                '=',
                'assignment.competition_id',
              )
              .onRef(
                'credential.gym_location_id',
                '=',
                'assignment.gym_location_id',
              ),
          )
          .select([
            'credential.expires_at',
            'credential.id',
            'gym.id as gym_id',
          ])
          .where('assignment.competition_id', '=', competition.id)
          .where('gym.active', '=', true)
          .where('gym.deleted_at', 'is', null)
          .where('gym.region_policy_id', '=', competition.region_policy_id)
          .where('credential.status', '=', 'active')
          .where('credential.expires_at', '>=', competition.ends_at)
          .execute(),
        jurisdictionCode
          ? this.legalDocuments.resolveCurrentBundle(
              transaction,
              jurisdictionCode,
              'en',
            )
          : Promise.resolve(null),
      ],
    );
    return {
      goalBracketCount: goalBrackets.length,
      gymQr: {
        activeAssignedGymCount: new Set(
          credentials.map((credential) => credential.gym_id),
        ).size,
        activeCredentialCount: credentials.length,
        credentialExpiresAt: credentials.map((credential) =>
          credential.expires_at.toISOString(),
        ),
      },
      legal: {
        bundleSha256: legalBundle?.bundleSha256 ?? null,
        configured: legalBundle?.configured ?? false,
        documents: (legalBundle?.documents ?? []).map((document) => ({
          contentSha256: document.contentSha256,
          documentKey: document.documentKey,
          version: document.version,
        })),
      },
      region: region
        ? {
            boundaryVersion: region.boundary_version,
            competitionEnabled: region.competition_enabled,
            policyVersion: region.policy_version,
            validFrom: region.valid_from.toISOString(),
            validTo: region.valid_to?.toISOString() ?? null,
          }
        : null,
      rewards: {
        inventoryTotal: rewards.reduce(
          (total, reward) => total + reward.inventory_total,
          0,
        ),
        publishedCount: rewards.length,
      },
      rules: { requireGymQr: rules.requireGymQr },
      schedule: {
        endsAt: competition.ends_at.toISOString(),
        registrationClosesAt: competition.registration_closes_at.toISOString(),
        registrationOpensAt: competition.registration_opens_at.toISOString(),
        startsAt: competition.starts_at.toISOString(),
      },
      status: competition.status,
    };
  }

  private publicationChecks(
    evidence: PublicationEvidence,
    blockingIssue: { code: string; message: string } | null,
    evaluatedAt: Date,
  ): AdminCompetitionPublicationPreflightDto['checks'] {
    const now = evaluatedAt.getTime();
    const regionCoversSchedule = Boolean(
      evidence.region &&
      new Date(evidence.region.validFrom).getTime() <=
        new Date(evidence.schedule.registrationOpensAt).getTime() &&
      (evidence.region.validTo === null ||
        new Date(evidence.region.validTo).getTime() >=
          new Date(evidence.schedule.endsAt).getTime()),
    );
    const hasOfficialRules = evidence.legal.documents.some(
      (document) => document.documentKey === 'official_contest_rules',
    );
    const checks: AdminCompetitionPublicationPreflightDto['checks'] = [
      {
        detail: 'The Contest is still an editable draft.',
        key: 'draft_status',
        satisfied: evidence.status === 'draft',
      },
      {
        detail:
          'Registration is open and its close, start, and end remain in the future.',
        key: 'schedule',
        satisfied:
          new Date(evidence.schedule.registrationOpensAt).getTime() <= now &&
          new Date(evidence.schedule.registrationClosesAt).getTime() > now &&
          new Date(evidence.schedule.startsAt).getTime() > now &&
          new Date(evidence.schedule.endsAt).getTime() > now,
      },
      {
        detail:
          'The exact region policy is enabled and covers the full Contest lifecycle.',
        key: 'region_policy',
        satisfied: Boolean(
          evidence.region?.competitionEnabled && regionCoversSchedule,
        ),
      },
      {
        detail: `${evidence.goalBracketCount} goal bracket(s) are stored.`,
        key: 'goal_brackets',
        satisfied: evidence.goalBracketCount > 0,
      },
      {
        detail: `${evidence.rewards.publishedCount} published reward(s) with ${evidence.rewards.inventoryTotal} total slot(s) are stored.`,
        key: 'rewards',
        satisfied:
          evidence.rewards.publishedCount > 0 &&
          evidence.rewards.inventoryTotal > 0,
      },
      {
        detail:
          'The current owner-approved Privacy, Terms, and Official Contest Rules evidence resolves.',
        key: 'legal',
        satisfied: evidence.legal.configured && hasOfficialRules,
      },
      {
        detail: `${evidence.gymQr.activeAssignedGymCount} active assigned gym(s) and ${evidence.gymQr.activeCredentialCount} full-window QR credential(s) are stored.`,
        key: 'gym_qr',
        satisfied:
          evidence.rules.requireGymQr &&
          evidence.gymQr.activeAssignedGymCount > 0 &&
          evidence.gymQr.activeCredentialCount > 0,
      },
    ];
    if (blockingIssue) {
      checks.push({
        detail: blockingIssue.message,
        key: blockingIssue.code,
        satisfied: false,
      });
    }
    return checks;
  }

  private async assertPublishable(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    competition: {
      ends_at: Date;
      id: string;
      month_key: string;
      name: string;
      region_policy_id: string;
      registration_closes_at: Date;
      registration_opens_at: Date;
      rules: JsonValue;
      starts_at: Date;
      status: CompetitionStatus;
    },
    now = new Date(),
  ): Promise<'registration'> {
    if (competition.status !== 'draft') {
      throw new ConflictException({
        code: 'COMPETITION_CANNOT_BE_PUBLISHED',
        message: 'Only a draft competition can be published.',
      });
    }
    if (competition.ends_at <= now) {
      throw new ConflictException({
        code: 'COMPETITION_PUBLISH_WINDOW_CLOSED',
        message: 'An ended competition cannot be published.',
      });
    }
    if (competition.registration_opens_at > now) {
      throw new ConflictException({
        code: 'COMPETITION_REGISTRATION_NOT_OPEN',
        message:
          'Registration must already be open when the competition is published.',
      });
    }
    if (
      competition.registration_closes_at <= now ||
      competition.starts_at <= now
    ) {
      throw new ConflictException({
        code: 'COMPETITION_PUBLISH_WINDOW_CLOSED',
        message:
          'Registration close and competition start must still be in the future at publication.',
      });
    }
    const rules = parseAdminCompetitionRules(competition.rules);
    if (!rules.requireGymQr) {
      throw new ConflictException({
        code: 'COMPETITION_VERIFICATION_METHOD_UNSUPPORTED',
        message:
          'Contest publication currently requires Partner gym QR verification.',
      });
    }
    const proposal = await transaction
      .selectFrom('partner_competition_proposals')
      .select('status')
      .where('competition_id', '=', competition.id)
      .executeTakeFirst();
    if (proposal && proposal.status !== 'submitted') {
      throw new ConflictException({
        code: 'PARTNER_PROPOSAL_SUBMISSION_REQUIRED',
        message:
          'The gym administrator must submit this proposal before GoGymGo can publish it.',
      });
    }
    const region = await transaction
      .selectFrom('region_policies')
      .select([
        'code',
        'competition_enabled',
        'country_code',
        'subdivision_code',
        'valid_from',
        'valid_to',
      ])
      .where('id', '=', competition.region_policy_id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
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

    const jurisdictionCode = `${region.country_code}-${region.subdivision_code}`;
    const [bracket, rewards, activePoster, legalBundle] = await Promise.all([
      transaction
        .selectFrom('competition_goal_brackets')
        .select('goal_days')
        .where('competition_id', '=', competition.id)
        .executeTakeFirst(),
      transaction
        .selectFrom('reward_catalog_items')
        .select([
          'cash_amount_cents',
          'cash_currency',
          'claim_url',
          'fulfillment_instructions',
          'id',
          'image_url',
          'inventory_total',
          'reward_type',
          'sponsor_name',
          'terms_url',
          'title',
        ])
        .where('competition_id', '=', competition.id)
        .where('status', '=', 'published')
        .where('deleted_at', 'is', null)
        .execute(),
      rules.requireGymQr
        ? transaction
            .selectFrom('competition_gym_locations as competition_gym')
            .innerJoin(
              'gym_locations as gym',
              'gym.id',
              'competition_gym.gym_location_id',
            )
            .innerJoin('gym_qr_credentials as credential', (join) =>
              join
                .onRef(
                  'credential.competition_id',
                  '=',
                  'competition_gym.competition_id',
                )
                .onRef(
                  'credential.gym_location_id',
                  '=',
                  'competition_gym.gym_location_id',
                ),
            )
            .select('credential.id')
            .where('competition_gym.competition_id', '=', competition.id)
            .where('gym.active', '=', true)
            .where('gym.deleted_at', 'is', null)
            .where('gym.region_policy_id', '=', competition.region_policy_id)
            .where('credential.status', '=', 'active')
            .where('credential.expires_at', '>=', competition.ends_at)
            .executeTakeFirst()
        : Promise.resolve({ id: 'not-required' }),
      this.legalDocuments.resolveCurrentBundle(
        transaction,
        jurisdictionCode,
        'en',
      ),
    ]);
    if (!bracket) {
      throw new ConflictException({
        code: 'COMPETITION_GOAL_BRACKET_REQUIRED',
        message: 'At least one goal bracket is required before publishing.',
      });
    }
    if (rewards.length === 0) {
      throw new ConflictException({
        code: 'COMPETITION_REWARD_REQUIRED',
        message:
          'Publish at least one reward before publishing the competition.',
      });
    }
    if (
      isSeptemberPilotCompetition({
        monthKey: competition.month_key,
        name: competition.name,
        regionCode: region.code,
      })
    ) {
      const errors =
        rewards.length === 1
          ? septemberPilotRewardConfigurationErrors({
              cashAmountCents: rewards[0].cash_amount_cents,
              cashCurrency: rewards[0].cash_currency,
              claimUrl: rewards[0].claim_url,
              fulfillmentInstructions: rewards[0].fulfillment_instructions,
              imageUrl: rewards[0].image_url,
              inventoryTotal: rewards[0].inventory_total,
              rewardType: rewards[0].reward_type,
              sponsorName: rewards[0].sponsor_name,
              termsUrl: rewards[0].terms_url,
              title: rewards[0].title,
            })
          : ['exactly one published reward is required'];
      if (errors.length > 0) {
        throw new ConflictException({
          code: 'SEPTEMBER_PILOT_REWARD_INVALID',
          message: `The September pilot cannot be published: ${errors.join('; ')}.`,
        });
      }
    }
    if (!legalBundle.configured) {
      throw new ConflictException({
        code: 'COMPETITION_LEGAL_DOCUMENTS_REQUIRED',
        message:
          'Publish current owner-approved Privacy and Terms documents before publishing the competition.',
      });
    }
    if (
      !legalBundle.documents.some(
        (document) => document.documentKey === 'official_contest_rules',
      )
    ) {
      throw new ConflictException({
        code: 'COMPETITION_OFFICIAL_RULES_REQUIRED',
        message:
          'Publish current owner-approved Official Contest Rules before publishing the competition.',
      });
    }
    if (rules.requireGymQr && !activePoster) {
      throw new ConflictException({
        code: 'COMPETITION_GYM_QR_REQUIRED',
        message:
          'Assign an active gym and issue its active contest-specific QR poster before publishing.',
      });
    }
    return 'registration';
  }

  private assertCancellable(status: CompetitionStatus): 'cancelled' {
    if (!canCancelCompetition(status)) {
      throw new ConflictException({
        code: 'COMPETITION_CANNOT_BE_CANCELLED',
        message:
          'Only a draft, registration, or active competition can be cancelled.',
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

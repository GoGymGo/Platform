import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type {
  CompetitionStatus,
  JsonObject,
} from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertUniqueGoalBrackets,
  parseAdminCompetitionRules,
  parseCompetitionSchedule,
} from './admin-configuration.validation';
import { AdminAuthorizationService } from './admin-authorization.service';
import {
  CompetitionStatusAction,
  type AdminEntityResponseDto,
  type CompetitionStatusActionDto,
  type CreateCompetitionDraftDto,
  type UpdateCompetitionDraftDto,
} from './dto/admin-configuration.dto';

interface AdminEntityJson extends JsonObject {
  id: string;
  status: CompetitionStatus;
  version: number;
}

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
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        await this.lockRegionMonth(
          transaction,
          input.regionPolicyId,
          input.monthKey,
        );
        await this.assertRegionExists(transaction, input.regionPolicyId);
        const duplicate = await transaction
          .selectFrom('competitions')
          .select('id')
          .where('region_policy_id', '=', input.regionPolicyId)
          .where('month_key', '=', input.monthKey)
          .executeTakeFirst();
        if (duplicate) {
          throw new ConflictException({
            code: 'COMPETITION_REGION_MONTH_EXISTS',
            message: 'A competition already exists for this region and month.',
          });
        }

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
            rules: validated.rules as unknown as JsonObject,
            rules_version: input.rulesVersion,
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
        await this.authorization.audit(transaction, {
          action: 'competition.created',
          actorUserId: admin.id,
          entityId: competition.id,
          entityType: 'competitions',
          nextState: this.competitionAuditState(input, 'draft', 1),
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
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const current = await transaction
          .selectFrom('competitions')
          .selectAll()
          .where('id', '=', competitionId)
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
        this.assertExpectedVersion(
          current.configuration_version,
          input.expectedVersion,
        );
        await this.lockRegionMonth(
          transaction,
          input.regionPolicyId,
          input.monthKey,
        );
        await this.assertRegionExists(transaction, input.regionPolicyId);
        const duplicate = await transaction
          .selectFrom('competitions')
          .select('id')
          .where('region_policy_id', '=', input.regionPolicyId)
          .where('month_key', '=', input.monthKey)
          .where('id', '!=', competitionId)
          .executeTakeFirst();
        if (duplicate) {
          throw new ConflictException({
            code: 'COMPETITION_REGION_MONTH_EXISTS',
            message: 'A competition already exists for this region and month.',
          });
        }

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
            rules: validated.rules as unknown as JsonObject,
            rules_version: input.rulesVersion,
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
        await this.authorization.audit(transaction, {
          action: 'competition.updated',
          actorUserId: admin.id,
          entityId: competitionId,
          entityType: 'competitions',
          nextState: this.competitionAuditState(
            input,
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

  private validateDraft(input: CreateCompetitionDraftDto) {
    const schedule = parseCompetitionSchedule(input);
    const rules = parseAdminCompetitionRules(input.rules);
    assertUniqueGoalBrackets(input.goalBrackets);
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

  private async assertRegionExists(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    regionPolicyId: string,
  ): Promise<void> {
    const region = await transaction
      .selectFrom('region_policies')
      .select('id')
      .where('id', '=', regionPolicyId)
      .executeTakeFirst();
    if (!region) {
      throw new NotFoundException({
        code: 'REGION_POLICY_NOT_FOUND',
        message: 'The region policy was not found.',
      });
    }
  }

  private async lockRegionMonth(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    regionPolicyId: string,
    monthKey: string,
  ): Promise<void> {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${regionPolicyId}:${monthKey}`}, 0))`.execute(
      transaction,
    );
  }

  private async assertPublishable(
    transaction: Parameters<AdminAuthorizationService['requireAdmin']>[1],
    competition: {
      ends_at: Date;
      id: string;
      region_policy_id: string;
      registration_closes_at: Date;
      registration_opens_at: Date;
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
    if (
      competition.registration_closes_at <= now ||
      competition.starts_at <= now
    ) {
      throw new ConflictException({
        code: 'COMPETITION_PUBLISH_WINDOW_CLOSED',
        message:
          'Registration close and competition start must be future times.',
      });
    }
    const [region, bracket, reward] = await Promise.all([
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
        .where((expression) =>
          expression.or([
            expression('available_from', 'is', null),
            expression('available_from', '<=', competition.ends_at),
          ]),
        )
        .where((expression) =>
          expression.or([
            expression('available_until', 'is', null),
            expression('available_until', '>', competition.ends_at),
          ]),
        )
        .executeTakeFirst(),
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
          'Publish at least one in-stock brand reward before publishing the competition.',
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

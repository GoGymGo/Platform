import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { canDeleteCreatorWorkout } from './admin-deletion-policy';
import { AdminAuthorizationService } from './admin-authorization.service';
import {
  type AdminDeletedEntityResponseDto,
  CreatorWorkoutStatusAction,
  type AdminEntityResponseDto,
  type CreateCreatorWorkoutDto,
  type CreatorWorkoutStatusActionDto,
  type DeleteVersionedAdminEntityDto,
  type UpdateCreatorWorkoutDto,
} from './dto/admin-configuration.dto';

interface AdminWorkoutJson extends JsonObject {
  id: string;
  status: 'draft' | 'published';
  version: number;
}

interface DeletedWorkoutJson extends JsonObject {
  id: string;
  status: 'deleted';
}

@Injectable()
export class AdminWorkoutConfigurationService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly idempotency: IdempotencyService,
  ) {}

  create(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateCreatorWorkoutDto,
  ): Promise<AdminEntityResponseDto> {
    this.assertSecureUrls(input);

    return this.idempotency.execute<AdminWorkoutJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: input as unknown as JsonObject,
        responseCode: 201,
        scope: 'admin-creator-workouts:create',
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        await this.assertReferences(transaction, input);
        const now = new Date();
        const workout = await transaction
          .insertInto('creator_workouts')
          .values({
            created_at: now,
            creator_name: input.creatorName.trim(),
            creator_user_id: input.creatorUserId ?? null,
            duration_minutes: input.durationMinutes,
            published: false,
            published_at: null,
            region_codes: input.regionCodes,
            sponsor_name: input.sponsorName?.trim() ?? null,
            thumbnail_url: input.thumbnailUrl ?? null,
            title: input.title.trim(),
            updated_at: now,
            video_url: input.videoUrl,
            workout_style: input.workoutStyle.trim(),
          })
          .returning(['id', 'published', 'version'])
          .executeTakeFirstOrThrow();
        await this.authorization.audit(transaction, {
          action: 'creator_workout.created',
          actorUserId: admin.id,
          entityId: workout.id,
          entityType: 'creator_workouts',
          nextState: this.auditState(input, workout.published, workout.version),
          previousState: null,
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return this.response(workout);
      },
    );
  }

  update(
    principal: AuthenticatedPrincipal,
    workoutId: string,
    idempotencyKey: string,
    input: UpdateCreatorWorkoutDto,
  ): Promise<AdminEntityResponseDto> {
    this.assertSecureUrls(input);

    return this.idempotency.execute<AdminWorkoutJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, workoutId },
        scope: `admin-creator-workouts:${workoutId}:update`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const current = await transaction
          .selectFrom('creator_workouts')
          .selectAll()
          .where('id', '=', workoutId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!current) {
          throw new NotFoundException({
            code: 'CREATOR_WORKOUT_NOT_FOUND',
            message: 'The creator workout was not found.',
          });
        }
        if (current.published) {
          throw new ConflictException({
            code: 'CREATOR_WORKOUT_CONFIGURATION_LOCKED',
            message: 'Unpublish the workout before editing it.',
          });
        }
        this.assertVersion(current.version, input.expectedVersion);
        await this.assertReferences(transaction, input);

        const workout = await transaction
          .updateTable('creator_workouts')
          .set({
            creator_name: input.creatorName.trim(),
            creator_user_id: input.creatorUserId ?? null,
            duration_minutes: input.durationMinutes,
            region_codes: input.regionCodes,
            sponsor_name: input.sponsorName?.trim() ?? null,
            thumbnail_url: input.thumbnailUrl ?? null,
            title: input.title.trim(),
            updated_at: new Date(),
            version: sql<number>`version + 1`,
            video_url: input.videoUrl,
            workout_style: input.workoutStyle.trim(),
          })
          .where('id', '=', workoutId)
          .where('version', '=', input.expectedVersion)
          .returning(['id', 'published', 'version'])
          .executeTakeFirst();
        if (!workout) {
          throw this.versionConflict();
        }
        await this.authorization.audit(transaction, {
          action: 'creator_workout.updated',
          actorUserId: admin.id,
          entityId: workoutId,
          entityType: 'creator_workouts',
          nextState: this.auditState(input, workout.published, workout.version),
          previousState: {
            published: current.published,
            title: current.title,
            version: current.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return this.response(workout);
      },
    );
  }

  changeStatus(
    principal: AuthenticatedPrincipal,
    workoutId: string,
    idempotencyKey: string,
    input: CreatorWorkoutStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.idempotency.execute<AdminWorkoutJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, workoutId },
        scope: `admin-creator-workouts:${workoutId}:status`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const current = await transaction
          .selectFrom('creator_workouts')
          .selectAll()
          .where('id', '=', workoutId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!current) {
          throw new NotFoundException({
            code: 'CREATOR_WORKOUT_NOT_FOUND',
            message: 'The creator workout was not found.',
          });
        }
        this.assertVersion(current.version, input.expectedVersion);
        const shouldPublish =
          input.action === CreatorWorkoutStatusAction.PUBLISH;
        if (current.published === shouldPublish) {
          throw new ConflictException({
            code: 'CREATOR_WORKOUT_STATUS_UNCHANGED',
            message: `The workout is already ${shouldPublish ? 'published' : 'unpublished'}.`,
          });
        }
        if (shouldPublish) {
          this.assertSecureUrls({
            thumbnailUrl: current.thumbnail_url ?? undefined,
            videoUrl: current.video_url,
          });
          await this.assertCurrentRegions(transaction, current.region_codes);
        }

        const now = new Date();
        const workout = await transaction
          .updateTable('creator_workouts')
          .set({
            published: shouldPublish,
            published_at: shouldPublish ? now : null,
            updated_at: now,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', workoutId)
          .where('version', '=', input.expectedVersion)
          .returning(['id', 'published', 'version'])
          .executeTakeFirst();
        if (!workout) {
          throw this.versionConflict();
        }
        await this.authorization.audit(transaction, {
          action: shouldPublish
            ? 'creator_workout.published'
            : 'creator_workout.unpublished',
          actorUserId: admin.id,
          entityId: workoutId,
          entityType: 'creator_workouts',
          nextState: {
            published: workout.published,
            version: workout.version,
          },
          previousState: {
            published: current.published,
            version: current.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return this.response(workout);
      },
    );
  }

  delete(
    principal: AuthenticatedPrincipal,
    workoutId: string,
    idempotencyKey: string,
    input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.idempotency.execute<DeletedWorkoutJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: { ...input, workoutId },
        scope: `admin-creator-workouts:${workoutId}:delete`,
      },
      async (transaction) => {
        const admin = await this.authorization.requireAdmin(
          principal,
          transaction,
        );
        const workout = await transaction
          .selectFrom('creator_workouts')
          .selectAll()
          .where('id', '=', workoutId)
          .where('deleted_at', 'is', null)
          .forUpdate()
          .executeTakeFirst();
        if (!workout) {
          throw new NotFoundException({
            code: 'CREATOR_WORKOUT_NOT_FOUND',
            message: 'The creator workout was not found.',
          });
        }
        this.assertVersion(workout.version, input.expectedVersion);
        if (!canDeleteCreatorWorkout(workout.published)) {
          throw new ConflictException({
            code: 'CREATOR_WORKOUT_DELETE_REQUIRES_UNPUBLISHED',
            message: 'Unpublish the workout before deleting it.',
          });
        }

        const deletedAt = new Date();
        const deleted = await transaction
          .updateTable('creator_workouts')
          .set({
            deleted_at: deletedAt,
            updated_at: deletedAt,
            version: sql<number>`version + 1`,
          })
          .where('id', '=', workoutId)
          .where('version', '=', input.expectedVersion)
          .where('deleted_at', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (!deleted) throw this.versionConflict();
        await this.authorization.audit(transaction, {
          action: 'creator_workout.deleted',
          actorUserId: admin.id,
          entityId: workoutId,
          entityType: 'creator_workouts',
          nextState: {
            deletedAt: deletedAt.toISOString(),
            status: 'deleted',
          },
          previousState: {
            published: workout.published,
            title: workout.title,
            version: workout.version,
          },
          reason: input.reason,
          requestId: idempotencyKey,
        });
        return { id: deleted.id, status: 'deleted' };
      },
    );
  }

  private async assertReferences(
    transaction: Transaction<Database>,
    input: Pick<CreateCreatorWorkoutDto, 'creatorUserId' | 'regionCodes'>,
  ): Promise<void> {
    if (input.creatorUserId) {
      const creator = await transaction
        .selectFrom('users')
        .select('id')
        .where('id', '=', input.creatorUserId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!creator) {
        throw new NotFoundException({
          code: 'CREATOR_USER_NOT_FOUND',
          message: 'The active creator user was not found.',
        });
      }
    }
    await this.assertKnownRegions(transaction, input.regionCodes);
  }

  private async assertKnownRegions(
    transaction: Transaction<Database>,
    regionCodes: string[],
  ): Promise<void> {
    const regions = await transaction
      .selectFrom('region_policies')
      .select('code')
      .distinct()
      .where('code', 'in', regionCodes)
      .execute();
    if (
      new Set(regions.map((region) => region.code)).size !== regionCodes.length
    ) {
      throw new BadRequestException({
        code: 'CREATOR_WORKOUT_REGION_UNKNOWN',
        message: 'Every workout region code must reference a known region.',
      });
    }
  }

  private async assertCurrentRegions(
    transaction: Transaction<Database>,
    regionCodes: string[],
  ): Promise<void> {
    const now = new Date();
    const regions = await transaction
      .selectFrom('region_policies')
      .select('code')
      .distinct()
      .where('code', 'in', regionCodes)
      .where('competition_enabled', '=', true)
      .where('valid_from', '<=', now)
      .where((expression) =>
        expression.or([
          expression('valid_to', 'is', null),
          expression('valid_to', '>', now),
        ]),
      )
      .execute();
    if (
      new Set(regions.map((region) => region.code)).size !== regionCodes.length
    ) {
      throw new ConflictException({
        code: 'CREATOR_WORKOUT_REGION_INACTIVE',
        message: 'Every published workout region must currently be enabled.',
      });
    }
  }

  private assertSecureUrls(input: {
    thumbnailUrl?: string;
    videoUrl: string;
  }): void {
    for (const value of [input.videoUrl, input.thumbnailUrl]) {
      if (!value) continue;
      try {
        if (new URL(value).protocol !== 'https:') throw new Error();
      } catch {
        throw new BadRequestException({
          code: 'CREATOR_WORKOUT_URL_INSECURE',
          message: 'Workout media URLs must be absolute HTTPS URLs.',
        });
      }
    }
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw this.versionConflict();
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'CREATOR_WORKOUT_VERSION_CONFLICT',
      message: 'The creator workout changed; reload it before retrying.',
    });
  }

  private response(workout: {
    id: string;
    published: boolean;
    version: number;
  }): AdminWorkoutJson {
    return {
      id: workout.id,
      status: workout.published ? 'published' : 'draft',
      version: workout.version,
    };
  }

  private auditState(
    input: CreateCreatorWorkoutDto,
    published: boolean,
    version: number,
  ): JsonObject {
    return {
      creatorUserId: input.creatorUserId ?? null,
      published,
      regionCodes: input.regionCodes,
      title: input.title,
      version,
    };
  }
}

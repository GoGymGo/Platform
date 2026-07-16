import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { JsonObject } from '../../database/database.types';
import { normalizeDateKey } from '../../database/date-key';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ProfilesService } from '../profiles/profiles.service';
import {
  CREATOR_VIDEO_RIGHTS_VERSION,
  type CreateCreatorVideoSubmissionDto,
  type CreateCreatorWorkoutPlanDto,
  type CreatorVideoSubmissionResponseDto,
  type CreatorWorkoutPlanResponseDto,
  type CreatorWorkoutResponseDto,
} from './dto/creator-workout.dto';

interface CreatorVideoSubmissionJson extends JsonObject {
  createdAt: string;
  id: string;
  rightsAcceptedAt: string;
  rightsVersion: string;
  status: 'approved' | 'in_review' | 'rejected' | 'submitted' | 'withdrawn';
  title: string;
  videoUrl: string;
}

interface CreatorWorkoutPlanJson extends JsonObject {
  creatorName: string;
  durationMinutes: number;
  id: string;
  note: string | null;
  plannedDate: string;
  workoutId: string;
  workoutName: string;
  workoutStyle: string;
}

@Injectable()
export class CreatorWorkoutsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: IdempotencyService,
    private readonly profiles: ProfilesService,
  ) {}

  async listPublished(
    regionCode?: string,
  ): Promise<CreatorWorkoutResponseDto[]> {
    let query = this.database.connection
      .selectFrom('creator_workouts')
      .select([
        'creator_name',
        'duration_minutes',
        'id',
        'published',
        'published_at',
        'region_codes',
        'sponsor_name',
        'thumbnail_url',
        'title',
        'video_url',
        'workout_style',
      ])
      .where('published', '=', true)
      .where('published_at', 'is not', null)
      .where('published_at', '<=', new Date());
    if (regionCode) {
      query = query.where(sql<boolean>`${regionCode} = ANY(region_codes)`);
    }
    const workouts = await query.orderBy('published_at', 'desc').execute();

    return workouts.map((workout) => ({
      creatorName: workout.creator_name,
      durationMinutes: workout.duration_minutes,
      id: workout.id,
      joined: workout.published,
      name: workout.title,
      regionCodes: workout.region_codes,
      reward: `${workout.duration_minutes} MIN ${workout.workout_style} // ENTRIES COME FROM VERIFIED SESSIONS`,
      sponsorName: workout.sponsor_name,
      thumbnailUrl: workout.thumbnail_url,
      timing: 'FEATURED WORKOUT',
      videoUrl: workout.video_url,
      workoutStyle: workout.workout_style,
    }));
  }

  createSubmission(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    input: CreateCreatorVideoSubmissionDto,
  ): Promise<CreatorVideoSubmissionResponseDto> {
    return this.idempotency.execute<CreatorVideoSubmissionJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          durationMinutes: input.durationMinutes,
          notes: input.notes ?? null,
          regionCode: input.regionCode,
          rightsAccepted: input.rightsAccepted,
          sponsorDisclosure: input.sponsorDisclosure ?? null,
          syntheticMediaDisclosed: input.syntheticMediaDisclosed,
          thumbnailUrl: input.thumbnailUrl ?? null,
          title: input.title,
          videoUrl: input.videoUrl,
          workoutStyle: input.workoutStyle,
        },
        responseCode: 201,
        scope: 'creator-video-submissions:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const now = new Date();
        const submission = await transaction
          .insertInto('creator_video_submissions')
          .values({
            created_at: now,
            duration_minutes: input.durationMinutes,
            notes: input.notes?.trim() || null,
            region_code: input.regionCode.trim().toLowerCase(),
            rights_accepted_at: now,
            rights_version: CREATOR_VIDEO_RIGHTS_VERSION,
            sponsor_disclosure: input.sponsorDisclosure?.trim() || null,
            status: 'submitted',
            synthetic_media_disclosed: input.syntheticMediaDisclosed,
            thumbnail_url: input.thumbnailUrl?.trim() || null,
            title: input.title.trim(),
            updated_at: now,
            user_id: user.id,
            video_url: input.videoUrl.trim(),
            workout_style: input.workoutStyle.trim(),
          })
          .returning([
            'created_at',
            'id',
            'rights_accepted_at',
            'rights_version',
            'status',
            'title',
            'video_url',
          ])
          .executeTakeFirstOrThrow();
        return toSubmissionResponse(submission);
      },
    );
  }

  async listMySubmissions(
    principal: AuthenticatedPrincipal,
  ): Promise<CreatorVideoSubmissionResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const submissions = await transaction
          .selectFrom('creator_video_submissions')
          .select([
            'created_at',
            'id',
            'rights_accepted_at',
            'rights_version',
            'status',
            'title',
            'video_url',
          ])
          .where('user_id', '=', user.id)
          .orderBy('created_at', 'desc')
          .execute();
        return submissions.map(toSubmissionResponse);
      });
  }

  planWorkout(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    workoutId: string,
    input: CreateCreatorWorkoutPlanDto,
  ): Promise<CreatorWorkoutPlanResponseDto> {
    return this.idempotency.execute<CreatorWorkoutPlanJson>(
      {
        actorKey: `firebase:${principal.firebaseUid}`,
        key: idempotencyKey,
        request: {
          note: input.note ?? null,
          plannedDate: input.plannedDate,
          workoutId,
        },
        responseCode: 201,
        scope: 'creator-workout-plans:create',
      },
      async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const workout = await transaction
          .selectFrom('creator_workouts')
          .select([
            'creator_name',
            'duration_minutes',
            'id',
            'published',
            'title',
            'workout_style',
          ])
          .where('id', '=', workoutId)
          .where('published', '=', true)
          .executeTakeFirst();
        if (!workout) {
          throw new NotFoundException({
            code: 'CREATOR_WORKOUT_NOT_FOUND',
            message: 'That creator workout is not available.',
          });
        }
        const now = new Date();
        const plan = await transaction
          .insertInto('creator_workout_plans')
          .values({
            created_at: now,
            creator_workout_id: workoutId,
            note: input.note?.trim() || null,
            planned_date: input.plannedDate,
            updated_at: now,
            user_id: user.id,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['user_id', 'creator_workout_id', 'planned_date'])
              .doUpdateSet({
                note: input.note?.trim() || null,
                updated_at: now,
              }),
          )
          .returning(['id', 'note', 'planned_date'])
          .executeTakeFirstOrThrow();
        return {
          creatorName: workout.creator_name,
          durationMinutes: workout.duration_minutes,
          id: plan.id,
          note: plan.note,
          plannedDate: normalizeDateKey(plan.planned_date),
          workoutId: workout.id,
          workoutName: workout.title,
          workoutStyle: workout.workout_style,
        };
      },
    );
  }

  async listMyPlans(
    principal: AuthenticatedPrincipal,
  ): Promise<CreatorWorkoutPlanResponseDto[]> {
    return this.database.connection
      .transaction()
      .execute(async (transaction) => {
        const user = await this.profiles.ensureUser(principal, transaction);
        const plans = await transaction
          .selectFrom('creator_workout_plans as plan')
          .innerJoin(
            'creator_workouts as workout',
            'workout.id',
            'plan.creator_workout_id',
          )
          .select([
            'plan.id',
            'plan.note',
            'plan.planned_date',
            'workout.creator_name',
            'workout.duration_minutes',
            'workout.id as workout_id',
            'workout.title',
            'workout.workout_style',
          ])
          .where('plan.user_id', '=', user.id)
          .where('workout.published', '=', true)
          .orderBy('plan.planned_date')
          .execute();
        return plans.map((plan) => ({
          creatorName: plan.creator_name,
          durationMinutes: plan.duration_minutes,
          id: plan.id,
          note: plan.note,
          plannedDate: normalizeDateKey(plan.planned_date),
          workoutId: plan.workout_id,
          workoutName: plan.title,
          workoutStyle: plan.workout_style,
        }));
      });
  }
}

function toSubmissionResponse(submission: {
  created_at: Date;
  id: string;
  rights_accepted_at: Date;
  rights_version: string;
  status: 'approved' | 'in_review' | 'rejected' | 'submitted' | 'withdrawn';
  title: string;
  video_url: string;
}): CreatorVideoSubmissionJson {
  return {
    createdAt: submission.created_at.toISOString(),
    id: submission.id,
    rightsAcceptedAt: submission.rights_accepted_at.toISOString(),
    rightsVersion: submission.rights_version,
    status: submission.status,
    title: submission.title,
    videoUrl: submission.video_url,
  };
}

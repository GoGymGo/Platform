import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { CreatorWorkoutResponseDto } from './dto/creator-workout.dto';

@Injectable()
export class CreatorWorkoutsService {
  constructor(private readonly database: DatabaseService) {}

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
}

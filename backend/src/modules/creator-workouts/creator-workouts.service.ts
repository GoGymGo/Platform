import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { CreatorWorkoutResponseDto } from './dto/creator-workout.dto';

@Injectable()
export class CreatorWorkoutsService {
  constructor(private readonly database: DatabaseService) {}

  async listPublished(): Promise<CreatorWorkoutResponseDto[]> {
    const workouts = await this.database.connection
      .selectFrom('creator_workouts')
      .select([
        'duration_minutes',
        'id',
        'published',
        'published_at',
        'title',
        'workout_style',
      ])
      .where('published', '=', true)
      .where('published_at', 'is not', null)
      .where('published_at', '<=', new Date())
      .orderBy('published_at', 'desc')
      .execute();

    return workouts.map((workout) => ({
      id: workout.id,
      joined: workout.published,
      name: workout.title,
      reward: `${workout.duration_minutes} MIN ${workout.workout_style} // ENTRIES COME FROM VERIFIED SESSIONS`,
      timing: 'FEATURED WORKOUT',
    }));
  }
}

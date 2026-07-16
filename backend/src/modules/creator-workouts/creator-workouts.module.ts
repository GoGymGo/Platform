import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { CreatorWorkoutsController } from './creator-workouts.controller';
import { CreatorWorkoutsService } from './creator-workouts.service';

@Module({
  controllers: [CreatorWorkoutsController],
  imports: [IdempotencyModule, ProfilesModule],
  providers: [CreatorWorkoutsService],
})
export class CreatorWorkoutsModule {}

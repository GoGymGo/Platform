import { Module } from '@nestjs/common';
import { CreatorWorkoutsController } from './creator-workouts.controller';
import { CreatorWorkoutsService } from './creator-workouts.service';

@Module({
  controllers: [CreatorWorkoutsController],
  providers: [CreatorWorkoutsService],
})
export class CreatorWorkoutsModule {}

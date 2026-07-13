import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CreatorWorkoutsService } from './creator-workouts.service';
import { CreatorWorkoutResponseDto } from './dto/creator-workout.dto';

@ApiTags('creator workouts')
@Controller('creator-workouts')
export class CreatorWorkoutsController {
  constructor(private readonly workouts: CreatorWorkoutsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List the currently published creator workouts' })
  @ApiOkResponse({ isArray: true, type: CreatorWorkoutResponseDto })
  listPublished(): Promise<CreatorWorkoutResponseDto[]> {
    return this.workouts.listPublished();
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import { CreatorWorkoutsService } from './creator-workouts.service';
import {
  CreatorWorkoutResponseDto,
  CreatorVideoSubmissionResponseDto,
  CreatorWorkoutPlanResponseDto,
  CreateCreatorVideoSubmissionDto,
  CreateCreatorWorkoutPlanDto,
  ListCreatorWorkoutsQueryDto,
} from './dto/creator-workout.dto';

@ApiTags('creator workouts')
@Controller('creator-workouts')
export class CreatorWorkoutsController {
  constructor(private readonly workouts: CreatorWorkoutsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List the currently published creator workouts' })
  @ApiOkResponse({ isArray: true, type: CreatorWorkoutResponseDto })
  listPublished(
    @Query() query: ListCreatorWorkoutsQueryDto,
  ): Promise<CreatorWorkoutResponseDto[]> {
    return this.workouts.listPublished(query.region);
  }

  @Post('submissions')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Submit a creator workout video and its rights attestation',
  })
  @ApiCreatedResponse({ type: CreatorVideoSubmissionResponseDto })
  createSubmission(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateCreatorVideoSubmissionDto,
  ): Promise<CreatorVideoSubmissionResponseDto> {
    return this.workouts.createSubmission(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Get('submissions/me')
  @ApiBearerAuth('firebase')
  @ApiOperation({ summary: 'List my creator video submissions' })
  @ApiOkResponse({ isArray: true, type: CreatorVideoSubmissionResponseDto })
  listMySubmissions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CreatorVideoSubmissionResponseDto[]> {
    return this.workouts.listMySubmissions(principal);
  }

  @Post(':workoutId/plans')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Add a published creator workout to my calendar' })
  @ApiCreatedResponse({ type: CreatorWorkoutPlanResponseDto })
  planWorkout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateCreatorWorkoutPlanDto,
  ): Promise<CreatorWorkoutPlanResponseDto> {
    return this.workouts.planWorkout(
      principal,
      requireIdempotencyKey(idempotencyKey),
      workoutId,
      input,
    );
  }

  @Get('plans/me')
  @ApiBearerAuth('firebase')
  @ApiOperation({ summary: 'List my planned creator workouts' })
  @ApiOkResponse({ isArray: true, type: CreatorWorkoutPlanResponseDto })
  listMyPlans(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CreatorWorkoutPlanResponseDto[]> {
    return this.workouts.listMyPlans(principal);
  }
}

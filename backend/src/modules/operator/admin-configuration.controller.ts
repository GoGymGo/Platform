import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AdminCompetitionConfigurationService } from './admin-competition-configuration.service';
import { AdminRegionConfigurationService } from './admin-region-configuration.service';
import { AdminWorkoutConfigurationService } from './admin-workout-configuration.service';
import {
  AdminEntityResponseDto,
  AdminRegionPolicyResponseDto,
  CompetitionStatusActionDto,
  CreateCompetitionDraftDto,
  CreateCreatorWorkoutDto,
  CreateRegionPolicyDto,
  CreatorWorkoutStatusActionDto,
  UpdateCompetitionDraftDto,
  UpdateCreatorWorkoutDto,
} from './dto/admin-configuration.dto';

@ApiTags('operator-configuration')
@ApiBearerAuth('firebase')
@Controller('operator/configuration')
export class AdminConfigurationController {
  constructor(
    private readonly competitions: AdminCompetitionConfigurationService,
    private readonly regions: AdminRegionConfigurationService,
    private readonly workouts: AdminWorkoutConfigurationService,
  ) {}

  @Post('region-policies')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a versioned regional operating policy' })
  @ApiCreatedResponse({ type: AdminRegionPolicyResponseDto })
  createRegionPolicy(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateRegionPolicyDto,
  ): Promise<AdminRegionPolicyResponseDto> {
    return this.regions.create(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('competitions')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a competition draft' })
  @ApiCreatedResponse({ type: AdminEntityResponseDto })
  createCompetition(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.competitions.create(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Put('competitions/:competitionId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Replace a versioned competition draft' })
  @ApiOkResponse({ type: AdminEntityResponseDto })
  updateCompetition(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: UpdateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.competitions.update(
      principal,
      competitionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('competitions/:competitionId/status-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Publish or cancel a competition' })
  @ApiOkResponse({ type: AdminEntityResponseDto })
  changeCompetitionStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CompetitionStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.competitions.changeStatus(
      principal,
      competitionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('creator-workouts')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create an unpublished creator workout' })
  @ApiCreatedResponse({ type: AdminEntityResponseDto })
  createWorkout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateCreatorWorkoutDto,
  ): Promise<AdminEntityResponseDto> {
    return this.workouts.create(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Put('creator-workouts/:workoutId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Replace an unpublished creator workout' })
  @ApiOkResponse({ type: AdminEntityResponseDto })
  updateWorkout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: UpdateCreatorWorkoutDto,
  ): Promise<AdminEntityResponseDto> {
    return this.workouts.update(
      principal,
      workoutId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('creator-workouts/:workoutId/status-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Publish or unpublish a creator workout' })
  @ApiOkResponse({ type: AdminEntityResponseDto })
  changeWorkoutStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatorWorkoutStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.workouts.changeStatus(
      principal,
      workoutId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}

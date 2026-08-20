import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminRegionConfigurationService } from './admin-region-configuration.service';
import { AdminWorkoutConfigurationService } from './admin-workout-configuration.service';
import { AdminDashboardSnapshotDto } from './dto/admin-dashboard.dto';
import {
  AdminEntityResponseDto,
  AdminCompetitionPublicationPreflightDto,
  AdminDeletedEntityResponseDto,
  AdminRegionPolicyResponseDto,
  CompetitionStatusActionDto,
  CreateCompetitionDraftDto,
  CreateCreatorWorkoutDto,
  CreateRegionPolicyDto,
  CreatorWorkoutStatusActionDto,
  DeleteVersionedAdminEntityDto,
  RegionPolicyStatusActionDto,
  UpdateCompetitionDraftDto,
  UpdateCreatorWorkoutDto,
} from './dto/admin-configuration.dto';

@ApiTags('operator-configuration')
@ApiBearerAuth('firebase')
@Controller('operator/configuration')
export class AdminConfigurationController {
  constructor(
    private readonly competitions: AdminCompetitionConfigurationService,
    private readonly dashboard: AdminDashboardService,
    private readonly regions: AdminRegionConfigurationService,
    private readonly workouts: AdminWorkoutConfigurationService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Return the administrator configuration dashboard and recent audit history',
  })
  @ApiOkResponse({ type: AdminDashboardSnapshotDto })
  getDashboard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AdminDashboardSnapshotDto> {
    return this.dashboard.getSnapshot(principal);
  }

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

  @Post('region-policies/:regionPolicyId/status-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Enable or disable a regional operating policy' })
  @ApiOkResponse({ type: AdminEntityResponseDto })
  changeRegionPolicyStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('regionPolicyId', ParseUUIDPipe) regionPolicyId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RegionPolicyStatusActionDto,
  ): Promise<AdminEntityResponseDto> {
    return this.regions.changeStatus(
      principal,
      regionPolicyId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Delete('region-policies/:regionPolicyId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Delete a retired regional policy from the admin dashboard',
  })
  @ApiOkResponse({ type: AdminDeletedEntityResponseDto })
  deleteRegionPolicy(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('regionPolicyId', ParseUUIDPipe) regionPolicyId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.regions.delete(
      principal,
      regionPolicyId,
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

  @Get('competitions/:competitionId/publication-preflight')
  @ApiOperation({
    summary: 'Evaluate authoritative competition publication prerequisites',
  })
  @ApiOkResponse({ type: AdminCompetitionPublicationPreflightDto })
  getCompetitionPublicationPreflight(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
  ): Promise<AdminCompetitionPublicationPreflightDto> {
    return this.competitions.getPublicationPreflight(principal, competitionId);
  }

  @Delete('competitions/:competitionId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Delete a terminal competition from the admin dashboard',
  })
  @ApiOkResponse({ type: AdminDeletedEntityResponseDto })
  deleteCompetition(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.competitions.delete(
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

  @Delete('creator-workouts/:workoutId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Delete an unpublished workout from the admin dashboard',
  })
  @ApiOkResponse({ type: AdminDeletedEntityResponseDto })
  deleteWorkout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: DeleteVersionedAdminEntityDto,
  ): Promise<AdminDeletedEntityResponseDto> {
    return this.workouts.delete(
      principal,
      workoutId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}

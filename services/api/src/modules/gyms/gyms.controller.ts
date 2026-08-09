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
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { requireIdempotencyKey } from '../../common/idempotency/idempotency-key';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import {
  CashFulfillmentRecordDto,
  GymLocationResponseDto,
  GymQrCredentialResponseDto,
  GymScanResultDto,
  InterestSubmissionResponseDto,
  OperatorInterestSubmissionDto,
  OperatorAuditHistoryDto,
  OperatorGymSessionDto,
  RegionWaitlistEntryDto,
} from './dto/gym.dto';
import {
  AssignCompetitionGymDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  GymScanRequestDto,
  InterestSubmissionDto,
  OperatorReasonDto,
  RegionWaitlistRequestDto,
  UpdateGymLocationDto,
} from './dto/gym.dto';
import { GymsService } from './gyms.service';

@ApiTags('gym scans')
@ApiBearerAuth('firebase')
@Controller('gym-scans')
export class GymScansController {
  constructor(private readonly gyms: GymsService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Start, check, or complete a static-QR gym session',
  })
  @ApiOkResponse({ type: GymScanResultDto })
  scan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: GymScanRequestDto,
  ): Promise<GymScanResultDto> {
    return this.gyms.scan(
      principal,
      requireIdempotencyKey(idempotencyKey),
      request,
    );
  }
}

@ApiTags('pilot submissions')
@Controller()
export class PilotSubmissionsController {
  constructor(private readonly gyms: GymsService) {}

  @Post('region-waitlist')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Join the unsupported-region launch waitlist' })
  @ApiCreatedResponse({ type: RegionWaitlistEntryDto })
  submitWaitlist(
    @Body() input: RegionWaitlistRequestDto,
  ): Promise<RegionWaitlistEntryDto> {
    return this.gyms.submitWaitlist(input);
  }

  @Post('interest-submissions')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit landing-page member or brand interest' })
  @ApiCreatedResponse({ type: InterestSubmissionResponseDto })
  submitInterest(
    @Body() input: InterestSubmissionDto,
  ): Promise<InterestSubmissionResponseDto> {
    return this.gyms.submitInterest(input);
  }
}

@ApiTags('operator gyms and pilot')
@ApiBearerAuth('firebase')
@Controller('operator')
export class GymOperatorController {
  constructor(private readonly gyms: GymsService) {}

  @Get('gym-locations')
  @ApiOperation({ summary: 'List configured gym locations' })
  @ApiOkResponse({ isArray: true, type: GymLocationResponseDto })
  listGyms(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<GymLocationResponseDto[]> {
    return this.gyms.listGymLocations(principal);
  }

  @Post('gym-locations')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create an active gym geofence' })
  @ApiCreatedResponse({ type: GymLocationResponseDto })
  createGym(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateGymLocationDto,
  ): Promise<GymLocationResponseDto> {
    return this.gyms.createGymLocation(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Put('gym-locations/:gymId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Update or deactivate a gym geofence' })
  @ApiOkResponse({ type: GymLocationResponseDto })
  updateGym(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('gymId', ParseUUIDPipe) gymId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: UpdateGymLocationDto,
  ): Promise<GymLocationResponseDto> {
    return this.gyms.updateGymLocation(
      principal,
      gymId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Delete('gym-locations/:gymId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Delete an inactive gym from the admin dashboard' })
  @ApiOkResponse({ type: Object })
  deleteGym(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('gymId', ParseUUIDPipe) gymId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: OperatorReasonDto,
  ): Promise<{ id: string; status: 'deleted' }> {
    return this.gyms.deleteGymLocation(
      principal,
      gymId,
      requireIdempotencyKey(idempotencyKey),
      input.reason,
    );
  }

  @Post('competitions/:competitionId/gym-locations/:gymId/qr-credentials')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Issue a printable static QR poster' })
  @ApiCreatedResponse({ type: GymQrCredentialResponseDto })
  issueCredential(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Param('gymId', ParseUUIDPipe) gymId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: OperatorReasonDto,
  ): Promise<GymQrCredentialResponseDto> {
    return this.gyms.issueCredential(
      principal,
      competitionId,
      gymId,
      requireIdempotencyKey(idempotencyKey),
      input.reason,
    );
  }

  @Get('competitions/:competitionId/gym-locations/:gymId/qr-credentials/active')
  @ApiOperation({ summary: 'Recover the active printable static QR poster' })
  @ApiOkResponse({
    schema: {
      allOf: [{ $ref: getSchemaPath(GymQrCredentialResponseDto) }],
      nullable: true,
    },
  })
  getActiveCredential(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Param('gymId', ParseUUIDPipe) gymId: string,
  ): Promise<GymQrCredentialResponseDto | null> {
    return this.gyms.getActiveCredential(principal, competitionId, gymId);
  }

  @Post(
    'competitions/:competitionId/gym-locations/:gymId/qr-credentials/revoke',
  )
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Revoke a gym QR poster' })
  @ApiOkResponse({ type: Object })
  revokeCredential(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Param('gymId', ParseUUIDPipe) gymId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: OperatorReasonDto,
  ): Promise<{ id: string; status: 'revoked' }> {
    return this.gyms.revokeCredential(
      principal,
      competitionId,
      gymId,
      requireIdempotencyKey(idempotencyKey),
      input.reason,
    );
  }

  @Post('competitions/:competitionId/gym-locations/:gymId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Make a gym eligible for a competition' })
  @ApiOkResponse({ type: Object })
  assignCompetitionGym(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Param('gymId', ParseUUIDPipe) gymId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: AssignCompetitionGymDto,
  ): Promise<{ id: string; status: 'assigned' }> {
    return this.gyms.assignCompetitionGym(
      principal,
      competitionId,
      gymId,
      requireIdempotencyKey(idempotencyKey),
      input.reason,
    );
  }

  @Get('gym-sessions')
  @ApiOperation({ summary: 'List complete and incomplete QR visits' })
  @ApiOkResponse({ isArray: true, type: OperatorGymSessionDto })
  listGymSessions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorGymSessionDto[]> {
    return this.gyms.listGymSessions(principal);
  }

  @Get('region-waitlist')
  @ApiOperation({ summary: 'Review unsupported-region waitlist entries' })
  @ApiOkResponse({ isArray: true, type: RegionWaitlistEntryDto })
  listWaitlist(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RegionWaitlistEntryDto[]> {
    return this.gyms.listWaitlist(principal);
  }

  @Get('interest-submissions')
  @ApiOperation({ summary: 'Review landing-page interest submissions' })
  @ApiOkResponse({ isArray: true, type: OperatorInterestSubmissionDto })
  listInterest(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorInterestSubmissionDto[]> {
    return this.gyms.listInterest(principal);
  }

  @Post('cash-fulfillments')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Record an in-person cash reward handoff' })
  @ApiCreatedResponse({ type: CashFulfillmentRecordDto })
  recordCashFulfillment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CashFulfillmentRequestDto,
  ): Promise<CashFulfillmentRecordDto> {
    return this.gyms.recordCashFulfillment(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Get('audit-history')
  @ApiOperation({ summary: 'List recent immutable operator audit history' })
  @ApiOkResponse({ isArray: true, type: OperatorAuditHistoryDto })
  listAuditHistory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorAuditHistoryDto[]> {
    return this.gyms.listAuditHistory(principal);
  }
}

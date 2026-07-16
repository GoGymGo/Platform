import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CompetitionsService } from './competitions.service';
import {
  CompetitionMatchesQueryDto,
  CompetitionMatchResponseDto,
  CompetitionResponseDto,
  CreateEnrollmentDto,
  EnrollmentCountQueryDto,
  EnrollmentCountResponseDto,
  EnrollmentResponseDto,
  CreateWeeklyChallengeRequestDto,
  EligibleWeeklyChallengePartnerDto,
  WeeklyChallengePeriodQueryDto,
  WeeklyChallengeRequestDecisionDto,
  WeeklyChallengeRequestResponseDto,
} from './dto/competition.dto';

@ApiTags('competitions')
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitions: CompetitionsService) {}

  @Get('current')
  @ApiBearerAuth('firebase')
  @ApiOperation({
    summary: 'Return the authenticated user current regional competition',
  })
  @ApiOkResponse({ type: CompetitionResponseDto })
  getCurrent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CompetitionResponseDto | null> {
    return this.competitions.getCurrent(principal);
  }

  @Get('current/enrollment')
  @ApiBearerAuth('firebase')
  @ApiOperation({
    summary: 'Return the authenticated user current active enrollment',
  })
  @ApiOkResponse({ type: EnrollmentResponseDto })
  getCurrentEnrollment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<EnrollmentResponseDto | null> {
    return this.competitions.getCurrentEnrollment(principal);
  }

  @Post(':competitionId/enrollments')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Enroll the authenticated eligible user in a goal bracket',
  })
  @ApiCreatedResponse({ type: EnrollmentResponseDto })
  enroll(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() request: CreateEnrollmentDto,
  ): Promise<EnrollmentResponseDto> {
    return this.competitions.enroll(
      principal,
      competitionId,
      requireIdempotencyKey(idempotencyKey),
      request,
    );
  }

  @Get(':monthKey/enrollment-count')
  @Public()
  @ApiOperation({
    summary: 'Return the active enrollment count for a regional competition',
  })
  @ApiOkResponse({ type: EnrollmentCountResponseDto })
  async getEnrollmentCount(
    @Param('monthKey') monthKey: string,
    @Query() query: EnrollmentCountQueryDto,
  ): Promise<EnrollmentCountResponseDto> {
    return {
      count: await this.competitions.getEnrollmentCount(monthKey, query.region),
    };
  }

  @Get(':monthKey/matches')
  @ApiBearerAuth('firebase')
  @ApiOperation({
    summary: 'Return the authenticated entrant weekly competition matches',
  })
  @ApiOkResponse({ isArray: true, type: CompetitionMatchResponseDto })
  getMatches(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('monthKey') monthKey: string,
    @Query() query: CompetitionMatchesQueryDto,
  ): Promise<CompetitionMatchResponseDto[]> {
    return this.competitions.getMatches(
      principal,
      monthKey,
      query.goal,
      query.region,
    );
  }

  @Get(':monthKey/weekly-challenges/eligible-partners')
  @ApiBearerAuth('firebase')
  @ApiOperation({
    summary: 'List accepted friends eligible for the same weekly commitment',
  })
  @ApiOkResponse({ isArray: true, type: EligibleWeeklyChallengePartnerDto })
  listEligibleWeeklyChallengePartners(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('monthKey') monthKey: string,
    @Query() query: WeeklyChallengePeriodQueryDto,
  ): Promise<EligibleWeeklyChallengePartnerDto[]> {
    return this.competitions.listEligibleWeeklyChallengePartners(
      principal,
      monthKey,
      query,
    );
  }

  @Get(':monthKey/weekly-challenges/requests')
  @ApiBearerAuth('firebase')
  @ApiOperation({
    summary: 'List my incoming and outgoing Weekly Challenge requests',
  })
  @ApiOkResponse({ isArray: true, type: WeeklyChallengeRequestResponseDto })
  listWeeklyChallengeRequests(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('monthKey') monthKey: string,
    @Query() query: WeeklyChallengePeriodQueryDto,
  ): Promise<WeeklyChallengeRequestResponseDto[]> {
    return this.competitions.listWeeklyChallengeRequests(
      principal,
      monthKey,
      query,
    );
  }

  @Post(':monthKey/weekly-challenges/requests')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Request a known eligible friend as a Weekly Challenge partner',
  })
  @ApiCreatedResponse({ type: WeeklyChallengeRequestResponseDto })
  createWeeklyChallengeRequest(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('monthKey') monthKey: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateWeeklyChallengeRequestDto,
  ): Promise<WeeklyChallengeRequestResponseDto> {
    return this.competitions.createWeeklyChallengeRequest(
      principal,
      monthKey,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Patch('weekly-challenges/requests/:requestId')
  @ApiBearerAuth('firebase')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Accept or decline an incoming Weekly Challenge request',
  })
  @ApiOkResponse({ type: WeeklyChallengeRequestResponseDto })
  respondToWeeklyChallengeRequest(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: WeeklyChallengeRequestDecisionDto,
  ): Promise<WeeklyChallengeRequestResponseDto> {
    return this.competitions.respondToWeeklyChallengeRequest(
      principal,
      requestId,
      requireIdempotencyKey(idempotencyKey),
      input.decision,
    );
  }
}

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
import { CompetitionsService } from './competitions.service';
import {
  CompetitionMatchesQueryDto,
  CompetitionMatchResponseDto,
  CompetitionResponseDto,
  CreateEnrollmentDto,
  EnrollmentCountQueryDto,
  EnrollmentCountResponseDto,
  EnrollmentResponseDto,
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
}

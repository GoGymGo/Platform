import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AdminCompetitionConfigurationService } from './admin-competition-configuration.service';
import {
  AdminEntityResponseDto,
  CreateCompetitionDraftDto,
  UpdateCompetitionDraftDto,
} from './dto/admin-configuration.dto';
import {
  ListPartnerPortalPageQueryDto,
  OperatorPortalAccessDto,
  PartnerCompetitionPageDto,
  PartnerDashboardSnapshotDto,
  PartnerProposalActionResponseDto,
  PartnerProposalStatusActionDto,
  PartnerVisitPageDto,
} from './dto/operator-portal.dto';
import { OperatorPortalService } from './operator-portal.service';

@ApiTags('operator portal')
@ApiBearerAuth('firebase')
@Controller('operator')
export class OperatorPortalController {
  constructor(
    private readonly portal: OperatorPortalService,
    private readonly competitions: AdminCompetitionConfigurationService,
  ) {}

  @Get('access')
  @ApiOperation({ summary: 'Resolve the server-authoritative operator portal' })
  @ApiOkResponse({ type: OperatorPortalAccessDto })
  getAccess(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OperatorPortalAccessDto> {
    return this.portal.getAccess(principal);
  }

  @Get('partner-dashboard')
  @ApiOperation({ summary: 'Return a gym-scoped partner workspace snapshot' })
  @ApiOkResponse({ type: PartnerDashboardSnapshotDto })
  getPartnerDashboard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PartnerDashboardSnapshotDto> {
    return this.portal.getPartnerDashboard(principal);
  }

  @Get('partner-competitions')
  @ApiOperation({ summary: 'List scoped Partner-gym Contests and proposals' })
  @ApiOkResponse({ type: PartnerCompetitionPageDto })
  listPartnerCompetitions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListPartnerPortalPageQueryDto,
  ): Promise<PartnerCompetitionPageDto> {
    return this.portal.listPartnerCompetitions(principal, query);
  }

  @Get('partner-visits')
  @ApiOperation({ summary: 'List privacy-safe aggregate Partner-gym visits' })
  @ApiOkResponse({ type: PartnerVisitPageDto })
  listPartnerVisits(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListPartnerPortalPageQueryDto,
  ): Promise<PartnerVisitPageDto> {
    return this.portal.listPartnerVisits(principal, query);
  }

  @Post('partner-proposals')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create one assigned-gym Contest proposal draft' })
  @ApiCreatedResponse({ type: AdminEntityResponseDto })
  createPartnerProposal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.competitions.createProposal(
      principal,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Put('partner-proposals/:competitionId')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Update an editable assigned-gym proposal' })
  @ApiOkResponse({ type: AdminEntityResponseDto })
  updatePartnerProposal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: UpdateCompetitionDraftDto,
  ): Promise<AdminEntityResponseDto> {
    return this.competitions.updateProposal(
      principal,
      competitionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post('partner-proposals/:competitionId/status-action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Submit, withdraw, or archive a gym proposal' })
  @ApiOkResponse({ type: PartnerProposalActionResponseDto })
  changePartnerProposalStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: PartnerProposalStatusActionDto,
  ): Promise<PartnerProposalActionResponseDto> {
    return this.competitions.changeProposalStatus(
      principal,
      competitionId,
      requireIdempotencyKey(idempotencyKey),
      input,
    );
  }
}

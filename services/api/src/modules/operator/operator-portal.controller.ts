import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import {
  OperatorPortalAccessDto,
  PartnerDashboardSnapshotDto,
} from './dto/operator-portal.dto';
import { OperatorPortalService } from './operator-portal.service';

@ApiTags('operator portal')
@ApiBearerAuth('firebase')
@Controller('operator')
export class OperatorPortalController {
  constructor(private readonly portal: OperatorPortalService) {}

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
}

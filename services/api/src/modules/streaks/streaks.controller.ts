import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { StreakSummaryResponseDto } from './dto/streak.dto';
import { StreaksService } from './streaks.service';

@ApiTags('streaks')
@ApiBearerAuth('firebase')
@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaks: StreaksService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Return active streak rewards from verified gym logs',
  })
  @ApiOkResponse({ type: StreakSummaryResponseDto })
  getMyStreaks(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<StreakSummaryResponseDto> {
    return this.streaks.getMyStreaks(principal);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import {
  CategoryLeaderboardDto,
  CompetitionProgressResponseDto,
  LeaderboardQueryDto,
} from './dto/leaderboard.dto';
import { LeaderboardsService } from './leaderboards.service';

@ApiTags('leaderboards')
@ApiBearerAuth('firebase')
@Controller()
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get('leaderboards/current')
  @ApiOperation({
    summary: 'Return the current authenticated regional category leaderboard',
  })
  @ApiOkResponse({ type: CategoryLeaderboardDto })
  getCurrentLeaderboard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: LeaderboardQueryDto,
  ): Promise<CategoryLeaderboardDto | null> {
    return this.leaderboards.getCurrentLeaderboard(principal, query.goal);
  }

  @Get('me/progress')
  @ApiOperation({
    summary:
      'Return authoritative current competition progress from the ledger',
  })
  @ApiOkResponse({ type: CompetitionProgressResponseDto })
  getMyProgress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CompetitionProgressResponseDto | null> {
    return this.leaderboards.getMyProgress(principal);
  }
}

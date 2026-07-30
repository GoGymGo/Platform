import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
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
@ApiExtraModels(CategoryLeaderboardDto, CompetitionProgressResponseDto)
@Controller()
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get('leaderboards/current')
  @ApiOperation({
    summary: 'Return the current authenticated regional category leaderboard',
  })
  @ApiOkResponse({
    schema: {
      allOf: [{ $ref: getSchemaPath(CategoryLeaderboardDto) }],
      nullable: true,
    },
  })
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
  @ApiOkResponse({
    schema: {
      allOf: [{ $ref: getSchemaPath(CompetitionProgressResponseDto) }],
      nullable: true,
    },
  })
  getMyProgress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CompetitionProgressResponseDto | null> {
    return this.leaderboards.getMyProgress(principal);
  }
}

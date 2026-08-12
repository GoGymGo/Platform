import { Controller, Get } from '@nestjs/common';
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
import { Public } from '../auth/public.decorator';
import {
  ParticipantCompetitionResultsResponseDto,
  RewardWinnerResponseDto,
  SettledCompetitionResponseDto,
} from './dto/result.dto';
import { ResultsService } from './results.service';

@ApiTags('competition results')
@ApiExtraModels(
  ParticipantCompetitionResultsResponseDto,
  SettledCompetitionResponseDto,
)
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('reward-winners')
  @Public()
  @ApiOperation({ summary: 'Return the latest public reward winners' })
  @ApiOkResponse({ isArray: true, type: RewardWinnerResponseDto })
  getRewardWinners(): Promise<RewardWinnerResponseDto[]> {
    return this.results.getRewardWinners();
  }

  @Get('settled-competition')
  @Public()
  @ApiOperation({ summary: 'Return the latest settled reward contest summary' })
  @ApiOkResponse({
    schema: {
      allOf: [{ $ref: getSchemaPath(SettledCompetitionResponseDto) }],
      nullable: true,
    },
  })
  getSettledCompetition(): Promise<SettledCompetitionResponseDto | null> {
    return this.results.getSettledCompetition();
  }

  @Get('mine/latest')
  @ApiBearerAuth('firebase')
  @ApiOperation({
    summary:
      'Return the latest ended competition and results for the authenticated participant',
  })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(ParticipantCompetitionResultsResponseDto) },
      ],
      nullable: true,
    },
  })
  getLatestParticipantResults(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ParticipantCompetitionResultsResponseDto | null> {
    return this.results.getLatestParticipantResults(principal);
  }
}

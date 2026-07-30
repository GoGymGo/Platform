import { Controller, Get } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import {
  RewardWinnerResponseDto,
  SettledCompetitionResponseDto,
} from './dto/result.dto';
import { ResultsService } from './results.service';

@ApiTags('competition results')
@Public()
@ApiExtraModels(SettledCompetitionResponseDto)
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('reward-winners')
  @ApiOperation({ summary: 'Return the latest public reward winners' })
  @ApiOkResponse({ isArray: true, type: RewardWinnerResponseDto })
  getRewardWinners(): Promise<RewardWinnerResponseDto[]> {
    return this.results.getRewardWinners();
  }

  @Get('settled-competition')
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
}

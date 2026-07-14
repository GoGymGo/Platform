import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import {
  PayoutWinnerResponseDto,
  SettledCompetitionResponseDto,
} from './dto/result.dto';
import { ResultsService } from './results.service';

@ApiTags('competition results')
@Public()
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('payout-winners')
  @ApiOperation({ summary: 'Return the public top payout results' })
  @ApiOkResponse({ isArray: true, type: PayoutWinnerResponseDto })
  getPayoutWinners(): Promise<PayoutWinnerResponseDto[]> {
    return this.results.getPayoutWinners();
  }

  @Get('settled-competition')
  @ApiOperation({ summary: 'Return the latest settled payout rules summary' })
  @ApiOkResponse({ type: SettledCompetitionResponseDto })
  getSettledCompetition(): Promise<SettledCompetitionResponseDto | null> {
    return this.results.getSettledCompetition();
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { StreakCountsDto } from '../../streaks/dto/streak.dto';

export class RewardWinnerResponseDto {
  @ApiProperty({ type: String })
  alias!: string;

  @ApiProperty({ type: Number })
  awardRank!: number;

  @ApiProperty({ type: String })
  sponsorName!: string;

  @ApiProperty({ type: String })
  rewardTitle!: string;

  @ApiProperty({ enum: ['coupon', 'physical'], type: String })
  rewardType!: 'coupon' | 'physical';

  @ApiProperty({ type: StreakCountsDto })
  streaks!: StreakCountsDto;
}

export class SettledCompetitionResponseDto {
  @ApiProperty({ type: String })
  competitionName!: string;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ minimum: 0, type: Number })
  rewardCount!: number;
}

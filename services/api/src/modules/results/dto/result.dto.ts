import { ApiProperty } from '@nestjs/swagger';
import { CategoryLeaderboardDto } from '../../leaderboards/dto/leaderboard.dto';
import { StreakCountsDto } from '../../streaks/dto/streak.dto';

export class RewardWinnerResponseDto {
  @ApiProperty({ type: String })
  alias!: string;

  @ApiProperty({ type: Number })
  awardRank!: number;

  @ApiProperty({ minimum: 1, nullable: true, type: Number })
  cashAmountCents!: number | null;

  @ApiProperty({ maxLength: 3, minLength: 3, nullable: true, type: String })
  cashCurrency!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  prizeDrawEntries!: number;

  @ApiProperty({ type: String })
  sponsorName!: string;

  @ApiProperty({ type: String })
  rewardTitle!: string;

  @ApiProperty({ enum: ['cash', 'coupon', 'physical'], type: String })
  rewardType!: 'cash' | 'coupon' | 'physical';

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

export class ParticipantCompetitionResultsResponseDto {
  @ApiProperty({ isArray: true, type: CategoryLeaderboardDto })
  categoryLeaderboards!: CategoryLeaderboardDto[];

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: String })
  competitionName!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endedAt!: string;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ type: String })
  regionName!: string;

  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  participantGoalDays!: number;

  @ApiProperty({ isArray: true, type: RewardWinnerResponseDto })
  rewardWinners!: RewardWinnerResponseDto[];

  @ApiProperty({ minimum: 0, type: Number })
  rewardCount!: number;

  @ApiProperty({ enum: ['pending', 'settled'], type: String })
  resultsStatus!: 'pending' | 'settled';

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  settledAt!: string | null;
}

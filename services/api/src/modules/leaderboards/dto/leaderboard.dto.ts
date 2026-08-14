import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { WorkoutSessionStatus } from '../../../database/database.types';

import { StreakCountsDto } from '../../streaks/dto/streak.dto';

export class LeaderboardQueryDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Max(7)
  @Min(1)
  goal!: number;
}

export class CategoryLeaderboardRowDto {
  @ApiProperty({ type: String })
  alias!: string;

  @ApiProperty({ type: Number })
  categoryEntries!: number;

  @ApiProperty({ type: Number })
  rank!: number;

  @ApiProperty({ type: StreakCountsDto })
  streaks!: StreakCountsDto;

  @ApiProperty({ type: Number })
  verifiedDays!: number;

  @ApiProperty({ type: Boolean })
  isCurrentUser!: boolean;
}

export class CategoryLeaderboardDto {
  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  goal!: number;

  @ApiProperty({ type: String })
  rulesVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  serverTime!: string;

  @ApiProperty({ enum: ['final', 'provisional'], type: String })
  scoringStatus!: 'final' | 'provisional';

  @ApiProperty({ maximum: 4, minimum: 0, type: Number })
  settledPeriodCount!: number;

  @ApiProperty({ isArray: true, type: CategoryLeaderboardRowDto })
  rows!: CategoryLeaderboardRowDto[];
}

export class CompetitionProgressResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: Number })
  goalDays!: number;

  @ApiProperty({ type: Number })
  verifiedDays!: number;

  @ApiProperty({ type: Number })
  categoryScore!: number;

  @ApiProperty({ type: Number })
  prizeDrawEntries!: number;

  @ApiProperty({
    description: 'Entries settled into the append-only ledger result so far',
    type: Number,
  })
  bankedPrizeDrawEntries!: number;

  @ApiProperty({
    description:
      'Current server projection including verified days in an unsettled scoring period',
    type: Number,
  })
  projectedPrizeDrawEntries!: number;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ type: String })
  enrolledDateKey!: string;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  serverTime!: string;

  @ApiProperty({ type: String })
  referenceDateKey!: string;

  @ApiProperty({ type: String })
  rulesVersion!: string;

  @ApiProperty({
    enum: ['active', 'registration', 'settled', 'settling'],
    type: String,
  })
  competitionStatus!: 'active' | 'registration' | 'settled' | 'settling';

  @ApiProperty({ enum: ['final', 'provisional'], type: String })
  scoringStatus!: 'final' | 'provisional';

  @ApiProperty({ maximum: 4, minimum: 0, type: Number })
  settledPeriodCount!: number;

  @ApiProperty({ isArray: true, type: String })
  verifiedDateKeys!: string[];

  @ApiProperty({ isArray: true, type: () => CompetitionSessionSummaryDto })
  sessions!: CompetitionSessionSummaryDto[];
}

export class CompetitionSessionSummaryDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  eligibleDate!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  completedAt!: string | null;

  @ApiProperty({
    enum: ['active', 'cancelled', 'pending_review', 'rejected', 'verified'],
  })
  status!: WorkoutSessionStatus;
}

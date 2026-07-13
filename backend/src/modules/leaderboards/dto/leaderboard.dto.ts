import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ type: Number })
  verifiedDays!: number;
}

export class CategoryLeaderboardDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  goal!: number;

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

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class StreakCountsDto {
  @ApiProperty({ example: 3, minimum: 0, type: Number })
  daily!: number;

  @ApiProperty({ example: 4, minimum: 0, type: Number })
  weekly!: number;

  @ApiProperty({ example: 2, minimum: 0, type: Number })
  monthly!: number;

  @ApiProperty({ enum: ['streaks-v1'], example: 'streaks-v1' })
  projectionVersion!: 'streaks-v1';

  @ApiProperty({ example: 1, minimum: 0, type: Number })
  yearly!: number;
}

export class StreakSummaryResponseDto {
  @ApiProperty({ example: '2026-07-15', format: 'date', type: String })
  asOfDate!: string;

  @ApiProperty({ example: 'America/Vancouver', type: String })
  timezone!: string;

  @ApiProperty({ type: StreakCountsDto })
  streaks!: StreakCountsDto;
}

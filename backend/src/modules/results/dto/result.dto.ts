import { ApiProperty } from '@nestjs/swagger';

export class PayoutWinnerResponseDto {
  @ApiProperty({ type: String })
  alias!: string;

  @ApiProperty({ type: Number })
  amountMinor!: number;

  @ApiProperty({ type: Number })
  payoutRank!: number;
}

export class SettledCompetitionResponseDto {
  @ApiProperty({ type: Number })
  payoutExponent!: number;

  @ApiProperty({ type: Number })
  payoutPoolAmountMinor!: number;

  @ApiProperty({ type: Number })
  payoutWinnerCount!: number;
}

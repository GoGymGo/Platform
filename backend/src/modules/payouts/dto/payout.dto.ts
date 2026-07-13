import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import type { PayoutClaimStatus } from '../../../database/database.types';

export type PublicPayoutClaimStatus =
  'action-required' | 'paid' | 'ready' | 'verification-pending';

export class PayoutClaimResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: Number })
  amountMinor!: number;

  @ApiProperty({ type: String })
  competitionLabel!: string;

  @ApiProperty({ enum: ['CAD', 'MXN', 'USD'], type: String })
  currency!: 'CAD' | 'MXN' | 'USD';

  @ApiProperty({ enum: ['hyperwallet'], type: String })
  provider!: 'hyperwallet';

  @ApiProperty({
    enum: ['action-required', 'verification-pending', 'ready', 'paid'],
    type: String,
  })
  status!: PublicPayoutClaimStatus;
}

export class PortalActionResponseDto {
  @ApiProperty({ format: 'uri', type: String })
  portalUrl!: string;
}

export class OperatorPayoutActionDto {
  @ApiProperty({ maxLength: 500, minLength: 8, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class OperatorPayoutClaimResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({
    enum: [
      'pending_review',
      'action_required',
      'verification_pending',
      'ready',
      'processing',
      'paid',
      'failed',
      'cancelled',
    ],
    type: String,
  })
  status!: PayoutClaimStatus;

  @ApiProperty({ type: Number })
  version!: number;
}

export function toSafeAmountMinor(amount: bigint | number | string): number {
  const numericAmount = Number(amount);
  if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
    throw new Error(
      'Payout amount is outside the supported safe-integer range.',
    );
  }
  return numericAmount;
}

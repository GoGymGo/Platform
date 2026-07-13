import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Length, Min } from 'class-validator';
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
  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ maxLength: 500, minLength: 8, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class OperatorPayoutParticipantReviewDto {
  @ApiProperty({ enum: ['active', 'deleted', 'suspended'] })
  accountStatus!: 'active' | 'deleted' | 'suspended';

  @ApiProperty({ type: Boolean })
  eligible!: boolean;

  @ApiProperty({ type: Boolean })
  emailPresent!: boolean;

  @ApiProperty({ type: Boolean })
  emailVerified!: boolean;
}

export class OperatorPayoutAccountReviewDto {
  @ApiProperty({ type: Boolean })
  provisioned!: boolean;

  @ApiProperty({ type: Boolean })
  ready!: boolean;

  @ApiProperty({ nullable: true, type: String })
  payeeStatus!: string | null;
}

export class OperatorPayoutPaymentReviewDto {
  @ApiProperty({ nullable: true, type: String })
  status!: string | null;
}

export class PayoutReleaseControlResponseDto {
  @ApiProperty({ type: Boolean })
  paused!: boolean;

  @ApiProperty({ type: String })
  reason!: string;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export enum PayoutReleaseControlAction {
  PAUSE = 'pause',
  RESUME = 'resume',
}

export class PayoutReleaseControlActionDto extends OperatorPayoutActionDto {
  @ApiProperty({ enum: PayoutReleaseControlAction, type: String })
  @IsEnum(PayoutReleaseControlAction)
  action!: 'pause' | 'resume';
}

export class OperatorPayoutClaimReviewDto {
  @ApiProperty({ type: Number })
  amountMinor!: number;

  @ApiProperty({ nullable: true, type: String })
  approvedAt!: string | null;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: String })
  competitionName!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ enum: ['CAD', 'MXN', 'USD'], type: String })
  currency!: 'CAD' | 'MXN' | 'USD';

  @ApiProperty({ format: 'uuid', type: String })
  drawId!: string;

  @ApiProperty({ nullable: true, type: String })
  failureCode!: string | null;

  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: OperatorPayoutParticipantReviewDto })
  participant!: OperatorPayoutParticipantReviewDto;

  @ApiProperty({ nullable: true, type: String })
  paidAt!: string | null;

  @ApiProperty({ type: OperatorPayoutAccountReviewDto })
  payoutAccount!: OperatorPayoutAccountReviewDto;

  @ApiProperty({ minimum: 1, type: Number })
  payoutRank!: number;

  @ApiProperty({ type: OperatorPayoutPaymentReviewDto })
  payment!: OperatorPayoutPaymentReviewDto;

  @ApiProperty({ type: PayoutReleaseControlResponseDto })
  releaseControl!: PayoutReleaseControlResponseDto;

  @ApiProperty({ enum: ['hyperwallet'], type: String })
  provider!: 'hyperwallet';

  @ApiProperty({ type: String })
  status!: PayoutClaimStatus;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;

  @ApiProperty({ format: 'uuid', type: String })
  winnerId!: string;
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

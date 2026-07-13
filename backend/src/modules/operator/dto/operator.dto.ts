import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class OperatorReasonDto {
  @ApiProperty({ maxLength: 500, minLength: 8, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class VerifySessionDto extends OperatorReasonDto {
  @ApiProperty({ type: Object })
  @IsObject()
  trustedEvidenceSummary!: Record<string, unknown>;
}

export class LockDrawDto extends OperatorReasonDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  competitionId!: string;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  @Matches(/^[a-f0-9]{64}$/i)
  seedCommitment!: string;
}

export class SettleDrawDto extends OperatorReasonDto {
  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  @Matches(/^[a-f0-9]{64}$/i)
  seedReveal!: string;
}

export enum RegionDecisionDto {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class DecideRegionVerificationDto extends OperatorReasonDto {
  @ApiProperty({ enum: RegionDecisionDto, type: String })
  @IsEnum(RegionDecisionDto)
  decision!: 'approved' | 'rejected';

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export enum PartnerDecisionDto {
  APPROVED = 'approved',
  IN_REVIEW = 'in_review',
  REJECTED = 'rejected',
}

export class DecidePartnerApplicationDto extends OperatorReasonDto {
  @ApiProperty({ enum: PartnerDecisionDto, type: String })
  @IsEnum(PartnerDecisionDto)
  decision!: 'approved' | 'in_review' | 'rejected';
}

export enum PrivacyDecisionDto {
  PROCESSING = 'processing',
  REJECTED = 'rejected',
}

export class DecidePrivacyRequestDto extends OperatorReasonDto {
  @ApiProperty({ enum: PrivacyDecisionDto, type: String })
  @IsEnum(PrivacyDecisionDto)
  decision!: 'processing' | 'rejected';
}

export class OperatorActionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  status!: string;
}

export class OperatorWorkQueueItemDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({
    enum: [
      'partner_application',
      'payout_claim',
      'privacy_request',
      'region_verification',
      'workout_session',
    ],
    type: String,
  })
  kind!:
    | 'partner_application'
    | 'payout_claim'
    | 'privacy_request'
    | 'region_verification'
    | 'workout_session';

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

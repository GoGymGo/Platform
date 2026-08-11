import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GymScanRequestDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  eventId!: string;

  @ApiProperty({
    description:
      'Gym credential saved during enrollment and reused automatically; it is not proof of a fresh QR capture.',
    minLength: 32,
    maxLength: 256,
    type: String,
  })
  @IsString()
  @Length(32, 256)
  credential!: string;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ maximum: 100_000, minimum: 0.1, type: Number })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(100_000)
  accuracyMeters!: number;
}

export class GymScanResultDto {
  @ApiProperty({ enum: ['started', 'too_early', 'verified', 'rejected'] })
  outcome!: 'rejected' | 'started' | 'too_early' | 'verified';

  @ApiProperty({ format: 'date-time', type: String })
  serverTimestamp!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  sessionId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  gymLocationId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  gymName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  credentialVersion!: number | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  startedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  minimumCompleteAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  expiresAt!: string | null;

  @ApiProperty({ minimum: 0, type: Number })
  remainingSeconds!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  rejectionReason!: string | null;
}

export class CreateGymLocationDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  regionPolicyId!: string;

  @ApiProperty({ maxLength: 160, minLength: 2, type: String })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ default: 75, maximum: 500, minimum: 10, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(500)
  radiusMeters!: number;

  @ApiProperty({ minLength: 8, maxLength: 500, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class UpdateGymLocationDto extends CreateGymLocationDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  active!: boolean;
}

export class GymLocationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  regionPolicyId!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  address!: string;

  @ApiProperty({ type: Number })
  latitude!: number;

  @ApiProperty({ type: Number })
  longitude!: number;

  @ApiProperty({ type: Number })
  radiusMeters!: number;

  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ nullable: true, type: Number })
  activeCredentialVersion!: number | null;

  @ApiProperty({ isArray: true, type: () => ActiveGymQrCredentialDto })
  activeQrCredentials!: ActiveGymQrCredentialDto[];

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;
}

export class ActiveGymQrCredentialDto {
  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: Number })
  credentialVersion!: number;
}

export class GymQrCredentialResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: String })
  competitionName!: string;

  @ApiProperty({ type: Number })
  credentialVersion!: number;

  @ApiProperty({ type: String })
  qrPayload!: string;

  @ApiProperty({ type: String })
  printablePosterSvg!: string;

  @ApiProperty({ format: 'date-time', type: String })
  issuedAt!: string;
}

export class OperatorReasonDto {
  @ApiProperty({ minLength: 8, maxLength: 500, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class AssignCompetitionGymDto extends OperatorReasonDto {}

export class RegionWaitlistRequestDto {
  @ApiProperty({ format: 'email', maxLength: 320, type: String })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ maxLength: 160, minLength: 2, type: String })
  @IsString()
  @Length(2, 160)
  requestedRegion!: string;

  @ApiPropertyOptional({ maxLength: 2, minLength: 2, type: String })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ maxLength: 8, minLength: 2, type: String })
  @IsOptional()
  @IsString()
  @Length(2, 8)
  subdivisionCode?: string;
}

export class RegionWaitlistEntryDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'email', type: String })
  email!: string;

  @ApiProperty({ type: String })
  requestedRegion!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ type: String })
  source!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class InterestSubmissionDto {
  @ApiProperty({ enum: ['gym_goer', 'brand'], type: String })
  @IsIn(['gym_goer', 'brand'])
  audience!: 'brand' | 'gym_goer';

  @ApiProperty({ format: 'email', maxLength: 320, type: String })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ maxLength: 100, minLength: 2, type: String })
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @ApiProperty({ maxLength: 160, minLength: 2, type: String })
  @IsString()
  @Length(2, 160)
  region!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  consent!: boolean;

  @ApiPropertyOptional({ maxLength: 140, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  companyName?: string;

  @ApiPropertyOptional({ maxLength: 300, type: String })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(300)
  website?: string;

  @ApiPropertyOptional({ maximum: 7, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  goalDays?: number;

  @ApiPropertyOptional({ maxLength: 60, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  workoutStyle?: string;

  @ApiPropertyOptional({ maxLength: 80, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  partnershipInterest?: string;

  @ApiPropertyOptional({ maxLength: 80, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  discoverySource?: string;

  @ApiPropertyOptional({ maxLength: 1200, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  message?: string;
}

export class InterestSubmissionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['gym_goer', 'brand'] })
  audience!: 'brand' | 'gym_goer';

  @ApiProperty({ format: 'date-time', type: String })
  submittedAt!: string;
}

export class OperatorInterestSubmissionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['gym_goer', 'brand'] })
  audience!: 'brand' | 'gym_goer';

  @ApiProperty({ format: 'email', type: String })
  email!: string;

  @ApiProperty({ type: String })
  fullName!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  companyName!: string | null;

  @ApiProperty({ type: String })
  region!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  goalDays!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  workoutStyle!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  partnershipInterest!: string | null;

  @ApiProperty({ format: 'date-time', type: String })
  submittedAt!: string;
}

export class CashFulfillmentRequestDto extends OperatorReasonDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  rewardAwardId!: string;

  @ApiProperty({ example: 10000, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty({ example: 'CAD', maxLength: 3, minLength: 3, type: String })
  @IsString()
  @Length(3, 3)
  currency!: string;
}

export class CashFulfillmentRecordDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  rewardAwardId!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ format: 'uuid', type: String })
  winnerUserId!: string;

  @ApiProperty({ type: Number })
  amountCents!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ format: 'date-time', type: String })
  fulfilledAt!: string;

  @ApiProperty({ type: String })
  fulfillmentNote!: string;
}

export class OperatorGymSessionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  gymLocationId!: string;

  @ApiProperty({ type: String })
  gymName!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  completedAt!: string | null;

  @ApiProperty({ type: Boolean })
  incomplete!: boolean;
}

export class OperatorAuditHistoryDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ type: String })
  entityType!: string;

  @ApiProperty({ format: 'uuid', type: String })
  entityId!: string;

  @ApiProperty({ type: String })
  reason!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

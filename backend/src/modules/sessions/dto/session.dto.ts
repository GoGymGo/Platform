import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  SessionEventType,
  WorkoutSessionStatus,
} from '../../../database/database.types';

export class CreateSessionDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  clientStartedAt?: string;
}

export enum SessionEventTypeDto {
  DEVICE_ATTESTATION = 'device_attestation',
  FACE_CHECK = 'face_check',
  GYM_QR_SCAN = 'gym_qr_scan',
  HEART_RATE_SAMPLE = 'heart_rate_sample',
}

export class AppendSessionEventDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ enum: SessionEventTypeDto, type: String })
  @IsEnum(SessionEventTypeDto)
  eventType!: SessionEventType;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ maximum: 240, minimum: 30, type: Number })
  @IsOptional()
  @IsInt()
  @Max(240)
  @Min(30)
  heartRateBpm?: number;

  @ApiPropertyOptional({ maximum: 1, minimum: 0, type: Number })
  @IsOptional()
  @IsNumber()
  @Max(1)
  @Min(0)
  faceMatchConfidence?: number;

  @ApiPropertyOptional({ maxLength: 2048, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  qrPayload?: string;

  @ApiPropertyOptional({ maxLength: 4096, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  deviceEvidenceToken?: string;
}

export class CompleteSessionDto {
  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  clientCompletedAt?: string;
}

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: String })
  eligibleDate!: string;

  @ApiProperty({
    enum: ['active', 'pending_review', 'verified', 'rejected', 'cancelled'],
  })
  status!: WorkoutSessionStatus;

  @ApiProperty({ type: String })
  policyVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  completedAt!: string | null;
}

export class SessionEventResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  eventId!: string;

  @ApiProperty({ enum: SessionEventTypeDto })
  eventType!: SessionEventType;

  @ApiProperty({ format: 'date-time', type: String })
  receivedAt!: string;
}

export class SessionCompletionResponseDto extends SessionResponseDto {
  @ApiProperty({ type: Boolean })
  eligibleForReview!: boolean;

  @ApiProperty({ isArray: true, type: String })
  violations!: string[];
}

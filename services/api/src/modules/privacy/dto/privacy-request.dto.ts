import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  PrivacyRequestStatus,
  PrivacyRequestType,
} from '../../../database/database.types';

export enum PrivacyRequestTypeDto {
  DELETE = 'delete',
  EXPORT = 'export',
}

export enum PrivacyRequestConfirmationDto {
  DELETE_MY_ACCOUNT = 'DELETE_MY_ACCOUNT',
  EXPORT_MY_DATA = 'EXPORT_MY_DATA',
}

export class CreatePrivacyRequestDto {
  @ApiProperty({ enum: PrivacyRequestTypeDto, type: String })
  @IsEnum(PrivacyRequestTypeDto)
  requestType!: PrivacyRequestType;

  @ApiProperty({ enum: PrivacyRequestConfirmationDto, type: String })
  @IsEnum(PrivacyRequestConfirmationDto)
  confirmation!: PrivacyRequestConfirmationDto;

  @ApiPropertyOptional({ maxLength: 1000, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class PrivacyRequestResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: PrivacyRequestTypeDto, type: String })
  requestType!: PrivacyRequestType;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  confirmedAt!: string | null;

  @ApiProperty({
    enum: ['completed', 'processing', 'rejected', 'requested'],
    type: String,
  })
  status!: PrivacyRequestStatus;

  @ApiProperty({ format: 'date-time', type: String })
  requestedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  completedAt!: string | null;

  @ApiProperty({ type: Boolean })
  downloadAvailable!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  exportExpiresAt!: string | null;

  @ApiProperty({ nullable: true, type: String })
  failureCode!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  nextAttemptAt!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class PrivacyRequestEventDto {
  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({
    enum: ['completed', 'processing', 'rejected', 'requested'],
    nullable: true,
    type: String,
  })
  previousStatus!: PrivacyRequestStatus | null;

  @ApiProperty({
    enum: ['completed', 'processing', 'rejected', 'requested'],
    type: String,
  })
  nextStatus!: PrivacyRequestStatus;
}

export class PrivacyRequestDetailResponseDto extends PrivacyRequestResponseDto {
  @ApiProperty({ isArray: true, type: PrivacyRequestEventDto })
  events!: PrivacyRequestEventDto[];
}

export class PrivacyCapabilitiesResponseDto {
  @ApiProperty({ type: Boolean })
  requestCreationAvailable!: boolean;

  @ApiProperty({ enum: ['disabled', 'enabled'], type: String })
  status!: 'disabled' | 'enabled';
}

export class PrivacyDownloadActionDto {
  @ApiProperty({ format: 'uri', type: String })
  url!: string;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;
}

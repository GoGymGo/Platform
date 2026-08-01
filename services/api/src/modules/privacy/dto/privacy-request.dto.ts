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

export class CreatePrivacyRequestDto {
  @ApiProperty({ enum: PrivacyRequestTypeDto, type: String })
  @IsEnum(PrivacyRequestTypeDto)
  requestType!: PrivacyRequestType;

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
}

export class PrivacyDownloadActionDto {
  @ApiProperty({ format: 'uri', type: String })
  url!: string;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;
}

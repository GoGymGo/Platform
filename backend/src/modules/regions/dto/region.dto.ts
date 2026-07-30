import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  Matches,
  IsUUID,
} from 'class-validator';
import type {
  RegionVerificationMethod,
  RegionVerificationStatus,
} from '../../../database/database.types';

export class RegionPolicyResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'CA-BC-VICTORIA', type: String })
  code!: string;

  @ApiProperty({ example: 'CA', type: String })
  countryCode!: string;

  @ApiProperty({ example: 'BC', type: String })
  subdivisionCode!: string;

  @ApiProperty({ example: 'Victoria', type: String })
  metroName!: string;

  @ApiProperty({ example: 'CAD', type: String })
  currency!: string;

  @ApiProperty({ example: 'America/Vancouver', type: String })
  timezone!: string;

  @ApiProperty({ isArray: true, type: String })
  languageCodes!: string[];

  @ApiProperty({ example: 19, type: Number })
  minimumAge!: number;

  @ApiProperty({ type: Boolean })
  competitionEnabled!: boolean;

  @ApiProperty({ type: String })
  policyVersion!: string;

  @ApiProperty({ type: String })
  boundaryVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  validFrom!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  validTo!: string | null;
}

export enum RegionVerificationMethodDto {
  DEVICE_LOCATION = 'device_location',
}

export class CreateRegionVerificationDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  regionPolicyId!: string;

  @ApiProperty({ enum: RegionVerificationMethodDto, type: String })
  @IsEnum(RegionVerificationMethodDto)
  method!: 'device_location';

  @ApiProperty({ maximum: 90, minimum: -90, type: Number })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ maximum: 180, minimum: -180, type: Number })
  @IsLongitude()
  longitude!: number;
}

export class CurrentRegionVerificationQueryDto {
  @ApiProperty({ example: 'CA-BC', type: String })
  @Matches(/^[A-Z]{2}-[A-Z0-9-]{1,32}$/)
  regionCode!: string;
}

export class RegionVerificationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  regionPolicyId!: string;

  @ApiProperty({
    enum: ['device_location', 'postal_code', 'manual_review'],
    type: String,
  })
  method!: RegionVerificationMethod;

  @ApiProperty({
    enum: ['pending', 'approved', 'rejected', 'expired'],
    type: String,
  })
  status!: RegionVerificationStatus;

  @ApiProperty({ type: String })
  policyVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class CurrentRegionVerificationResponseDto extends RegionVerificationResponseDto {
  @ApiProperty({ example: 'CA-BC', type: String })
  regionCode!: string;

  @ApiProperty({ example: 'British Columbia', type: String })
  regionName!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  reviewedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  expiresAt!: string | null;
}

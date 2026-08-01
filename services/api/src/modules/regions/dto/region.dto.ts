import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Matches,
} from 'class-validator';
import type {
  RegionVerificationMethod,
  RegionVerificationStatus,
} from '../../../database/database.types';
import { regionCodePattern } from '../region-code';

export class RegionPolicyResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ example: 'victoria-bc', type: String })
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
  @ApiPropertyOptional({
    description:
      'When omitted, returns the latest active verification across all regions.',
    example: 'victoria-bc',
    type: String,
  })
  @IsOptional()
  @Matches(regionCodePattern)
  regionCode?: string;
}

export class RegionVerificationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  regionPolicyId!: string;

  @ApiProperty({
    enum: [RegionVerificationMethodDto.DEVICE_LOCATION],
    type: String,
  })
  method!: Extract<RegionVerificationMethod, 'device_location'>;

  @ApiProperty({
    enum: ['approved'],
    type: String,
  })
  status!: Extract<RegionVerificationStatus, 'approved'>;

  @ApiProperty({ type: String })
  policyVersion!: string;

  @ApiProperty({ example: 'vancouver-bc', type: String })
  regionCode!: string;

  @ApiProperty({ example: 'Vancouver', type: String })
  regionName!: string;

  @ApiProperty({ example: 'CA-BC', type: String })
  jurisdictionCode!: string;

  @ApiProperty({ example: 'America/Vancouver', type: String })
  timezone!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  reviewedAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;
}

export class CurrentRegionVerificationResponseDto extends RegionVerificationResponseDto {}

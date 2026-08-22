import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import type {
  PartnerApplicationStatus,
  PartnerApplicationType,
} from '../../../database/database.types';

function trimText({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim().toLowerCase() : input;
}

abstract class RegionInputDto {
  @ApiProperty({ maxLength: 120, type: String })
  @Transform(trimText)
  @IsString()
  @Length(2, 120)
  region!: string;
}

export class CreatorApplicationDto extends RegionInputDto {
  @ApiProperty({ format: 'uri', maxLength: 2048, type: String })
  @Transform(trimText)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  channelUrl!: string;

  @ApiProperty({ format: 'uri', maxLength: 2048, type: String })
  @Transform(trimText)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  sampleWorkoutUrl!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @Transform(trimText)
  @IsString()
  @Length(2, 120)
  workoutStyle!: string;
}

export class SponsorApplicationDto {
  @ApiProperty({ maxLength: 160, type: String })
  @Transform(trimText)
  @IsString()
  @Length(2, 160)
  companyName!: string;

  @ApiProperty({ format: 'email', maxLength: 320, type: String })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  contactEmail!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @Transform(trimText)
  @IsString()
  @Length(2, 120)
  targetRegion!: string;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  consent!: true;

  @ApiPropertyOptional({ maxLength: 200, type: String })
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactFax?: string;
}

export class GymApplicationDto extends RegionInputDto {
  @ApiProperty({ maxLength: 500, type: String })
  @Transform(trimText)
  @IsString()
  @Length(5, 500)
  gymAddress!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @Transform(trimText)
  @IsString()
  @Length(2, 160)
  gymName!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @Transform(trimText)
  @IsString()
  @Length(2, 160)
  managerName!: string;

  @ApiProperty({ format: 'email', maxLength: 320, type: String })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  workEmail!: string;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  consent!: true;

  @ApiPropertyOptional({ maxLength: 200, type: String })
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactFax?: string;
}

export class PartnerApplicationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['creator', 'gym', 'sponsor'], type: String })
  applicationType!: PartnerApplicationType;

  @ApiProperty({
    enum: ['approved', 'in_review', 'rejected', 'submitted'],
    type: String,
  })
  status!: PartnerApplicationStatus;

  @ApiProperty({ enum: ['created', 'duplicate', 'screened'], type: String })
  @IsIn(['created', 'duplicate', 'screened'])
  outcome!: 'created' | 'duplicate' | 'screened';

  @ApiProperty({ format: 'date-time', type: String })
  submittedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  retentionExpiresAt!: string | null;
}

export class OperatorPartnerApplicationDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['creator', 'gym', 'sponsor'], type: String })
  applicationType!: PartnerApplicationType;

  @ApiProperty({
    enum: ['approved', 'in_review', 'rejected', 'submitted'],
    type: String,
  })
  status!: PartnerApplicationStatus;

  @ApiProperty({ format: 'date-time', type: String })
  submittedAt!: string;

  @ApiProperty({ format: 'email', nullable: true, type: String })
  contactEmail!: string | null;

  @ApiProperty({ type: String })
  region!: string;

  @ApiProperty({ minimum: 1, type: Number })
  reviewVersion!: number;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  retentionExpiresAt!: string | null;
}

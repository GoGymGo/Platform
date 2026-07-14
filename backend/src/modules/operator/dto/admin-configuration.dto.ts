import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CompetitionMode } from '../../../database/database.types';
import { OperatorReasonDto } from './operator.dto';

export class CreateRegionPolicyDto extends OperatorReasonDto {
  @ApiProperty({ example: 'victoria-bc', maxLength: 64, type: String })
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;

  @ApiProperty({ example: 'CA', type: String })
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @ApiProperty({ example: 'BC', type: String })
  @Matches(/^[A-Z0-9-]{1,8}$/)
  subdivisionCode!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  metroName!: string;

  @ApiProperty({ enum: ['CAD', 'MXN', 'USD'], type: String })
  @Matches(/^(CAD|MXN|USD)$/)
  currency!: string;

  @ApiProperty({ example: 'America/Vancouver', maxLength: 64, type: String })
  @IsString()
  @Length(1, 64)
  timezone!: string;

  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/, { each: true })
  languageCodes!: string[];

  @ApiProperty({ maximum: 99, minimum: 13, type: Number })
  @IsInt()
  @Min(13)
  @Max(99)
  minimumAge!: number;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  competitionEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  payoutEnabled!: boolean;

  @ApiProperty({ maxLength: 64, type: String })
  @IsString()
  @Length(1, 64)
  boundaryVersion!: string;

  @ApiProperty({ maxLength: 64, type: String })
  @IsString()
  @Length(1, 64)
  policyVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  validFrom!: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  boundary!: Record<string, unknown>;
}

export class GoalBracketDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  @Max(7)
  goalDays!: number;

  @ApiProperty({ maxLength: 80, type: String })
  @IsString()
  @Length(1, 80)
  label!: string;
}

export class CreateCompetitionDraftDto extends OperatorReasonDto {
  @ApiPropertyOptional({
    default: 'cash',
    enum: ['cash', 'non_cash_demo'],
    type: String,
  })
  @IsOptional()
  @IsIn(['cash', 'non_cash_demo'])
  mode?: CompetitionMode;

  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  regionPolicyId!: string;

  @ApiProperty({ example: '2026-08', type: String })
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  monthKey!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiProperty({ enum: ['CAD', 'MXN', 'USD'], type: String })
  @Matches(/^(CAD|MXN|USD)$/)
  currency!: string;

  @ApiProperty({ maxLength: 64, type: String })
  @IsString()
  @Length(1, 64)
  rulesVersion!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  rules!: Record<string, unknown>;

  @ApiProperty({ minimum: 100, type: Number })
  @IsInt()
  @Min(100)
  minimumEntrants!: number;

  @ApiPropertyOptional({ minimum: 100, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(100)
  entrantCap?: number | null;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  registrationOpensAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  registrationClosesAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ isArray: true, type: GoalBracketDto })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => GoalBracketDto)
  goalBrackets!: GoalBracketDto[];
}

export class UpdateCompetitionDraftDto extends CreateCompetitionDraftDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export enum CompetitionStatusAction {
  CANCEL = 'cancel',
  PUBLISH = 'publish',
}

export class CompetitionStatusActionDto extends OperatorReasonDto {
  @ApiProperty({ enum: CompetitionStatusAction, type: String })
  @IsEnum(CompetitionStatusAction)
  action!: CompetitionStatusAction;

  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateCreatorWorkoutDto extends OperatorReasonDto {
  @ApiPropertyOptional({ format: 'uuid', type: String })
  @IsOptional()
  @IsUUID()
  creatorUserId?: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(2, 160)
  title!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  creatorName!: string;

  @ApiProperty({ format: 'uri', type: String })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  videoUrl!: string;

  @ApiPropertyOptional({ format: 'uri', type: String })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  thumbnailUrl?: string;

  @ApiProperty({ maximum: 240, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  @Max(240)
  durationMinutes!: number;

  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  workoutStyle!: string;

  @ApiPropertyOptional({ maxLength: 120, type: String })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  sponsorName?: string;

  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { each: true })
  regionCodes!: string[];
}

export class UpdateCreatorWorkoutDto extends CreateCreatorWorkoutDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export enum CreatorWorkoutStatusAction {
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
}

export class CreatorWorkoutStatusActionDto extends OperatorReasonDto {
  @ApiProperty({ enum: CreatorWorkoutStatusAction, type: String })
  @IsEnum(CreatorWorkoutStatusAction)
  action!: CreatorWorkoutStatusAction;

  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AdminEntityResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class AdminRegionPolicyResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  policyVersion!: string;
}

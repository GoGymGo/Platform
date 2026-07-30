import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const CREATOR_VIDEO_RIGHTS_VERSION = 'creator-video-rights-v1';

export class ListCreatorWorkoutsQueryDto {
  @ApiPropertyOptional({ example: 'victoria-bc', type: String })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  region?: string;
}

export class CreatorWorkoutResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: Boolean })
  joined!: boolean;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  reward!: string;

  @ApiProperty({ type: String })
  timing!: string;

  @ApiProperty({ type: String })
  creatorName!: string;

  @ApiProperty({ maximum: 240, minimum: 1, type: Number })
  durationMinutes!: number;

  @ApiProperty({ isArray: true, type: String })
  regionCodes!: string[];

  @ApiProperty({ nullable: true, type: String })
  sponsorName!: string | null;

  @ApiProperty({ format: 'uri', nullable: true, type: String })
  thumbnailUrl!: string | null;

  @ApiProperty({ format: 'uri', type: String })
  videoUrl!: string;

  @ApiProperty({ type: String })
  workoutStyle!: string;
}

export class CreateCreatorVideoSubmissionDto {
  @ApiProperty({ maxLength: 100, type: String })
  @IsString()
  @Length(2, 100)
  title!: string;

  @ApiProperty({ format: 'uri', type: String })
  @IsUrl({ require_protocol: true })
  videoUrl!: string;

  @ApiPropertyOptional({ format: 'uri', type: String })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  thumbnailUrl?: string;

  @ApiProperty({ maximum: 180, minimum: 5, type: Number })
  @IsInt()
  @Max(180)
  @Min(5)
  durationMinutes!: number;

  @ApiProperty({ maxLength: 80, type: String })
  @IsString()
  @Length(2, 80)
  workoutStyle!: string;

  @ApiProperty({ example: 'victoria-bc', maxLength: 64, type: String })
  @IsString()
  @Length(2, 64)
  regionCode!: string;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  sponsorDisclosure?: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  syntheticMediaDisclosed!: boolean;

  @ApiPropertyOptional({ maxLength: 1000, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  @IsBoolean()
  rightsAccepted!: true;
}

export class CreatorVideoSubmissionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ format: 'uri', type: String })
  videoUrl!: string;

  @ApiProperty({
    enum: ['approved', 'in_review', 'rejected', 'submitted', 'withdrawn'],
    type: String,
  })
  status!: 'approved' | 'in_review' | 'rejected' | 'submitted' | 'withdrawn';

  @ApiProperty({ type: String })
  rightsVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  rightsAcceptedAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class CreateCreatorWorkoutPlanDto {
  @ApiProperty({ format: 'date', type: String })
  @IsDateString({ strict: true })
  plannedDate!: string;

  @ApiPropertyOptional({ maxLength: 240, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  note?: string;
}

export class CreatorWorkoutPlanResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  workoutId!: string;

  @ApiProperty({ type: String })
  workoutName!: string;

  @ApiProperty({ type: String })
  creatorName!: string;

  @ApiProperty({ format: 'date', type: String })
  plannedDate!: string;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;

  @ApiProperty({ maximum: 180, minimum: 5, type: Number })
  durationMinutes!: number;

  @ApiProperty({ type: String })
  workoutStyle!: string;
}

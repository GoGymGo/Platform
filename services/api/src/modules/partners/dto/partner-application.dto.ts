import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import type {
  JsonValue,
  PartnerApplicationStatus,
  PartnerApplicationType,
} from '../../../database/database.types';

abstract class RegionInputDto {
  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  region!: string;
}

export class CreatorApplicationDto extends RegionInputDto {
  @ApiProperty({ format: 'uri', maxLength: 2048, type: String })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  channelUrl!: string;

  @ApiProperty({ format: 'uri', maxLength: 2048, type: String })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  sampleWorkoutUrl!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  workoutStyle!: string;
}

export class SponsorApplicationDto {
  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(2, 160)
  companyName!: string;

  @ApiProperty({ format: 'email', maxLength: 320, type: String })
  @IsEmail()
  @MaxLength(320)
  contactEmail!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  targetRegion!: string;
}

export class GymApplicationDto extends RegionInputDto {
  @ApiProperty({ maxLength: 500, type: String })
  @IsString()
  @Length(5, 500)
  gymAddress!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(2, 160)
  gymName!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(2, 160)
  managerName!: string;

  @ApiProperty({ format: 'email', maxLength: 320, type: String })
  @IsEmail()
  @MaxLength(320)
  workEmail!: string;
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

  @ApiProperty({ format: 'date-time', type: String })
  submittedAt!: string;
}

export class OperatorPartnerApplicationDto extends PartnerApplicationResponseDto {
  @ApiPropertyOptional({ format: 'email', nullable: true, type: String })
  contactEmail!: string | null;

  @ApiProperty({ type: Object })
  payload!: JsonValue;

  @ApiProperty({ type: String })
  region!: string;
}

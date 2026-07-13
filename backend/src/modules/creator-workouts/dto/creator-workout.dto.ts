import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

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

  @ApiPropertyOptional({ nullable: true, type: String })
  sponsorName!: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true, type: String })
  thumbnailUrl!: string | null;

  @ApiProperty({ format: 'uri', type: String })
  videoUrl!: string;

  @ApiProperty({ type: String })
  workoutStyle!: string;
}

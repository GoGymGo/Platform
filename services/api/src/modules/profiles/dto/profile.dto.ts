import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  AccountStatus,
  PublicIdentityMode,
} from '../../../database/database.types';

export const publicIdentityModes = ['private', 'alias', 'real_name'] as const;

export class PrivacySettingsDto {
  @ApiProperty({ type: Boolean })
  showRegion!: boolean;

  @ApiProperty({ type: Boolean })
  showStats!: boolean;
}

export class MeResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  callsign!: string;

  @ApiProperty({ type: String })
  screenName!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ type: Boolean })
  emailVerified!: boolean;

  @ApiProperty({ enum: publicIdentityModes, type: String })
  publicIdentityMode!: PublicIdentityMode;

  @ApiProperty({ nullable: true, type: String })
  publicName!: string | null;

  @ApiProperty({ type: PrivacySettingsDto })
  privacySettings!: PrivacySettingsDto;

  @ApiProperty({ isArray: true, type: String })
  roles!: string[];

  @ApiProperty({ enum: ['active', 'suspended', 'deleted'], type: String })
  status!: AccountStatus;

  @ApiProperty({ type: Number })
  version!: number;
}

export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  showRegion?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  showStats?: boolean;
}

export class UpdateMeDto {
  @ApiPropertyOptional({
    description: 'Unique, case-insensitive alias used for friend search',
    example: 'GHOST_RUNNER',
    maxLength: 24,
    minLength: 3,
    pattern: '^[A-Za-z0-9_]+$',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 24)
  @Matches(/^[A-Za-z0-9_]+$/)
  screenName?: string;

  @ApiPropertyOptional({ enum: publicIdentityModes, type: String })
  @IsOptional()
  @IsIn(publicIdentityModes)
  publicIdentityMode?: PublicIdentityMode;

  @ApiPropertyOptional({
    maxLength: 80,
    minLength: 1,
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  publicName?: string | null;

  @ApiPropertyOptional({ type: UpdatePrivacySettingsDto })
  @IsOptional()
  @Type(() => UpdatePrivacySettingsDto)
  @ValidateNested()
  privacySettings?: UpdatePrivacySettingsDto;
}

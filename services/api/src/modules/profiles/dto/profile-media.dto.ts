import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import type { ProfileMediaStatus } from '../../../database/database.types';

export const avatarContentTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateAvatarUploadDto {
  @ApiProperty({ maximum: 5_242_880, minimum: 12, type: Number })
  @IsInt()
  @Min(12)
  @Max(5_242_880)
  contentLength!: number;

  @ApiProperty({ enum: avatarContentTypes, type: String })
  @IsIn(avatarContentTypes)
  contentType!: (typeof avatarContentTypes)[number];
}

export class AvatarUploadActionDto {
  @ApiProperty({ enum: ['PUT'], type: String })
  method!: 'PUT';

  @ApiProperty({ additionalProperties: { type: 'string' }, type: Object })
  headers!: Record<string, string>;

  @ApiProperty({ format: 'uri', type: String })
  url!: string;
}

export class CreateAvatarUploadResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  contentType!: string;

  @ApiProperty({ type: Number })
  contentLength!: number;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;

  @ApiProperty({ enum: ['pending_upload'], type: String })
  status!: 'pending_upload';

  @ApiProperty({ type: AvatarUploadActionDto })
  upload!: AvatarUploadActionDto;
}

export class AvatarCapabilitiesResponseDto {
  @ApiProperty({ type: Number })
  maxBytes!: number;

  @ApiProperty({ type: Number })
  maxDimension!: number;

  @ApiProperty({ type: Number })
  minDimension!: number;

  @ApiProperty({ enum: ['configured', 'disabled', 'unconfigured'] })
  status!: 'configured' | 'disabled' | 'unconfigured';

  @ApiProperty({ type: Boolean })
  uploadAvailable!: boolean;
}

export class AvatarUploadCompletionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['approved', 'pending_review'], type: String })
  status!: 'approved' | 'pending_review';
}

export class AvatarMediaDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  contentType!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ nullable: true, type: String })
  readUrl!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  readUrlExpiresAt!: string | null;

  @ApiProperty({ type: String })
  status!: ProfileMediaStatus;

  @ApiProperty({ nullable: true, type: Number })
  height!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  width!: number | null;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class AvatarStateResponseDto {
  @ApiProperty({ nullable: true, type: AvatarMediaDto })
  active!: AvatarMediaDto | null;

  @ApiProperty({ nullable: true, type: AvatarMediaDto })
  latest!: AvatarMediaDto | null;
}

export class RemoveAvatarResponseDto {
  @ApiProperty({ enum: ['removed'], type: String })
  status!: 'removed';
}

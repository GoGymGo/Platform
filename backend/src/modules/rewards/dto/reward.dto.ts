import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  RewardAwardStatus,
  RewardCatalogStatus,
  RewardType,
} from '../../../database/database.types';
import { OperatorReasonDto } from '../../operator/dto/operator.dto';

export class RewardCatalogQueryDto {
  @ApiProperty({ example: 'victoria-bc', type: String })
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  region!: string;

  @ApiPropertyOptional({ example: '2026-08', type: String })
  @IsOptional()
  @Matches(/^[0-9]{4}-(0[1-9]|1[0-2])$/)
  monthKey?: string;
}

export class RewardCatalogItemResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: String })
  competitionName!: string;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ type: String })
  regionName!: string;

  @ApiProperty({ type: String })
  sponsorName!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ enum: ['coupon', 'physical'], type: String })
  rewardType!: RewardType;

  @ApiPropertyOptional({ format: 'uri', nullable: true, type: String })
  imageUrl!: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true, type: String })
  termsUrl!: string | null;

  @ApiProperty({ minimum: 0, type: Number })
  inventoryRemaining!: number;

  @ApiProperty({ minimum: 1, type: Number })
  inventoryTotal!: number;
}

export class RewardAwardResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({
    enum: ['awarded', 'cancelled', 'claimed', 'fulfilled', 'redeemed'],
  })
  status!: RewardAwardStatus;

  @ApiProperty({ enum: ['coupon', 'physical'], type: String })
  rewardType!: RewardType;

  @ApiProperty({ type: String })
  sponsorName!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiPropertyOptional({ format: 'uri', nullable: true, type: String })
  imageUrl!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  awardRank!: number;

  @ApiProperty({ format: 'date-time', type: String })
  awardedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  claimedAt!: string | null;
}

export class ClaimRewardResponseDto extends RewardAwardResponseDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  couponCode!: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true, type: String })
  claimUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  fulfillmentInstructions!: string | null;
}

export enum RewardTypeDto {
  COUPON = 'coupon',
  PHYSICAL = 'physical',
}

export class CreateRewardCatalogItemDto extends OperatorReasonDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  competitionId!: string;

  @ApiProperty({ maxLength: 120, type: String })
  @IsString()
  @Length(2, 120)
  sponsorName!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(2, 160)
  title!: string;

  @ApiProperty({ maxLength: 2_000, type: String })
  @IsString()
  @Length(2, 2_000)
  description!: string;

  @ApiProperty({ enum: RewardTypeDto, type: String })
  @IsEnum(RewardTypeDto)
  rewardType!: RewardTypeDto;

  @ApiPropertyOptional({ format: 'uri', type: String })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;

  @ApiPropertyOptional({ format: 'uri', type: String })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  termsUrl?: string;

  @ApiPropertyOptional({ format: 'uri', type: String })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  claimUrl?: string;

  @ApiPropertyOptional({ maxLength: 2_000, type: String })
  @IsOptional()
  @IsString()
  @Length(2, 2_000)
  fulfillmentInstructions?: string;

  @ApiProperty({ maximum: 100_000, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  @Max(100_000)
  inventoryTotal!: number;

  @ApiPropertyOptional({ default: 0, minimum: 0, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  availableUntil?: string;
}

export class UpdateRewardCatalogItemDto extends CreateRewardCatalogItemDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export enum RewardCatalogStatusAction {
  ARCHIVE = 'archive',
  PUBLISH = 'publish',
}

export class RewardCatalogStatusActionDto extends OperatorReasonDto {
  @ApiProperty({ enum: RewardCatalogStatusAction, type: String })
  @IsEnum(RewardCatalogStatusAction)
  action!: RewardCatalogStatusAction;

  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AddRewardCouponCodesDto extends OperatorReasonDto {
  @ApiProperty({ isArray: true, maxItems: 10_000, type: String })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10_000)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(3, 256, { each: true })
  codes!: string[];
}

export class AdminRewardResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['archived', 'draft', 'published'], type: String })
  status!: RewardCatalogStatus;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class AddedCouponCodesResponseDto {
  @ApiProperty({ minimum: 1, type: Number })
  added!: number;

  @ApiProperty({ format: 'uuid', type: String })
  rewardId!: string;
}

export enum RewardAwardStatusAction {
  CANCEL = 'cancel',
  FULFILL = 'fulfill',
  REDEEM = 'redeem',
}

export class RewardAwardStatusActionDto extends OperatorReasonDto {
  @ApiProperty({ enum: RewardAwardStatusAction, type: String })
  @IsEnum(RewardAwardStatusAction)
  action!: RewardAwardStatusAction;
}

export class AdminRewardAwardResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({
    enum: ['awarded', 'cancelled', 'claimed', 'fulfilled', 'redeemed'],
  })
  status!: RewardAwardStatus;
}

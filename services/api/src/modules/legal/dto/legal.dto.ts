import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import type { LegalReceiptRequirement } from '../../../database/database.types';
import { OperatorReasonDto } from '../../operator/dto/operator.dto';

const jurisdictionPattern = /^(?:GLOBAL|[A-Z]{2}(?:-[A-Z0-9]{1,8})?)$/i;
const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/i;

export class LegalDocumentQueryDto {
  @ApiPropertyOptional({ default: 'GLOBAL', type: String })
  @IsOptional()
  @Matches(jurisdictionPattern)
  jurisdictionCode = 'GLOBAL';

  @ApiPropertyOptional({ default: 'en', type: String })
  @IsOptional()
  @Matches(localePattern)
  locale = 'en';
}

export class LegalDocumentSectionDto {
  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(1, 160)
  heading!: string;

  @ApiPropertyOptional({ maxLength: 4_000, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 4_000)
  body?: string;

  @ApiPropertyOptional({ isArray: true, maxItems: 30, type: String })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 1_000, { each: true })
  bullets?: string[];
}

export class LegalDocumentContentDto {
  @ApiProperty({ maxLength: 4_000, type: String })
  @IsString()
  @Length(1, 4_000)
  intro!: string;

  @ApiProperty({ isArray: true, maxItems: 40, type: LegalDocumentSectionDto })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => LegalDocumentSectionDto)
  sections!: LegalDocumentSectionDto[];
}

export enum LegalReceiptRequirementDto {
  ACCEPT = 'accept',
  ACKNOWLEDGE = 'acknowledge',
  NONE = 'none',
}

export class PublishLegalDocumentDto extends OperatorReasonDto {
  @ApiProperty({ example: 'terms_of_service', maxLength: 64, type: String })
  @Matches(/^[a-z][a-z0-9_]{1,63}$/)
  documentKey!: string;

  @ApiProperty({ example: 'CA-BC', maxLength: 16, type: String })
  @Matches(jurisdictionPattern)
  jurisdictionCode!: string;

  @ApiProperty({ example: 'en-CA', maxLength: 16, type: String })
  @Matches(localePattern)
  locale!: string;

  @ApiProperty({ maxLength: 64, type: String })
  @IsString()
  @Length(1, 64)
  version!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(1, 160)
  title!: string;

  @ApiProperty({ type: LegalDocumentContentDto })
  @ValidateNested()
  @Type(() => LegalDocumentContentDto)
  content!: LegalDocumentContentDto;

  @ApiProperty({ enum: LegalReceiptRequirementDto, type: String })
  @IsEnum(LegalReceiptRequirementDto)
  receiptRequirement!: LegalReceiptRequirement;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  effectiveAt!: string;
}

export class WithdrawLegalDocumentDto extends OperatorReasonDto {}

export class LegalDocumentResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  documentKey!: string;

  @ApiProperty({ type: String })
  jurisdictionCode!: string;

  @ApiProperty({ type: String })
  locale!: string;

  @ApiProperty({ type: String })
  version!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: LegalDocumentContentDto })
  content!: LegalDocumentContentDto;

  @ApiProperty({ minLength: 64, maxLength: 64, type: String })
  contentSha256!: string;

  @ApiProperty({ enum: LegalReceiptRequirementDto, type: String })
  receiptRequirement!: LegalReceiptRequirement;

  @ApiProperty({ format: 'date-time', type: String })
  effectiveAt!: string;
}

export class CurrentLegalDocumentsResponseDto {
  @ApiProperty({ minLength: 64, maxLength: 64, type: String })
  bundleSha256!: string;

  @ApiProperty({ type: Boolean })
  configured!: boolean;

  @ApiProperty({ isArray: true, type: LegalDocumentResponseDto })
  documents!: LegalDocumentResponseDto[];

  @ApiProperty({ type: String })
  jurisdictionCode!: string;

  @ApiProperty({ type: String })
  locale!: string;
}

export enum LegalReceiptActionDto {
  ACCEPT = 'accept',
  ACKNOWLEDGE = 'acknowledge',
}

export class LegalReceiptItemDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  documentId!: string;

  @ApiProperty({ minLength: 64, maxLength: 64, type: String })
  @Matches(/^[0-9a-f]{64}$/)
  contentSha256!: string;

  @ApiProperty({ enum: LegalReceiptActionDto, type: String })
  @IsEnum(LegalReceiptActionDto)
  action!: 'accept' | 'acknowledge';
}

export class RecordLegalReceiptBundleDto extends LegalDocumentQueryDto {
  @ApiProperty({ minLength: 64, maxLength: 64, type: String })
  @Matches(/^[0-9a-f]{64}$/)
  bundleSha256!: string;

  @ApiProperty({ isArray: true, maxItems: 20, type: LegalReceiptItemDto })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((item: LegalReceiptItemDto) => item.documentId)
  @ValidateNested({ each: true })
  @Type(() => LegalReceiptItemDto)
  documents!: LegalReceiptItemDto[];
}

export class LegalReceiptStatusResponseDto extends CurrentLegalDocumentsResponseDto {
  @ApiProperty({ type: Boolean })
  complete!: boolean;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  receiptBundleId!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  acceptedAt!: string | null;
}

export class SetVerificationConsentDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  accepted!: boolean;

  @ApiProperty({ example: '2026-07-05', maxLength: 64, type: String })
  @IsString()
  @Length(1, 64)
  consentVersion!: string;
}

export class VerificationConsentStatusResponseDto {
  @ApiProperty({ type: Boolean })
  accepted!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  acceptedAt!: string | null;

  @ApiProperty({
    enum: ['device_presence_qr_camera'],
    example: 'device_presence_qr_camera',
    type: String,
  })
  consentKey!: 'device_presence_qr_camera';

  @ApiProperty({ example: '2026-07-05', type: String })
  consentVersion!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  updatedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  withdrawnAt!: string | null;
}

export class AdminLegalDocumentResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['effective', 'scheduled', 'withdrawn'], type: String })
  status!: 'effective' | 'scheduled' | 'withdrawn';

  @ApiProperty({ minLength: 64, maxLength: 64, type: String })
  contentSha256!: string;
}

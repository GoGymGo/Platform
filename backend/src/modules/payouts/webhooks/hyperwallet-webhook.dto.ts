import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class HyperwalletWebhookDto {
  @ApiProperty({ maxLength: 64, type: String })
  @IsString()
  @Length(4, 64)
  token!: string;

  @ApiProperty({ maxLength: 160, type: String })
  @IsString()
  @Length(3, 160)
  type!: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  createdOn?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class HyperwalletWebhookAcceptedDto {
  @ApiProperty({ type: Boolean })
  accepted!: true;
}

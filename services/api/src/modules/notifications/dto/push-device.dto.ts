import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';

export enum PushPlatformDto {
  ANDROID = 'android',
  IOS = 'ios',
}

export class RegisterPushDeviceDto {
  @ApiProperty({ enum: PushPlatformDto, type: String })
  @IsEnum(PushPlatformDto)
  platform!: 'android' | 'ios';

  @ApiProperty({ maxLength: 512, minLength: 16, type: String })
  @IsString()
  @Length(16, 512)
  pushToken!: string;
}

export class PushDeviceResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['expo'], type: String })
  provider!: 'expo';

  @ApiProperty({ enum: PushPlatformDto, type: String })
  platform!: 'android' | 'ios';

  @ApiProperty({ type: Boolean })
  enabled!: boolean;
}

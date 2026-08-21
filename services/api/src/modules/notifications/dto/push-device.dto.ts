import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, Length, Matches } from 'class-validator';

export enum PushPlatformDto {
  ANDROID = 'android',
  IOS = 'ios',
}

export class RegisterPushDeviceDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID('4')
  installationId!: string;

  @ApiProperty({ enum: PushPlatformDto, type: String })
  @IsEnum(PushPlatformDto)
  platform!: 'android' | 'ios';

  @ApiProperty({ maxLength: 512, minLength: 16, type: String, writeOnly: true })
  @IsString()
  @Length(16, 512)
  @Matches(/^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/)
  pushToken!: string;
}

export class PushCapabilitiesResponseDto {
  @ApiProperty({ enum: ['available', 'disabled'], type: String })
  deliveryStatus!: 'available' | 'disabled';

  @ApiProperty({ enum: [5], type: Number })
  maximumDevices!: 5;

  @ApiProperty({ type: Boolean })
  registrationAvailable!: boolean;
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

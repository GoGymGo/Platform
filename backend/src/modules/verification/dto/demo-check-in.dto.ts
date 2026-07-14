import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsEnum, IsString } from 'class-validator';

export enum DemoCheckpointTypeDto {
  SESSION_START = 'session_start',
}

export class CreateDemoCheckInDto {
  @ApiProperty({ enum: ['CA-BC'], example: 'CA-BC', type: String })
  @IsString()
  @Equals('CA-BC')
  regionCode!: string;

  @ApiProperty({ enum: DemoCheckpointTypeDto, type: String })
  @IsEnum(DemoCheckpointTypeDto)
  checkpointType!: DemoCheckpointTypeDto;
}

export class DemoCheckInResponseDto {
  @ApiProperty({ type: Boolean })
  demo!: true;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;

  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'date-time', type: String })
  issuedAt!: string;

  @ApiProperty({ enum: ['simulated'], type: String })
  outcome!: 'simulated';

  @ApiProperty({ enum: ['canada_demo'], type: String })
  provider!: 'canada_demo';

  @ApiProperty({ enum: ['CA-BC'], example: 'CA-BC', type: String })
  regionCode!: string;

  @ApiProperty({ enum: DemoCheckpointTypeDto, type: String })
  checkpointType!: 'session_start';
}

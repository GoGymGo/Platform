import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'gogymgo-api', type: String })
  service!: string;

  @ApiProperty({ enum: ['ok'], example: 'ok', type: String })
  status!: 'ok';

  @ApiProperty({ example: '2026-07-12T12:00:00.000Z', type: String })
  timestamp!: string;

  @ApiProperty({ example: 123.45, type: Number })
  uptimeSeconds!: number;
}

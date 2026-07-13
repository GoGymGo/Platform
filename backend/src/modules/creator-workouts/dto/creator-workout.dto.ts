import { ApiProperty } from '@nestjs/swagger';

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
}

import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type {
  CompetitionStatus,
  EnrollmentStatus,
} from '../../../database/database.types';

export class CompetitionRulesResponseDto {
  @ApiProperty({ type: Number })
  minSessionMinutes!: number;

  @ApiProperty({ type: Number })
  minHeartRateSamples!: number;

  @ApiProperty({ type: Boolean })
  requireFaceCheck!: boolean;

  @ApiProperty({ type: Boolean })
  requireGymQr!: boolean;

  @ApiProperty({ type: Number })
  signupPrizeDrawEntries!: number;

  @ApiProperty({ type: Number })
  verifiedSessionCategoryScore!: number;

  @ApiProperty({ type: Number })
  verifiedSessionPrizeDrawEntries!: number;

  @ApiProperty({ type: Number })
  payoutPoolAmountMinor!: number;

  @ApiProperty({ type: Number })
  payoutWinnerCount!: number;

  @ApiProperty({ type: Number })
  payoutExponent!: number;
}

export class CompetitionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({
    enum: [
      'draft',
      'registration',
      'active',
      'settling',
      'settled',
      'cancelled',
    ],
  })
  status!: CompetitionStatus;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ type: String })
  regionName!: string;

  @ApiProperty({ type: String })
  rulesVersion!: string;

  @ApiProperty({ type: CompetitionRulesResponseDto })
  rules!: CompetitionRulesResponseDto;

  @ApiProperty({ isArray: true, type: Number })
  goalDays!: number[];

  @ApiProperty({ format: 'date-time', type: String })
  registrationOpensAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  registrationClosesAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;
}

export class CreateEnrollmentDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  @IsInt()
  @Max(7)
  @Min(1)
  goalDays!: number;

  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  regionVerificationId!: string;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  @IsBoolean()
  rulesAccepted!: true;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  @IsBoolean()
  ageEligibilityAttested!: true;
}

export class EnrollmentResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: Number })
  goalDays!: number;

  @ApiProperty({ enum: ['active', 'withdrawn', 'disqualified'] })
  status!: EnrollmentStatus;

  @ApiProperty({ format: 'date-time', type: String })
  enrolledAt!: string;
}

export class EnrollmentCountQueryDto {
  @ApiProperty({ type: String })
  @IsString()
  region!: string;
}

export class EnrollmentCountResponseDto {
  @ApiProperty({ type: Number })
  count!: number;
}

export class CompetitionMatchesQueryDto extends EnrollmentCountQueryDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Max(7)
  @Min(1)
  goal!: number;
}

export class CompetitionMatchResponseDto {
  @ApiProperty({ enum: ['matched', 'searching', 'solo'], type: String })
  availability!: 'matched' | 'searching' | 'solo';

  @ApiProperty({ type: String })
  opponentAlias!: string;

  @ApiProperty({ isArray: true, type: String })
  opponentVerifiedDateKeys!: string[];

  @ApiProperty({ maximum: 4, minimum: 1, type: Number })
  periodIndex!: 1 | 2 | 3 | 4;

  @ApiProperty({ type: String })
  region!: string;
}

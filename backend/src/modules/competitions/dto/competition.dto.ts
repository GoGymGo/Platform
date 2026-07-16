import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CompetitionStatus,
  EnrollmentStatus,
} from '../../../database/database.types';
import { StreakCountsDto } from '../../streaks/dto/streak.dto';

export class CompetitionRulesResponseDto {
  @ApiProperty({ type: Number })
  minSessionMinutes!: number;

  @ApiProperty({ type: Number })
  minHeartRateSamples!: number;

  @ApiProperty({ type: Boolean })
  requireDeviceAttestation!: boolean;

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

  @ApiPropertyOptional({ format: 'uuid', type: String })
  @IsOptional()
  @IsUUID()
  legalReceiptBundleId?: string;

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

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  opponentUserId!: string | null;

  @ApiProperty({ type: Number })
  opponentCurrentStreak!: number;

  @ApiProperty({ type: Number })
  opponentBestStreak!: number;

  @ApiProperty({ type: Number })
  opponentMonthlyVerifiedDays!: number;

  @ApiProperty({ type: StreakCountsDto })
  opponentStreaks!: StreakCountsDto;
}

export class WeeklyChallengePeriodQueryDto extends CompetitionMatchesQueryDto {
  @ApiProperty({ maximum: 4, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Max(4)
  @Min(1)
  period!: 1 | 2 | 3 | 4;
}

export class EligibleWeeklyChallengePartnerDto {
  @ApiProperty({ format: 'uuid', type: String })
  userId!: string;

  @ApiProperty({ type: String })
  alias!: string;

  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  goalDays!: number;

  @ApiProperty({ enum: ['available', 'pending'], type: String })
  requestStatus!: 'available' | 'pending';

  @ApiProperty({ type: StreakCountsDto })
  streaks!: StreakCountsDto;
}

export class CreateWeeklyChallengeRequestDto extends WeeklyChallengePeriodQueryDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  recipientUserId!: string;
}

export class WeeklyChallengeRequestDecisionDto {
  @ApiProperty({ enum: ['accepted', 'declined'], type: String })
  @IsIn(['accepted', 'declined'])
  decision!: 'accepted' | 'declined';
}

export class WeeklyChallengeRequestResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ enum: ['incoming', 'outgoing'], type: String })
  direction!: 'incoming' | 'outgoing';

  @ApiProperty({ type: String })
  partnerAlias!: string;

  @ApiProperty({ format: 'uuid', type: String })
  partnerUserId!: string;

  @ApiProperty({ type: StreakCountsDto })
  partnerStreaks!: StreakCountsDto;

  @ApiProperty({ maximum: 4, minimum: 1, type: Number })
  periodIndex!: 1 | 2 | 3 | 4;

  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  goalDays!: number;

  @ApiProperty({
    enum: ['accepted', 'cancelled', 'declined', 'pending'],
    type: String,
  })
  status!: 'accepted' | 'cancelled' | 'declined' | 'pending';

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CompetitionStatus,
  EnrollmentStatus,
} from '../../../database/database.types';
import { regionCodePattern } from '../../regions/region-code';
import { StreakCountsDto } from '../../streaks/dto/streak.dto';

export class CategoryPodiumMultipliersResponseDto {
  @ApiProperty({ type: Number })
  '1'!: number;

  @ApiProperty({ type: Number })
  '2'!: number;

  @ApiProperty({ type: Number })
  '3'!: number;
}

export class CompetitionRulesResponseDto {
  @ApiProperty({ type: Number })
  minSessionMinutes!: number;

  @ApiProperty({ type: Number })
  minHeartRateSamples!: number;

  @ApiProperty({ type: Boolean })
  requireDeviceAttestation!: boolean;

  @ApiProperty({ type: Boolean })
  requirePresenceCheck!: boolean;

  @ApiProperty({ type: Boolean })
  requireGymQr!: boolean;

  @ApiProperty({ type: CategoryPodiumMultipliersResponseDto })
  categoryPodiumMultipliers!: CategoryPodiumMultipliersResponseDto;

  @ApiProperty({ type: Number })
  perfectMonthMultiplier!: number;

  @ApiProperty({ type: Number })
  signupPrizeDrawEntries!: number;

  @ApiProperty({ type: Number })
  verifiedSessionCategoryScore!: number;

  @ApiProperty({ type: Number })
  verifiedSessionPrizeDrawEntries!: number;

  @ApiProperty({ type: Number })
  weeklyChallengeBothHitMultiplier!: number;

  @ApiProperty({ type: Number })
  weeklyChallengeRecoveryMultiplier!: number;
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

  @ApiProperty({ minimum: 1, type: Number })
  minimumEntrants!: number;

  @ApiProperty({ minimum: 1, nullable: true, type: Number })
  entrantCap!: number | null;

  @ApiProperty({ format: 'date-time', type: String })
  registrationOpensAt!: string;

  @ApiProperty({
    description: 'Server time used to resolve this competition state',
    format: 'date-time',
    type: String,
  })
  serverTime!: string;

  @ApiProperty({ format: 'date-time', type: String })
  registrationClosesAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;
}

export class CurrentCompetitionQueryDto {
  @ApiPropertyOptional({ example: '2026-08', type: String })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  monthKey?: string;

  @ApiPropertyOptional({ example: 'vancouver-bc', type: String })
  @IsOptional()
  @Matches(regionCodePattern)
  region?: string;
}

export class ResolveGymQrCompetitionDto {
  @ApiProperty({ maxLength: 256, minLength: 32, type: String })
  @IsString()
  @Length(32, 256)
  credential!: string;
}

export class CurrentEnrollmentQueryDto {
  @ApiPropertyOptional({ format: 'uuid', type: String })
  @IsOptional()
  @IsUUID()
  competitionId?: string;
}

export class EnrollmentGymPresenceDto {
  @ApiProperty({ maxLength: 256, minLength: 32, type: String })
  @IsString()
  @Length(32, 256)
  credential!: string;

  @ApiProperty({ maximum: 90, minimum: -90, type: Number })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ maximum: 180, minimum: -180, type: Number })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ maximum: 100_000, minimum: 0.1, type: Number })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(100_000)
  accuracyMeters!: number;
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

  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  legalReceiptBundleId!: string;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  @IsBoolean()
  rulesAccepted!: true;

  @ApiProperty({ enum: [true], type: Boolean })
  @Equals(true)
  @IsBoolean()
  ageEligibilityAttested!: true;

  @ApiProperty({ type: EnrollmentGymPresenceDto })
  @Type(() => EnrollmentGymPresenceDto)
  @ValidateNested()
  gymPresence!: EnrollmentGymPresenceDto;
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

export class CompetitionRegionQueryDto {
  @ApiProperty({ example: 'vancouver-bc', type: String })
  @Matches(regionCodePattern)
  region!: string;
}

export class EnrollmentCountQueryDto extends CompetitionRegionQueryDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  competitionId!: string;
}

export class EnrollmentCountResponseDto {
  @ApiProperty({ type: Number })
  count!: number;
}

export class CompetitionGoalQueryDto extends CompetitionRegionQueryDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Max(7)
  @Min(1)
  goal!: number;
}

export class CompetitionMatchesQueryDto extends CompetitionGoalQueryDto {
  @ApiPropertyOptional({ format: 'uuid', type: String })
  @IsOptional()
  @IsUUID()
  competitionId?: string;
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

export class WeeklyChallengePeriodQueryDto extends CompetitionGoalQueryDto {
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

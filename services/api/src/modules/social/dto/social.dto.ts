import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { regionCodePattern } from '../../regions/region-code';
import type {
  FriendRequestStatus,
  SocialChallengeActivity,
  SocialChallengeMemberRole,
  SocialChallengeMemberStatus,
  SocialChallengeTargetPeriod,
  SocialChallengeType,
} from '../../../database/database.types';
import { StreakCountsDto } from '../../streaks/dto/streak.dto';

export const friendRequestDecisions = ['accepted', 'declined'] as const;
export const challengeInvitationDecisions = ['accepted', 'declined'] as const;
export const socialRelationships = [
  'none',
  'friend',
  'incoming_request',
  'outgoing_request',
] as const;
export const socialChallengeTypes = ['friend', 'regional'] as const;
export const socialChallengeActivities = [
  'gym',
  'running',
  'walking',
  'cycling',
  'hiking',
  'fitness_class',
  'other',
] as const;
export const socialChallengeTargetPeriods = ['weekly', 'monthly'] as const;

export type FriendRequestDecision = (typeof friendRequestDecisions)[number];
export type ChallengeInvitationDecision =
  (typeof challengeInvitationDecisions)[number];
export type SocialRelationship = (typeof socialRelationships)[number];

export class SearchUsersQueryDto {
  @ApiProperty({
    description: 'Case-insensitive Alias prefix match',
    example: 'GHOST',
    maxLength: 24,
    minLength: 2,
    pattern: '^[A-Za-z0-9_]+$',
    type: String,
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 24)
  @Matches(/^[A-Za-z0-9_]+$/)
  screenName!: string;
}

export class SendFriendRequestDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  recipientUserId!: string;
}

export class BlockMemberDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  memberUserId!: string;
}

export class FriendRequestDecisionDto {
  @ApiProperty({ enum: friendRequestDecisions, type: String })
  @IsIn(friendRequestDecisions)
  decision!: FriendRequestDecision;
}

export class ChallengeContactInputDto {
  @ApiProperty({ enum: ['email', 'phone'], type: String })
  @IsIn(['email', 'phone'])
  channel!: 'email' | 'phone';

  @ApiProperty({ example: 'friend@example.com', maxLength: 160, type: String })
  @IsString()
  @Length(5, 160)
  destination!: string;
}

export class CreateSocialChallengeDto {
  @ApiProperty({ example: 'July Strength Sprint', maxLength: 80, type: String })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ enum: socialChallengeTypes, type: String })
  @IsIn(socialChallengeTypes)
  challengeType!: SocialChallengeType;

  @ApiProperty({ enum: socialChallengeActivities, type: String })
  @IsIn(socialChallengeActivities)
  activity!: SocialChallengeActivity;

  @ApiProperty({ example: 'Gym visits', maxLength: 60, type: String })
  @IsString()
  @Length(2, 60)
  activityLabel!: string;

  @ApiProperty({
    maxLength: 240,
    nullable: true,
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;

  @ApiProperty({ example: 4, maximum: 31, minimum: 1, type: Number })
  @IsInt()
  @Max(31)
  @Min(1)
  targetCount!: number;

  @ApiProperty({ enum: socialChallengeTargetPeriods, type: String })
  @IsIn(socialChallengeTargetPeriods)
  targetPeriod!: SocialChallengeTargetPeriod;

  @ApiProperty({ example: '2026-08-01', format: 'date', type: String })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ example: '2026-08-31', format: 'date', type: String })
  @IsDateString({ strict: true })
  endDate!: string;

  @ApiProperty({
    description: 'IANA timezone for a private friend challenge',
    example: 'America/Vancouver',
    maxLength: 64,
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;

  @ApiProperty({
    example: 'toronto-on',
    maxLength: 64,
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(2, 64)
  @Matches(regionCodePattern)
  regionCode?: string;

  @ApiProperty({ maxLength: 120, required: false, type: String })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  locationName?: string;

  @ApiProperty({ example: [1, 3, 6], isArray: true, type: Number })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduledDays!: number[];

  @ApiProperty({ example: '09:00', required: false, type: String })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  scheduledTime?: string;

  @ApiProperty({ maximum: 500, minimum: 2, required: false, type: Number })
  @IsOptional()
  @IsInt()
  @Max(500)
  @Min(2)
  participantLimit?: number;

  @ApiProperty({ format: 'uuid', isArray: true, type: String })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  invitedFriendUserIds!: string[];

  @ApiProperty({
    isArray: true,
    required: false,
    type: () => ChallengeContactInputDto,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChallengeContactInputDto)
  invitedContacts?: ChallengeContactInputDto[];
}

export class DiscoverSocialChallengesQueryDto {
  @ApiProperty({ example: 'toronto-on', maxLength: 64, type: String })
  @IsString()
  @Length(2, 64)
  @Matches(regionCodePattern)
  regionCode!: string;
}

export class InviteChallengeFriendDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  friendUserId!: string;
}

export class InviteChallengeContactDto extends ChallengeContactInputDto {}

export class ChallengeContactInvitationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  challengeId!: string;

  @ApiProperty({ enum: ['email', 'phone'], type: String })
  channel!: 'email' | 'phone';

  @ApiProperty({ type: String })
  destinationHint!: string;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;

  @ApiProperty({ type: String })
  joinUrl!: string;

  @ApiProperty({ enum: ['link'], type: String })
  deliveryMode!: 'link';

  @ApiProperty({ enum: ['not_sent'], type: String })
  deliveryStatus!: 'not_sent';
}

export class RedeemChallengeContactInvitationDto {
  @ApiProperty({ minLength: 20, type: String })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ maxLength: 160, required: false, type: String })
  @IsOptional()
  @IsString()
  @Length(5, 160)
  destination?: string;
}

export class InspectChallengeContactInvitationDto {
  @ApiProperty({ minLength: 20, type: String })
  @IsString()
  @Length(20, 200)
  token!: string;
}

export class ChallengeContactInvitationPreviewDto {
  @ApiProperty({ enum: ['email', 'phone'], type: String })
  channel!: 'email' | 'phone';

  @ApiProperty({ type: String })
  destinationHint!: string;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;

  @ApiProperty({ type: String })
  challengeName!: string;

  @ApiProperty({ type: String })
  ownerScreenName!: string;
}

export class ChallengeInvitationDecisionDto {
  @ApiProperty({ enum: challengeInvitationDecisions, type: String })
  @IsIn(challengeInvitationDecisions)
  decision!: ChallengeInvitationDecision;
}

export class SocialUserSummaryDto {
  @ApiProperty({ type: String })
  screenName!: string;

  @ApiProperty({ format: 'uuid', type: String })
  userId!: string;

  @ApiProperty({ type: StreakCountsDto })
  streaks!: StreakCountsDto;
}

export class UserSearchResultDto extends SocialUserSummaryDto {
  @ApiProperty({ enum: socialRelationships, type: String })
  relationship!: SocialRelationship;
}

export class FriendResponseDto extends SocialUserSummaryDto {
  @ApiProperty({ format: 'date-time', type: String })
  friendsSince!: string;
}

export class BlockedMemberResponseDto extends SocialUserSummaryDto {
  @ApiProperty({ format: 'date-time', type: String })
  blockedAt!: string;
}

export class FriendRequestResponseDto {
  @ApiProperty({ enum: ['incoming', 'outgoing'], type: String })
  direction!: 'incoming' | 'outgoing';

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: SocialUserSummaryDto })
  user!: SocialUserSummaryDto;
}

export class FriendRequestDecisionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  requestId!: string;

  @ApiProperty({ enum: friendRequestDecisions, type: String })
  status!: Extract<FriendRequestStatus, 'accepted' | 'declined'>;
}

export class SocialRelationshipActionResponseDto {
  @ApiProperty({
    enum: ['blocked', 'cancelled', 'removed', 'unblocked'],
    type: String,
  })
  action!: 'blocked' | 'cancelled' | 'removed' | 'unblocked';

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  requestId!: string | null;

  @ApiProperty({ format: 'uuid', type: String })
  userId!: string;
}

export class SocialChallengeProgressDto {
  @ApiProperty({ minimum: 0, type: Number })
  completedCount!: number;

  @ApiProperty({ maximum: 100, minimum: 0, type: Number })
  completionPercent!: number;

  @ApiProperty({ minimum: 1, type: Number })
  targetTotal!: number;
}

export class SocialChallengeMemberDto {
  @ApiProperty({ type: String })
  screenName!: string;

  @ApiProperty({ type: StreakCountsDto })
  streaks!: StreakCountsDto;

  @ApiProperty({ enum: ['owner', 'member'], type: String })
  role!: SocialChallengeMemberRole;

  @ApiProperty({ enum: ['pending', 'accepted'], type: String })
  status!: Extract<SocialChallengeMemberStatus, 'accepted' | 'pending'>;

  @ApiProperty({ type: SocialChallengeProgressDto })
  progress!: SocialChallengeProgressDto;
}

export class SocialChallengeResponseDto {
  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: SocialChallengeMemberDto, isArray: true })
  members!: SocialChallengeMemberDto[];

  @ApiProperty({ enum: ['owner', 'member'], nullable: true, type: String })
  myRole!: SocialChallengeMemberRole | null;

  @ApiProperty({ enum: ['pending', 'accepted', 'not_joined'], type: String })
  myStatus!:
    Extract<SocialChallengeMemberStatus, 'accepted' | 'pending'> | 'not_joined';

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  ownerScreenName!: string;

  @ApiProperty({ type: StreakCountsDto })
  ownerStreaks!: StreakCountsDto;

  @ApiProperty({ enum: socialChallengeTypes, type: String })
  challengeType!: SocialChallengeType;

  @ApiProperty({ enum: socialChallengeActivities, type: String })
  activity!: SocialChallengeActivity;

  @ApiProperty({ type: String })
  activityLabel!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  targetCount!: number;

  @ApiProperty({ enum: socialChallengeTargetPeriods, type: String })
  targetPeriod!: SocialChallengeTargetPeriod;

  @ApiProperty({ format: 'date', type: String })
  startDate!: string;

  @ApiProperty({ format: 'date', type: String })
  endDate!: string;

  @ApiProperty({ nullable: true, type: String })
  regionCode!: string | null;

  @ApiProperty({ nullable: true, type: String })
  regionName!: string | null;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ nullable: true, type: String })
  locationName!: string | null;

  @ApiProperty({ isArray: true, type: Number })
  scheduledDays!: number[];

  @ApiProperty({ nullable: true, type: String })
  scheduledTime!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  participantLimit!: number | null;

  @ApiProperty({ minimum: 1, type: Number })
  participantCount!: number;

  @ApiProperty({ type: SocialChallengeProgressDto })
  myProgress!: SocialChallengeProgressDto;

  @ApiProperty({
    enum: ['upcoming', 'active', 'full', 'ended', 'cancelled'],
    type: String,
  })
  state!: 'active' | 'cancelled' | 'ended' | 'full' | 'upcoming';

  @ApiProperty({ type: Boolean })
  canCancel!: boolean;

  @ApiProperty({ type: Boolean })
  canCheckIn!: boolean;

  @ApiProperty({ type: Boolean })
  canInvite!: boolean;

  @ApiProperty({ type: Boolean })
  canJoin!: boolean;

  @ApiProperty({ type: Boolean })
  canRespond!: boolean;

  @ApiProperty({ type: Boolean })
  canWithdraw!: boolean;

  @ApiProperty({ format: 'date-time', type: String })
  serverTime!: string;

  @ApiProperty({
    isArray: true,
    type: ChallengeContactInvitationResponseDto,
  })
  contactInvitations!: ChallengeContactInvitationResponseDto[];
}

export class ChallengeInvitationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  challengeId!: string;

  @ApiProperty({
    enum: ['pending', 'accepted', 'declined', 'withdrawn'],
    type: String,
  })
  status!: SocialChallengeMemberStatus;
}

export class ChallengeCancellationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  challengeId!: string;

  @ApiProperty({ enum: ['cancelled'], type: String })
  state!: 'cancelled';
}

export class ChallengeCheckInResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  challengeId!: string;

  @ApiProperty({ format: 'uuid', type: String })
  checkInId!: string;

  @ApiProperty({ format: 'date', type: String })
  eligibleDate!: string;

  @ApiProperty({ enum: ['manual', 'verified_workout'], type: String })
  source!: 'manual' | 'verified_workout';
}

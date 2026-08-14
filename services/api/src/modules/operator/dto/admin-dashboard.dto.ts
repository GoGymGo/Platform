import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardIdentityDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'email', type: String })
  email!: string;

  @ApiProperty({ isArray: true, type: String })
  roles!: string[];
}

export class AdminDashboardRegionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  countryCode!: string;

  @ApiProperty({ type: String })
  subdivisionCode!: string;

  @ApiProperty({ type: String })
  metroName!: string;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ isArray: true, type: String })
  languageCodes!: string[];

  @ApiProperty({ type: Number })
  minimumAge!: number;

  @ApiProperty({ type: Boolean })
  competitionEnabled!: boolean;

  @ApiProperty({ type: String })
  boundaryVersion!: string;

  @ApiProperty({ type: String })
  policyVersion!: string;

  @ApiProperty({ format: 'date-time', type: String })
  validFrom!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  validTo!: string | null;
}

export class AdminDashboardGoalBracketDto {
  @ApiProperty({ maximum: 7, minimum: 1, type: Number })
  goalDays!: number;

  @ApiProperty({ type: String })
  label!: string;
}

export class AdminDashboardDrawDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ enum: ['locked', 'settled'], type: String })
  status!: 'locked' | 'settled';

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  seedCommitment!: string;

  @ApiProperty({ format: 'date-time', type: String })
  lockedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  settledAt!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  entrantCount!: number;

  @ApiProperty({ pattern: '^[1-9][0-9]*$', type: String })
  totalEntries!: string;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  entrantSnapshotHash!: string;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  scoringSnapshotHash!: string;

  @ApiProperty({ minimum: 1, type: Number })
  rewardSlotCount!: number;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  rewardSnapshotHash!: string;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  publicResultSnapshotHash!: string;
}

export class AdminDashboardCompetitionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', isArray: true, type: String })
  assignedGymIds!: string[];

  @ApiProperty({ format: 'uuid', type: String })
  regionPolicyId!: string;

  @ApiProperty({ type: String })
  regionCode!: string;

  @ApiProperty({ type: String })
  regionName!: string;

  @ApiProperty({ type: String })
  monthKey!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;

  @ApiProperty({ type: String })
  rulesVersion!: string;

  @ApiProperty({ type: Object })
  rules!: Record<string, unknown>;

  @ApiProperty({ type: Number })
  minimumEntrants!: number;

  @ApiProperty({ nullable: true, type: Number })
  entrantCap!: number | null;

  @ApiProperty({ type: Number })
  enrollmentCount!: number;

  @ApiProperty({ type: Number })
  rewardCount!: number;

  @ApiProperty({ type: Number })
  publishedRewardCount!: number;

  @ApiProperty({ isArray: true, type: AdminDashboardGoalBracketDto })
  goalBrackets!: AdminDashboardGoalBracketDto[];

  @ApiProperty({ format: 'date-time', type: String })
  registrationOpensAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  registrationClosesAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;

  @ApiProperty({ nullable: true, type: AdminDashboardDrawDto })
  draw!: AdminDashboardDrawDto | null;
}

export class AdminDashboardRewardDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ type: String })
  competitionName!: string;

  @ApiProperty({ type: String })
  sponsorName!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String })
  rewardType!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ format: 'uri', nullable: true, type: String })
  imageUrl!: string | null;

  @ApiProperty({ format: 'uri', nullable: true, type: String })
  termsUrl!: string | null;

  @ApiProperty({ format: 'uri', nullable: true, type: String })
  claimUrl!: string | null;

  @ApiProperty({ nullable: true, type: String })
  fulfillmentInstructions!: string | null;

  @ApiProperty({ type: Number })
  inventoryTotal!: number;

  @ApiProperty({ type: Number })
  couponCodeCount!: number;

  @ApiProperty({ type: Number })
  assignedCouponCodeCount!: number;

  @ApiProperty({ type: Number })
  displayOrder!: number;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  availableFrom!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  availableUntil!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class AdminDashboardRewardAwardDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  rewardId!: string;

  @ApiProperty({ enum: ['cash', 'coupon', 'physical'], type: String })
  rewardType!: 'cash' | 'coupon' | 'physical';

  @ApiProperty({ type: String })
  sponsorName!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  winnerCallsign!: string;

  @ApiProperty({ minimum: 1, type: Number })
  awardRank!: number;

  @ApiProperty({
    enum: ['awarded', 'cancelled', 'claimed', 'fulfilled', 'redeemed'],
    type: String,
  })
  status!: 'awarded' | 'cancelled' | 'claimed' | 'fulfilled' | 'redeemed';

  @ApiProperty({ format: 'date-time', type: String })
  awardedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  claimedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  fulfilledAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  redeemedAt!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class AdminDashboardCreatorWorkoutDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  creatorUserId!: string | null;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  creatorName!: string;

  @ApiProperty({ format: 'uri', type: String })
  videoUrl!: string;

  @ApiProperty({ format: 'uri', nullable: true, type: String })
  thumbnailUrl!: string | null;

  @ApiProperty({ type: Number })
  durationMinutes!: number;

  @ApiProperty({ type: String })
  workoutStyle!: string;

  @ApiProperty({ nullable: true, type: String })
  sponsorName!: string | null;

  @ApiProperty({ isArray: true, type: String })
  regionCodes!: string[];

  @ApiProperty({ type: Boolean })
  published!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  publishedAt!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  version!: number;
}

export class AdminDashboardLegalDocumentDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  documentKey!: string;

  @ApiProperty({ type: String })
  jurisdictionCode!: string;

  @ApiProperty({ type: String })
  locale!: string;

  @ApiProperty({ type: String })
  version!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: Object })
  content!: Record<string, unknown>;

  @ApiProperty({ type: String })
  contentSha256!: string;

  @ApiProperty({ type: String })
  receiptRequirement!: string;

  @ApiProperty({ enum: ['effective', 'scheduled', 'withdrawn'], type: String })
  status!: 'effective' | 'scheduled' | 'withdrawn';

  @ApiProperty({ format: 'date-time', type: String })
  effectiveAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  ownerApprovedAt!: string | null;
}

export class AdminDashboardAuditEventDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ format: 'email', nullable: true, type: String })
  actorEmail!: string | null;

  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ type: String })
  entityType!: string;

  @ApiProperty({ format: 'uuid', type: String })
  entityId!: string;

  @ApiProperty({ type: String })
  reason!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class AdminDashboardSnapshotDto {
  @ApiProperty({ type: AdminDashboardIdentityDto })
  admin!: AdminDashboardIdentityDto;

  @ApiProperty({ isArray: true, type: AdminDashboardRegionDto })
  regions!: AdminDashboardRegionDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardCompetitionDto })
  competitions!: AdminDashboardCompetitionDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardRewardDto })
  rewards!: AdminDashboardRewardDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardRewardAwardDto })
  rewardAwards!: AdminDashboardRewardAwardDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardCreatorWorkoutDto })
  creatorWorkouts!: AdminDashboardCreatorWorkoutDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardLegalDocumentDto })
  legalDocuments!: AdminDashboardLegalDocumentDto[];

  @ApiProperty({ isArray: true, type: AdminDashboardAuditEventDto })
  auditEvents!: AdminDashboardAuditEventDto[];

  @ApiProperty({ format: 'date-time', type: String })
  generatedAt!: string;
}

export type FirebaseClientConfig = {
  apiKey: string;
  appId: string;
  authDomain: string;
  measurementId?: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
};

export type RegionPolicy = {
  boundaryVersion: string;
  code: string;
  competitionEnabled: boolean;
  countryCode: string;
  currency: string;
  id: string;
  languageCodes: string[];
  metroName: string;
  minimumAge: number;
  policyVersion: string;
  subdivisionCode: string;
  timezone: string;
  validFrom: string;
  validTo: string | null;
};

export type GoalBracket = {
  goalDays: number;
  label: string;
};

export type CompetitionDraw = {
  entrantCount: number;
  entrantSnapshotHash: string;
  id: string;
  lockedAt: string;
  publicResultSnapshotHash: string;
  rewardSlotCount: number;
  rewardSnapshotHash: string;
  scoringSnapshotHash: string;
  seedCommitment: string;
  settledAt: string | null;
  status: "locked" | "settled";
  totalEntries: string;
};

export type Competition = {
  assignedGymIds: string[];
  endsAt: string;
  draw: CompetitionDraw | null;
  enrollmentCount: number;
  entrantCap: number | null;
  goalBrackets: GoalBracket[];
  id: string;
  minimumEntrants: number;
  monthKey: string;
  name: string;
  publishedRewardCount: number;
  regionCode: string;
  regionName: string;
  regionPolicyId: string;
  registrationClosesAt: string;
  registrationOpensAt: string;
  rewardCount: number;
  rules: Record<string, unknown>;
  rulesVersion: string;
  startsAt: string;
  status: string;
  version: number;
};

export type Reward = {
  assignedCouponCodeCount: number;
  availableFrom: string | null;
  availableUntil: string | null;
  claimUrl: string | null;
  competitionId: string;
  competitionName: string;
  couponCodeCount: number;
  description: string;
  displayOrder: number;
  fulfillmentInstructions: string | null;
  id: string;
  imageUrl: string | null;
  inventoryTotal: number;
  rewardType: "cash" | "coupon" | "physical";
  sponsorName: string;
  status: string;
  termsUrl: string | null;
  title: string;
  version: number;
};

export type RewardAward = {
  awardRank: number;
  awardedAt: string;
  claimedAt: string | null;
  fulfilledAt: string | null;
  id: string;
  redeemedAt: string | null;
  rewardId: string;
  rewardType: "cash" | "coupon" | "physical";
  sponsorName: string;
  status: "awarded" | "cancelled" | "claimed" | "fulfilled" | "redeemed";
  title: string;
  version: number;
  winnerCallsign: string;
};

export type CreatorWorkout = {
  creatorName: string;
  creatorUserId: string | null;
  durationMinutes: number;
  id: string;
  published: boolean;
  publishedAt: string | null;
  regionCodes: string[];
  sponsorName: string | null;
  thumbnailUrl: string | null;
  title: string;
  version: number;
  videoUrl: string;
  workoutStyle: string;
};

export type LegalDocument = {
  content: Record<string, unknown>;
  contentSha256: string;
  documentKey: string;
  effectiveAt: string;
  id: string;
  jurisdictionCode: string;
  locale: string;
  ownerApprovedAt: string | null;
  receiptRequirement: string;
  status: "effective" | "scheduled" | "withdrawn";
  title: string;
  version: string;
};

export type AuditEvent = {
  action: string;
  actorEmail: string | null;
  after?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  reason: string;
};

export type DashboardSnapshot = {
  admin: {
    email: string;
    id: string;
    roles: string[];
  };
  auditEvents: AuditEvent[];
  competitions: Competition[];
  creatorWorkouts: CreatorWorkout[];
  generatedAt: string;
  legalDocuments: LegalDocument[];
  regions: RegionPolicy[];
  rewardAwards: RewardAward[];
  rewards: Reward[];
};

export type OperatorPortalAccess = {
  assignments: {
    accessLevel: "admin" | "staff";
    gymLocationId: string;
  }[];
  email: string;
  id: string;
  portal: "gogymgo" | "partner";
  roles: string[];
};

export type WorkQueueItem = {
  createdAt: string;
  id: string;
  kind: string;
  regionCode?: string;
  status: string;
  verificationMethod?: string;
};

export type SystemHealth = {
  checkedAt: string;
  database: "ok";
  queues: {
    competitionStartsDue: number;
    notificationsPending: number;
    privacyOperationsPending: number;
    profileMediaCleanupPending: number;
  };
  worker: {
    heartbeatAgeSeconds: number | null;
    lastCompletedAt: string | null;
    lastFailedAt: string | null;
    lastFailureCode: string | null;
    status: "degraded" | "healthy" | "stale" | "starting";
  };
};

export type AdminSection =
  | "overview"
  | "pilot"
  | "competitions"
  | "rewards"
  | "regions"
  | "content"
  | "operations"
  | "audit";
import type {
  GymLocationResponseDto,
  GymQrCredentialResponseDto,
  OperatorAuditHistoryDto,
  OperatorGymSessionDto,
  OperatorInterestSubmissionDto,
  OperatorPartnerApplicationDto,
  RegionWaitlistEntryDto,
} from "@gogymgo/contracts";

export type GymLocation = GymLocationResponseDto;
export type GymQrCredential = GymQrCredentialResponseDto;
export type GymSession = OperatorGymSessionDto;
export type InterestSubmission = OperatorInterestSubmissionDto;
export type PartnerApplication = OperatorPartnerApplicationDto;
export type PilotAuditEvent = OperatorAuditHistoryDto;
export type RegionWaitlistEntry = RegionWaitlistEntryDto;

export type PartnerGym = GymLocation & {
  accessLevel: "admin" | "staff";
};

export type PartnerCompetition = Competition & {
  gymLocationId: string;
  gymName: string;
  proposedByUserId: string | null;
};

export type PartnerDashboardSnapshot = {
  competitions: PartnerCompetition[];
  generatedAt: string;
  gyms: PartnerGym[];
  operator: DashboardSnapshot["admin"];
  regions: RegionPolicy[];
  sessions: GymSession[];
};

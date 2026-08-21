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
  version: number;
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
  proposalStatus: PartnerProposalStatus | null;
  proposalVersion: number | null;
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
  cashAmountCents: number | null;
  cashCurrency: string | null;
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
  cashAmountCents: number | null;
  cashCurrency: string | null;
  cashFulfillmentId: string | null;
  claimedAt: string | null;
  competitionId: string;
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
  lifecycleVersion: number;
  ownerApprovedAt: string | null;
  receiptRequirement: string;
  status: "effective" | "scheduled" | "withdrawn";
  title: string;
  version: string;
};

export type AuditEvent = {
  action: string;
  actorEmail: string | null;
  after: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
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
  capabilities: {
    creatorConfigurationEnabled: boolean;
    legalPublicationOwner: boolean;
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
  portal: "gogymgo" | "partner";
};

export type WorkQueueItem = {
  createdAt: string;
  decisionAllowed: boolean;
  decisionRestrictionCode?:
    "self_review" | "stale_policy" | "unsupported_method";
  failureCode?: string;
  id: string;
  kind: WorkQueueKind;
  nextAttemptAt?: string;
  regionCode?: string;
  requestType?: "delete" | "export";
  reviewVersion: number;
  status: string;
  verificationMethod?: string;
};

export const workQueueKinds = [
  "creator_submission",
  "partner_application",
  "privacy_request",
  "profile_media",
  "region_verification",
  "region_waitlist",
  "workout_session",
] as const;

export type WorkQueueKind = (typeof workQueueKinds)[number];

export type WorkQueuePage = {
  items: WorkQueueItem[];
  nextCursor: string | null;
};

export type ReviewFact = { label: string; value: string };

export type SessionEvidenceFinding = "approved" | "not_required" | "rejected";

export type SessionEvidenceReview = {
  competitionId: string;
  completedAt: string;
  durationMinutes: number;
  eligibleDate: string;
  evidence: Record<
    "deviceAttestation" | "gymQr" | "heartRate" | "presenceCheck",
    { count: number; minimumRequiredCount: number; required: boolean }
  >;
  evidenceSnapshotSha256: string;
  limitations: string[];
  minimumDurationMinutes: number;
  policyVersion: string;
  sessionId: string;
  startedAt: string;
  status: string;
};

export type WorkQueueDetail = WorkQueueItem & {
  allowedDecisions: string[];
  facts: ReviewFact[];
  sessionEvidence?: SessionEvidenceReview;
};

export type ProfileMediaReviewAction = {
  contentLength: number;
  contentType: string;
  expiresAt: string;
  height: number;
  id: string;
  reviewVersion: number;
  sha256: string;
  submittedAt: string;
  url: string;
  width: number;
};

export type AuditPage = {
  items: AuditEvent[];
  nextCursor: string | null;
};

export type ProviderHealth = {
  evidence: string;
  status: "configured" | "disabled" | "unavailable" | "unconfigured";
};

export type SystemHealth = {
  checkedAt: string;
  database: "ok";
  queues: {
    competitionStartsDue: number;
    incompleteSessionsDue: number;
    notificationsExhausted: number;
    notificationsLeased: number;
    notificationsPending: number;
    notificationsRetryScheduled: number;
    notificationsStaleLeases: number;
    privacyOperationsLeased: number;
    privacyOperationsPending: number;
    privacyOperationsRetryScheduled: number;
    privacyOperationsStaleLeases: number;
    profileMediaCleanupLeased: number;
    profileMediaCleanupPending: number;
    profileMediaCleanupRetryScheduled: number;
    profileMediaCleanupStaleLeases: number;
    socialInvitationsDue: number;
  };
  providers: {
    notifications: ProviderHealth;
    observability: ProviderHealth;
    privacy: ProviderHealth;
    profileMedia: ProviderHealth;
  };
  reviewQueues: Record<
    | "creatorSubmissions"
    | "partnerApplications"
    | "privacyRequests"
    | "profileMedia"
    | "regionVerifications"
    | "regionWaitlist"
    | "workoutSessions",
    number
  >;
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

export type PartnerGym = {
  accessLevel: "admin" | "staff";
  activeQrCredentials: GymLocation["activeQrCredentials"];
  address: string;
  id: string;
  name: string;
  radiusMeters: number;
  regionCode: string;
  regionPolicyId: string;
};

export type PartnerProposalStatus =
  "archived" | "draft" | "published" | "submitted" | "withdrawn";

export type PartnerCompetition = {
  competitionStatus: string;
  configurationVersion: number;
  endsAt: string;
  enrollmentCount: number;
  entrantCap: number | null;
  goalBrackets: GoalBracket[];
  gymLocationId: string;
  gymName: string;
  id: string;
  monthKey: string;
  name: string;
  proposalStatus: PartnerProposalStatus | null;
  proposalVersion: number | null;
  regionCode: string;
  regionName: string;
  regionPolicyId: string;
  registrationClosesAt: string;
  registrationOpensAt: string;
  startsAt: string;
};

export type PartnerCompetitionPage = {
  items: PartnerCompetition[];
  nextCursor: string | null;
};

export type PartnerVisitStatus =
  "completed" | "in_progress" | "incomplete" | "pending_review";

export type PartnerVisitSummary = {
  count: number;
  gymLocationId: string;
  gymName: string;
  status: PartnerVisitStatus;
};

export type PartnerVisitPage = {
  items: PartnerVisitSummary[];
  nextCursor: string | null;
};

export type PartnerRegion = {
  code: string;
  competitionEnabled: boolean;
  id: string;
  name: string;
  timezone: string;
};

export type GymQrCredentialHistory = {
  competitionId: string;
  competitionName: string;
  credentialVersion: number;
  expiresAt: string;
  gymLocationId: string;
  id: string;
  issuedAt: string;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
};

export type GymQrCredentialHistoryPage = {
  items: GymQrCredentialHistory[];
  nextCursor: string | null;
};

export type PartnerProposalActionResponse = {
  id: string;
  status: PartnerProposalStatus;
  version: number;
};

export type PartnerDashboardSnapshot = {
  competitions: PartnerCompetitionPage;
  generatedAt: string;
  gyms: PartnerGym[];
  operator: { email: string };
  overview: {
    activeVisitCount: number;
    assignedGymCount: number;
    draftProposalCount: number;
    submittedProposalCount: number;
  };
  regions: PartnerRegion[];
  visits: PartnerVisitPage;
};

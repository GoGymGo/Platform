"use client";

import type { User } from "firebase/auth";
import {
  workQueueKinds,
  type AuditEvent,
  type AuditPage,
  type Competition,
  type DashboardSnapshot,
  type GymQrCredentialHistoryPage,
  type GymQrCredential,
  type OperatorPortalAccess,
  type PartnerCompetition,
  type PartnerCompetitionPage,
  type PartnerDashboardSnapshot,
  type PartnerGym,
  type PartnerRegion,
  type PartnerVisitPage,
  type PartnerVisitSummary,
  type ProfileMediaReviewAction,
  type SystemHealth,
  type WorkQueueDetail,
  type WorkQueueItem,
  type WorkQueuePage,
} from "./admin-types";
import {
  FirebaseTokenUnavailableError,
  sendWithFirebaseTokenRecovery,
} from "./admin-auth-request.mjs";

export type HttpMethod = "DELETE" | "POST" | "PUT";

const partnerProposalStatuses = [
  "archived",
  "draft",
  "published",
  "submitted",
  "withdrawn",
] as const;
const partnerVisitStatuses = [
  "completed",
  "in_progress",
  "incomplete",
  "pending_review",
] as const;

export function decodeOperatorPortalAccess(
  value: unknown,
): OperatorPortalAccess {
  const access = requireRecord(value, "operator portal access");
  if (
    !isString(access.email) ||
    !["gogymgo", "partner"].includes(String(access.portal)) ||
    !Array.isArray(access.assignments)
  ) {
    throw invalidAdminResponse("operator portal access");
  }
  const assignments = access.assignments.map((value) => {
    const assignment = requireRecord(value, "operator gym assignment");
    if (
      !isString(assignment.gymLocationId) ||
      !["admin", "staff"].includes(String(assignment.accessLevel))
    ) {
      throw invalidAdminResponse("operator gym assignment");
    }
    return {
      accessLevel: assignment.accessLevel as "admin" | "staff",
      gymLocationId: assignment.gymLocationId,
    };
  });
  return {
    assignments,
    email: access.email,
    portal: access.portal as "gogymgo" | "partner",
  };
}

export function decodeDashboardProposalVisibility(
  value: unknown,
): DashboardSnapshot {
  const snapshot = requireRecord(value, "admin dashboard");
  if (!Array.isArray(snapshot.competitions)) {
    throw invalidAdminResponse("admin dashboard Contests");
  }
  for (const value of snapshot.competitions) {
    const competition = requireRecord(value, "admin dashboard Contest");
    const proposalStatus = competition.proposalStatus;
    const proposalVersion = competition.proposalVersion;
    if (
      (proposalStatus !== null &&
        !partnerProposalStatuses.includes(
          proposalStatus as (typeof partnerProposalStatuses)[number],
        )) ||
      !isNullablePositiveInteger(proposalVersion) ||
      (proposalStatus === null) !== (proposalVersion === null)
    ) {
      throw invalidAdminResponse("admin proposal visibility");
    }
  }
  return snapshot as DashboardSnapshot;
}

export function decodePartnerDashboardSnapshot(
  value: unknown,
): PartnerDashboardSnapshot {
  const snapshot = requireRecord(value, "partner dashboard");
  const operator = requireRecord(snapshot.operator, "partner identity");
  const overview = requireRecord(snapshot.overview, "partner overview");
  if (
    !isString(operator.email) ||
    !Array.isArray(snapshot.gyms) ||
    !Array.isArray(snapshot.regions) ||
    !isIsoDate(snapshot.generatedAt) ||
    ![
      overview.activeVisitCount,
      overview.assignedGymCount,
      overview.draftProposalCount,
      overview.submittedProposalCount,
    ].every(isNonnegativeInteger)
  ) {
    throw invalidAdminResponse("partner dashboard");
  }
  return {
    competitions: decodePartnerCompetitionPage(snapshot.competitions),
    generatedAt: snapshot.generatedAt,
    gyms: snapshot.gyms.map(decodePartnerGym),
    operator: { email: operator.email },
    overview: {
      activeVisitCount: overview.activeVisitCount as number,
      assignedGymCount: overview.assignedGymCount as number,
      draftProposalCount: overview.draftProposalCount as number,
      submittedProposalCount: overview.submittedProposalCount as number,
    },
    regions: snapshot.regions.map(decodePartnerRegion),
    visits: decodePartnerVisitPage(snapshot.visits),
  };
}

export function decodePartnerCompetitionPage(
  value: unknown,
): PartnerCompetitionPage {
  const page = requireRecord(value, "partner Contest page");
  if (!Array.isArray(page.items) || !isNullableString(page.nextCursor)) {
    throw invalidAdminResponse("partner Contest page");
  }
  return {
    items: page.items.map(decodePartnerCompetition),
    nextCursor: page.nextCursor,
  };
}

export function decodePartnerVisitPage(value: unknown): PartnerVisitPage {
  const page = requireRecord(value, "partner visit page");
  if (!Array.isArray(page.items) || !isNullableString(page.nextCursor)) {
    throw invalidAdminResponse("partner visit page");
  }
  return {
    items: page.items.map((item) => {
      const visit = requireRecord(item, "partner visit summary");
      if (
        !isString(visit.gymLocationId) ||
        !isString(visit.gymName) ||
        !partnerVisitStatuses.includes(
          visit.status as (typeof partnerVisitStatuses)[number],
        ) ||
        !isPositiveInteger(visit.count)
      ) {
        throw invalidAdminResponse("partner visit summary");
      }
      return {
        count: visit.count,
        gymLocationId: visit.gymLocationId,
        gymName: visit.gymName,
        status: visit.status,
      } as PartnerVisitSummary;
    }),
    nextCursor: page.nextCursor,
  };
}

export function decodeGymQrCredentialHistoryPage(
  value: unknown,
): GymQrCredentialHistoryPage {
  const page = requireRecord(value, "gym QR history page");
  if (!Array.isArray(page.items) || !isNullableString(page.nextCursor)) {
    throw invalidAdminResponse("gym QR history page");
  }
  return {
    items: page.items.map((item) => {
      const credential = requireRecord(item, "gym QR history item");
      if (
        "qrPayload" in credential ||
        "printablePosterSvg" in credential ||
        ![
          credential.competitionId,
          credential.competitionName,
          credential.gymLocationId,
          credential.id,
        ].every(isString) ||
        !isPositiveInteger(credential.credentialVersion) ||
        ![credential.expiresAt, credential.issuedAt].every(isIsoDate) ||
        !isNullableIsoDate(credential.revokedAt) ||
        !["active", "expired", "revoked"].includes(String(credential.status))
      ) {
        throw invalidAdminResponse("gym QR history item");
      }
      return {
        competitionId: credential.competitionId,
        competitionName: credential.competitionName,
        credentialVersion: credential.credentialVersion,
        expiresAt: credential.expiresAt,
        gymLocationId: credential.gymLocationId,
        id: credential.id,
        issuedAt: credential.issuedAt,
        revokedAt: credential.revokedAt,
        status: credential.status,
      } as GymQrCredentialHistoryPage["items"][number];
    }),
    nextCursor: page.nextCursor,
  };
}

export function decodeGymQrCredential(value: unknown): GymQrCredential | null {
  if (value === null) return null;
  const credential = requireRecord(value, "gym QR credential");
  if (
    ![
      credential.competitionId,
      credential.competitionName,
      credential.gymLocationId,
      credential.id,
      credential.printablePosterSvg,
      credential.qrPayload,
    ].every(isString) ||
    !isPositiveInteger(credential.credentialVersion) ||
    ![credential.expiresAt, credential.issuedAt].every(isIsoDate) ||
    !(credential.qrPayload as string).startsWith(
      "https://app.gogymgo.com/scan?credential=",
    ) ||
    !(credential.printablePosterSvg as string).startsWith("<svg")
  ) {
    throw invalidAdminResponse("gym QR credential");
  }
  return {
    competitionId: credential.competitionId,
    competitionName: credential.competitionName,
    credentialVersion: credential.credentialVersion,
    expiresAt: credential.expiresAt,
    gymLocationId: credential.gymLocationId,
    id: credential.id,
    issuedAt: credential.issuedAt,
    printablePosterSvg: credential.printablePosterSvg,
    qrPayload: credential.qrPayload,
  } as GymQrCredential;
}

function decodePartnerGym(value: unknown): PartnerGym {
  const gym = requireRecord(value, "partner gym");
  if (
    ![gym.address, gym.id, gym.name, gym.regionCode, gym.regionPolicyId].every(
      isString,
    ) ||
    !["admin", "staff"].includes(String(gym.accessLevel)) ||
    !isPositiveInteger(gym.radiusMeters) ||
    !Array.isArray(gym.activeQrCredentials)
  ) {
    throw invalidAdminResponse("partner gym");
  }
  return {
    accessLevel: gym.accessLevel as "admin" | "staff",
    activeQrCredentials: gym.activeQrCredentials.map((value) => {
      const credential = requireRecord(value, "active gym QR credential");
      if (
        !isString(credential.competitionId) ||
        !isPositiveInteger(credential.credentialVersion) ||
        !isIsoDate(credential.expiresAt)
      ) {
        throw invalidAdminResponse("active gym QR credential");
      }
      return {
        competitionId: credential.competitionId,
        credentialVersion: credential.credentialVersion,
        expiresAt: credential.expiresAt,
      };
    }),
    address: gym.address as string,
    id: gym.id as string,
    name: gym.name as string,
    radiusMeters: gym.radiusMeters,
    regionCode: gym.regionCode as string,
    regionPolicyId: gym.regionPolicyId as string,
  };
}

function decodePartnerRegion(value: unknown): PartnerRegion {
  const region = requireRecord(value, "partner region");
  if (
    ![region.code, region.id, region.name, region.timezone].every(isString) ||
    typeof region.competitionEnabled !== "boolean"
  ) {
    throw invalidAdminResponse("partner region");
  }
  return {
    code: region.code as string,
    competitionEnabled: region.competitionEnabled,
    id: region.id as string,
    name: region.name as string,
    timezone: region.timezone as string,
  };
}

function decodePartnerCompetition(value: unknown): PartnerCompetition {
  const competition = requireRecord(value, "partner Contest");
  if (
    ![
      competition.competitionStatus,
      competition.gymLocationId,
      competition.gymName,
      competition.id,
      competition.monthKey,
      competition.name,
      competition.regionCode,
      competition.regionName,
      competition.regionPolicyId,
    ].every(isString) ||
    ![
      competition.endsAt,
      competition.registrationClosesAt,
      competition.registrationOpensAt,
      competition.startsAt,
    ].every(isIsoDate) ||
    !isPositiveInteger(competition.configurationVersion) ||
    !isNullablePositiveInteger(competition.proposalVersion) ||
    !isNullableNonnegativeNumber(competition.entrantCap) ||
    !isNonnegativeInteger(competition.enrollmentCount) ||
    !Array.isArray(competition.goalBrackets) ||
    !competition.goalBrackets.every((value) => {
      const bracket = isRecord(value) ? value : null;
      return (
        bracket !== null &&
        isPositiveInteger(bracket.goalDays) &&
        isString(bracket.label)
      );
    }) ||
    (competition.proposalStatus !== null &&
      !partnerProposalStatuses.includes(
        competition.proposalStatus as (typeof partnerProposalStatuses)[number],
      ))
  ) {
    throw invalidAdminResponse("partner Contest");
  }
  return {
    competitionStatus: competition.competitionStatus,
    configurationVersion: competition.configurationVersion,
    endsAt: competition.endsAt,
    enrollmentCount: competition.enrollmentCount,
    entrantCap: competition.entrantCap,
    goalBrackets:
      competition.goalBrackets as PartnerCompetition["goalBrackets"],
    gymLocationId: competition.gymLocationId,
    gymName: competition.gymName,
    id: competition.id,
    monthKey: competition.monthKey,
    name: competition.name,
    proposalStatus: competition.proposalStatus,
    proposalVersion: competition.proposalVersion,
    regionCode: competition.regionCode,
    regionName: competition.regionName,
    regionPolicyId: competition.regionPolicyId,
    registrationClosesAt: competition.registrationClosesAt,
    registrationOpensAt: competition.registrationOpensAt,
    startsAt: competition.startsAt,
  } as PartnerCompetition;
}

export function isOperationalCompetition(competition: Competition) {
  return ["draft", "registration", "active"].includes(competition.status);
}

export function isRewardConfigurableCompetition(competition: Competition) {
  return ["draft", "registration"].includes(competition.status);
}

export function getQueueUrgency(item: WorkQueueItem) {
  const normalized = `${item.kind} ${item.status}`.toLowerCase();
  if (
    normalized.includes("failed") ||
    normalized.includes("retry") ||
    normalized.includes("stale")
  ) {
    return { label: "ATTENTION", tone: "urgent" } as const;
  }
  if (!item.decisionAllowed || normalized.includes("stuck")) {
    return { label: "BLOCKED", tone: "warning" } as const;
  }
  return { label: "WAITING", tone: "routine" } as const;
}

export function decodeWorkQueuePage(value: unknown): WorkQueuePage {
  const page = requireRecord(value, "work queue page");
  if (!Array.isArray(page.items) || !isNullableString(page.nextCursor)) {
    throw invalidAdminResponse("work queue page");
  }
  return {
    items: page.items.map((item) => decodeWorkQueueItem(item)),
    nextCursor: page.nextCursor,
  };
}

export function decodeWorkQueueDetail(value: unknown): WorkQueueDetail {
  const detail = requireRecord(value, "work queue detail");
  const item = decodeWorkQueueItem(detail);
  const allowedDecisionValues = allowedReviewDecisions[item.kind];
  if (
    !Array.isArray(detail.allowedDecisions) ||
    !detail.allowedDecisions.every(
      (decision) =>
        isString(decision) && allowedDecisionValues.includes(decision),
    ) ||
    new Set(detail.allowedDecisions).size !== detail.allowedDecisions.length ||
    (!item.decisionAllowed && detail.allowedDecisions.length > 0) ||
    !Array.isArray(detail.facts)
  ) {
    throw invalidAdminResponse("work queue detail");
  }
  const facts = detail.facts.map((fact) => {
    const entry = requireRecord(fact, "review fact");
    if (!isString(entry.label) || !isString(entry.value)) {
      throw invalidAdminResponse("review fact");
    }
    return { label: entry.label, value: entry.value };
  });
  const allowedLabels = allowedReviewFactLabels[item.kind];
  if (
    facts.length > allowedLabels.length ||
    facts.some((fact) => !allowedLabels.includes(fact.label))
  ) {
    throw invalidAdminResponse("review facts");
  }
  const sessionEvidence =
    detail.sessionEvidence === undefined
      ? undefined
      : decodeSessionEvidence(detail.sessionEvidence);
  if ((item.kind === "workout_session") !== Boolean(sessionEvidence)) {
    throw invalidAdminResponse("session evidence boundary");
  }
  return {
    ...item,
    allowedDecisions: detail.allowedDecisions,
    facts,
    ...(sessionEvidence ? { sessionEvidence } : {}),
  };
}

function decodeSessionEvidence(
  value: unknown,
): NonNullable<WorkQueueDetail["sessionEvidence"]> {
  const review = requireRecord(value, "session evidence");
  const evidence = requireRecord(review.evidence, "session evidence groups");
  const evidenceKeys = [
    "deviceAttestation",
    "gymQr",
    "heartRate",
    "presenceCheck",
  ] as const;
  if (
    !evidenceKeys.every((key) => {
      const group = evidence[key];
      return (
        isRecord(group) &&
        isNonnegativeNumber(group.count) &&
        isNonnegativeNumber(group.minimumRequiredCount) &&
        typeof group.required === "boolean"
      );
    }) ||
    ![
      review.competitionId,
      review.eligibleDate,
      review.policyVersion,
      review.sessionId,
      review.status,
    ].every(isString) ||
    ![review.completedAt, review.startedAt].every(isIsoDate) ||
    !isNonnegativeNumber(review.durationMinutes) ||
    !isNonnegativeNumber(review.minimumDurationMinutes) ||
    !isString(review.evidenceSnapshotSha256) ||
    !/^[a-f0-9]{64}$/i.test(review.evidenceSnapshotSha256) ||
    !Array.isArray(review.limitations) ||
    !review.limitations.every(isString)
  ) {
    throw invalidAdminResponse("session evidence");
  }
  return review as NonNullable<WorkQueueDetail["sessionEvidence"]>;
}

export function decodeAuditPage(value: unknown): AuditPage {
  const page = requireRecord(value, "audit page");
  if (!Array.isArray(page.items) || !isNullableString(page.nextCursor)) {
    throw invalidAdminResponse("audit page");
  }
  return {
    items: page.items.map((item) => {
      const event = requireRecord(item, "audit event");
      if (
        ![
          event.action,
          event.createdAt,
          event.entityId,
          event.entityType,
          event.id,
          event.reason,
        ].every(isString) ||
        !isNullableString(event.actorEmail) ||
        !isSafeAuditState(event.before) ||
        !isSafeAuditState(event.after)
      ) {
        throw invalidAdminResponse("audit event");
      }
      return event as AuditEvent;
    }),
    nextCursor: page.nextCursor,
  };
}

export function decodeSystemHealth(value: unknown): SystemHealth {
  const health = requireRecord(value, "system health");
  const queues = requireRecord(health.queues, "system health queues");
  const reviewQueues = requireRecord(
    health.reviewQueues,
    "review queue depths",
  );
  const worker = requireRecord(health.worker, "worker health");
  const providers = requireRecord(health.providers, "provider health");
  const queueKeys = [
    "competitionStartsDue",
    "incompleteSessionsDue",
    "notificationsExhausted",
    "notificationsLeased",
    "notificationsPending",
    "notificationsRetryScheduled",
    "privacyOperationsLeased",
    "privacyOperationsPending",
    "privacyOperationsRetryScheduled",
    "privacyOperationsStaleLeases",
    "profileMediaCleanupLeased",
    "profileMediaCleanupPending",
    "profileMediaCleanupRetryScheduled",
    "profileMediaCleanupStaleLeases",
    "socialInvitationsDue",
  ];
  const reviewKeys = [
    "creatorSubmissions",
    "partnerApplications",
    "privacyRequests",
    "profileMedia",
    "regionVerifications",
    "regionWaitlist",
    "workoutSessions",
  ];
  const providerKeys = [
    "notifications",
    "observability",
    "privacy",
    "profileMedia",
  ];
  const providersValid = providerKeys.every((key) => {
    const provider = providers[key];
    return (
      isRecord(provider) &&
      isString(provider.evidence) &&
      ["configured", "disabled", "unavailable", "unconfigured"].includes(
        String(provider.status),
      )
    );
  });
  if (
    health.database !== "ok" ||
    !isIsoDate(health.checkedAt) ||
    !queueKeys.every((key) => isNonnegativeNumber(queues[key])) ||
    !reviewKeys.every((key) => isNonnegativeNumber(reviewQueues[key])) ||
    !providersValid ||
    !["degraded", "healthy", "stale", "starting"].includes(
      String(worker.status),
    ) ||
    !isNullableNumber(worker.heartbeatAgeSeconds) ||
    ![worker.lastCompletedAt, worker.lastFailedAt].every(isNullableIsoDate) ||
    !isNullableString(worker.lastFailureCode)
  ) {
    throw invalidAdminResponse("system health");
  }
  return health as SystemHealth;
}

export function decodeProfileMediaReviewAction(
  value: unknown,
): ProfileMediaReviewAction {
  const action = requireRecord(value, "profile media review action");
  if (
    !isString(action.id) ||
    !isString(action.contentType) ||
    !isNonnegativeNumber(action.contentLength) ||
    !isIsoDate(action.submittedAt) ||
    !isIsoDate(action.expiresAt) ||
    !isString(action.url) ||
    !/^https?:\/\//.test(action.url) ||
    !isPositiveInteger(action.reviewVersion)
  ) {
    throw invalidAdminResponse("profile media review action");
  }
  return action as ProfileMediaReviewAction;
}

function decodeWorkQueueItem(value: unknown): WorkQueueItem {
  const item = requireRecord(value, "work queue item");
  if (
    !isString(item.id) ||
    !workQueueKinds.includes(item.kind as WorkQueueItem["kind"]) ||
    !isString(item.status) ||
    !isIsoDate(item.createdAt) ||
    typeof item.decisionAllowed !== "boolean" ||
    !isPositiveInteger(item.reviewVersion) ||
    !isOptionalString(item.failureCode) ||
    !isOptionalIsoDate(item.nextAttemptAt) ||
    !isOptionalString(item.regionCode) ||
    !isOptionalString(item.verificationMethod) ||
    (item.requestType !== undefined &&
      !["delete", "export"].includes(String(item.requestType))) ||
    (item.decisionRestrictionCode !== undefined &&
      !["self_review", "stale_policy", "unsupported_method"].includes(
        String(item.decisionRestrictionCode),
      ))
  ) {
    throw invalidAdminResponse("work queue item");
  }
  return item as WorkQueueItem;
}

const allowedReviewFactLabels: Record<WorkQueueItem["kind"], string[]> = {
  creator_submission: [
    "Duration",
    "Workout style",
    "Region",
    "Rights version",
    "Rights accepted",
    "Synthetic media disclosed",
  ],
  partner_application: ["Application type", "Region", "Contact email"],
  privacy_request: [
    "Request type",
    "Attempts",
    "Processing started",
    "Lease expires",
    "Next attempt",
  ],
  profile_media: ["Content type", "Content length", "Submitted"],
  region_verification: ["Region", "Method", "Policy", "Boundary"],
  region_waitlist: [
    "Email",
    "Requested region",
    "Source",
    "Country",
    "Subdivision",
    "Consented",
    "Consent notice",
  ],
  workout_session: ["Competition", "Eligible date", "Duration", "Policy"],
};

const allowedReviewDecisions: Record<WorkQueueItem["kind"], string[]> = {
  creator_submission: ["approved", "in_review", "rejected"],
  partner_application: ["approved", "in_review", "rejected"],
  privacy_request: ["processing", "rejected"],
  profile_media: ["approved", "rejected"],
  region_verification: ["approved", "rejected"],
  region_waitlist: ["contacted", "launched", "closed"],
  workout_session: ["verified", "rejected"],
};

function isSafeAuditState(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) {
    return value.length <= 20 && value.every(isSafeAuditValue);
  }
  if (!isRecord(value) || Object.keys(value).length > 16) return false;
  const sensitiveKey =
    /user.?id|email|token|secret|password|credential|payload|content|metadata|object|url|address|coordinates?|latitude|longitude|notes?|message/i;
  return Object.entries(value).every(
    ([key, entry]) => !sensitiveKey.test(key) && isSafeAuditValue(entry),
  );
}

function isSafeAuditValue(value: unknown): boolean {
  if (value === undefined) return false;
  return (
    value === null ||
    (typeof value === "string" && value.length <= 256) ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean" ||
    isSafeAuditState(value)
  );
}

function invalidAdminResponse(label: string): AdminUserFacingError {
  return new AdminUserFacingError(
    `The server returned an invalid ${label}. Refresh before taking action.`,
  );
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw invalidAdminResponse(label);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isOptionalIsoDate(value: unknown): boolean {
  return value === undefined || isIsoDate(value);
}

function isNullableIsoDate(value: unknown): boolean {
  return value === null || isIsoDate(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNonnegativeNumber(value);
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return isNonnegativeNumber(value) && Number.isInteger(value);
}

function isNullableNonnegativeNumber(value: unknown): value is number | null {
  return value === null || isNonnegativeNumber(value);
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isIsoDate(value: unknown): value is string {
  return (
    isString(value) &&
    !Number.isNaN(new Date(value).getTime()) &&
    new Date(value).toISOString() === value
  );
}

export function formatQueueAge(value: string) {
  const ageMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (ageMinutes < 60) return `${ageMinutes}m`;
  const ageHours = Math.round(ageMinutes / 60);
  if (ageHours < 48) return `${ageHours}h`;
  return `${Math.round(ageHours / 24)}d`;
}

export function getAuditChange(event: AuditEvent) {
  return {
    after:
      summarizeAuditState(event.after) ||
      "No resulting state recorded by server",
    before:
      summarizeAuditState(event.before) ||
      "No previous state recorded by server",
  };
}

function summarizeAuditState(value?: Record<string, unknown> | null) {
  if (!value) return "";
  return Object.entries(value)
    .slice(0, 3)
    .map(([key, entry]) => `${key}: ${String(entry)}`)
    .join(" · ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Vancouver",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Vancouver",
    year: "numeric",
  }).format(new Date(value));
}

export class AdminUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserFacingError";
  }
}

export function errorMessage(error: unknown) {
  return error instanceof AdminUserFacingError
    ? error.message
    : "The request could not be completed. Try again.";
}

export function adminRequestStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? Number(error.status)
    : 0;
}

export function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("invalid-credential"))
    return "The email or password is incorrect.";
  if (code.includes("too-many-requests"))
    return "Too many sign-in attempts were made. Wait a moment and try again.";
  if (code.includes("network-request-failed"))
    return "Sign-in could not reach Firebase. Check your connection and try again.";
  return "Sign-in could not be completed. Check your connection and try again.";
}

class AdminRequestError extends AdminUserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "AdminRequestError";
  }
}

function adminRequestErrorMessage(
  status: number,
  apiError?: { code?: string; message?: string },
) {
  if (status === 401) return "Your admin session expired. Sign in again.";
  if (status === 403)
    return "Your account does not have permission to complete this action.";
  if (status === 404)
    return "This record is no longer available. Refresh the dashboard and try again.";
  if (status === 409) {
    const conflictMessage = apiError?.message?.trim();
    return conflictMessage
      ? conflictMessage
      : "This action conflicts with the latest record. Refresh the dashboard and review it before trying again.";
  }
  if (status === 400 || status === 422)
    return "The request could not be completed. Review the form and try again.";
  if (status === 429)
    return "Too many requests were submitted. Wait a moment and try again.";
  if (status >= 500)
    return "The GoGymGo admin service is temporarily unavailable. Try again shortly.";
  return "The request could not be completed. Try again.";
}

export function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIso(form: FormData, name: string) {
  const value = String(form.get(name) ?? "");
  if (!value) throw new AdminUserFacingError(`${name} is required.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminUserFacingError(`Enter a valid ${name}.`);
  }
  return date.toISOString();
}

export function optionalIso(value: FormDataEntryValue | null) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new AdminUserFacingError("Enter a valid date and time.");
  }
  return date.toISOString();
}

export function optionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

export function optionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? Number(normalized) : undefined;
}

export function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

export function defaultCompetitionDates() {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 7),
  );
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 7),
  );
  return {
    endsAt: end.toISOString(),
    monthKey: start.toISOString().slice(0, 7),
    registrationOpensAt: now.toISOString(),
    startsAt: start.toISOString(),
  };
}

export async function adminRequest<T>(
  activeUser: User,
  path: string,
  options: {
    body?: unknown;
    expectedStatuses?: number[];
    idempotencyKey?: string;
    method?: HttpMethod;
  } = {},
): Promise<T> {
  const mutationFingerprint = options.method
    ? `${options.method}:${path}:${JSON.stringify(options.body ?? null)}`
    : null;
  const idempotencyKey = mutationFingerprint
    ? (options.idempotencyKey ?? pendingAdminMutationKey(mutationFingerprint))
    : null;

  let response: Response;
  try {
    response = await sendWithFirebaseTokenRecovery(
      activeUser,
      (token: string) =>
        fetch(`/api/gogymgo/${path}`, {
          body: options.body ? JSON.stringify(options.body) : undefined,
          cache: "no-store",
          headers: {
            authorization: `Bearer ${token}`,
            ...(options.body ? { "content-type": "application/json" } : {}),
            ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
          },
          method: options.method ?? "GET",
        }),
    );
  } catch (error) {
    if (error instanceof FirebaseTokenUnavailableError) {
      const sessionError = new AdminRequestError(
        "Your admin session expired. Sign out and sign in again.",
      );
      Object.assign(sessionError, {
        code: "ADMIN_SESSION_EXPIRED",
        status: 401,
      });
      throw sessionError;
    }
    throw new AdminRequestError(
      "The GoGymGo admin service could not be reached. Check your connection and try again.",
    );
  }
  const payload = (await response.json().catch(() => null)) as
    { error?: { code?: string; message?: string } } | T | null;
  if (!response.ok) {
    const apiError =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (
            payload as {
              error?: { code?: string; message?: string };
            }
          ).error
        : undefined;
    if (!options.expectedStatuses?.includes(response.status)) {
      console.error("GoGymGo admin request failed", {
        code: apiError?.code,
        path,
        status: response.status,
      });
    }
    const error = new AdminRequestError(
      adminRequestErrorMessage(response.status, apiError),
    );
    if (
      mutationFingerprint &&
      response.status < 500 &&
      apiError?.code !== "IDEMPOTENCY_REQUEST_IN_PROGRESS"
    ) {
      clearPendingAdminMutationKey(mutationFingerprint);
    }
    Object.assign(error, {
      code: apiError?.code,
      status: response.status,
    });
    throw error;
  }
  if (mutationFingerprint) {
    clearPendingAdminMutationKey(mutationFingerprint);
  }
  return payload as T;
}

export function clearAdminRequestSession(): void {
  try {
    sessionStorage.removeItem(pendingAdminMutationsStorageKey);
  } catch {
    // Firebase sign-out is still authoritative when browser storage is blocked.
  }
}

const pendingAdminMutationsStorageKey =
  "gogymgo.admin.pending-idempotency-keys.v1";

function pendingAdminMutationKey(fingerprint: string) {
  try {
    const pending = readPendingAdminMutationKeys();
    const existing = pending[fingerprint];
    if (existing) return existing;
    const created = `admin-${crypto.randomUUID()}`;
    sessionStorage.setItem(
      pendingAdminMutationsStorageKey,
      JSON.stringify({ ...pending, [fingerprint]: created }),
    );
    return created;
  } catch {
    return `admin-${crypto.randomUUID()}`;
  }
}

function clearPendingAdminMutationKey(fingerprint: string) {
  try {
    const pending = readPendingAdminMutationKeys();
    delete pending[fingerprint];
    if (Object.keys(pending).length === 0) {
      sessionStorage.removeItem(pendingAdminMutationsStorageKey);
    } else {
      sessionStorage.setItem(
        pendingAdminMutationsStorageKey,
        JSON.stringify(pending),
      );
    }
  } catch {
    // Storage availability never changes the authoritative API result.
  }
}

function readPendingAdminMutationKeys(): Record<string, string> {
  const raw = sessionStorage.getItem(pendingAdminMutationsStorageKey);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].startsWith("admin-"),
    ),
  );
}

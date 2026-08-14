import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAccountReadinessRepository } from "@/data/accountReadinessRepository";
import { createAppDataSource } from "@/data/appData";
import { createGymScanRepository } from "@/data/gymScanRepository";
import { createWorkoutSessionRepository } from "@/data/sessionRepository";
import {
  hasAuthFormErrors,
  normalizeEmail,
  validateSignInForm,
  validateSignUpForm,
} from "@/domain/auth";
import type { CurrentLegalDocuments } from "@/domain/accountReadiness";
import type { ApiClient, ApiRequestOptions } from "@/services/api/client";

const competitionId = "40000000-0000-4000-8000-000000000001";
const enrollmentId = "50000000-0000-4000-8000-000000000001";
const sessionId = "60000000-0000-4000-8000-000000000001";
const awardId = "70000000-0000-4000-8000-000000000001";
const gymCredential = "partner-gym-credential-000000000001";

const legalBundle: CurrentLegalDocuments = {
  bundleSha256: "c".repeat(64),
  configured: true,
  documents: [
    {
      content: { intro: "Terms", sections: [{ heading: "Rules" }] },
      contentSha256: "a".repeat(64),
      documentKey: "terms_of_service",
      effectiveAt: "2026-08-01T00:00:00.000Z",
      id: "10000000-0000-4000-8000-000000000001",
      jurisdictionCode: "CA-BC",
      locale: "en",
      receiptRequirement: "accept",
      title: "TERMS OF SERVICE",
      version: "2026-08-01",
    },
  ],
  jurisdictionCode: "CA-BC",
  locale: "en",
};

type RecordedRequest = {
  authenticated?: boolean;
  body?: unknown;
  idempotencyKey?: string;
  method: string;
  path: string;
};

describe("critical member product journeys", () => {
  it("keeps registration through reward claim on authoritative contracts", async () => {
    const requests: RecordedRequest[] = [];
    const api = createJourneyApi(requests);

    assert.equal(
      hasAuthFormErrors(
        validateSignUpForm(
          "  Athlete@Example.COM ",
          "training123",
          "training123",
        ),
      ),
      false,
    );
    assert.equal(
      hasAuthFormErrors(
        validateSignInForm("  Athlete@Example.COM ", "training123"),
      ),
      false,
    );
    assert.equal(
      normalizeEmail("  Athlete@Example.COM "),
      "athlete@example.com",
    );

    const account = createAccountReadinessRepository("api", api);
    const sessions = createWorkoutSessionRepository("api", api);
    const appData = createAppDataSource("api", api);

    const documents = await account.getCurrentLegalDocuments("CA-BC", "en");
    const receipt = await account.recordLegalReceipt(documents);
    const region = await account.createRegionVerification({
      accuracyMeters: 8,
      latitude: 49.2827,
      longitude: -123.1207,
      method: "device_location",
      observedAt: new Date().toISOString(),
    });
    const competition = await account.resolveCompetitionByGymQr(gymCredential);
    assert.equal(competition?.id, competitionId);

    const enrollment = await account.enrollInCompetition(competition!.id, {
      ageEligibilityAttested: true,
      goalDays: 4,
      gymPresence: {
        accuracyMeters: 8,
        credential: gymCredential,
        latitude: 49.2827,
        longitude: -123.1207,
      },
      legalReceiptBundleId: receipt.receiptBundleId!,
      regionVerificationId: region.id,
      rulesAccepted: true,
    });
    assert.equal(enrollment.id, enrollmentId);

    const started = await sessions.createSession(
      competition.id,
      "critical-journey-attempt",
    );
    await sessions.appendHeartRateSample(
      started.id,
      132,
      "2026-08-12T13:01:00.000Z",
    );
    await sessions.appendGymQrScan(started.id, gymCredential);
    await sessions.appendPresenceCheck(started.id, "2026-08-12T13:15:00.000Z");
    const completed = await sessions.completeSession(
      started.id,
      "2026-08-12T13:30:00.000Z",
    );
    const progress = await sessions.getCompetitionProgress();
    const results = await appData.getMyLatestCompetitionResults();
    const awards = await appData.getMyRewardAwards();
    const claimed = await appData.claimReward(
      awards[0].id,
      "critical-journey-reward-claim",
    );

    assert.equal(completed.eligibleForReview, true);
    assert.equal(progress?.verifiedDays, 1);
    assert.equal(results?.resultsStatus, "settled");
    assert.equal(results?.rewardCount, 1);
    assert.equal(claimed.status, "claimed");

    assert.deepEqual(
      requests.map(({ method, path }) => ({ method, path })),
      [
        {
          method: "GET",
          path: "/v1/legal-documents/current?jurisdictionCode=CA-BC&locale=en",
        },
        { method: "POST", path: "/v1/me/legal-receipts" },
        { method: "POST", path: "/v1/me/region-verifications" },
        { method: "POST", path: "/v1/competitions/resolve-gym-qr" },
        {
          method: "POST",
          path: `/v1/competitions/${competitionId}/enrollments`,
        },
        { method: "POST", path: "/v1/sessions" },
        { method: "POST", path: `/v1/sessions/${sessionId}/events` },
        { method: "POST", path: `/v1/sessions/${sessionId}/events` },
        { method: "POST", path: `/v1/sessions/${sessionId}/events` },
        { method: "POST", path: `/v1/sessions/${sessionId}/complete` },
        { method: "GET", path: "/v1/me/progress" },
        { method: "GET", path: "/v1/results/mine/latest" },
        { method: "GET", path: "/v1/rewards/awards/me" },
        { method: "POST", path: `/v1/rewards/awards/${awardId}/claim` },
      ],
    );
    assert.equal(requests[0].authenticated, false);
    assert.equal(
      requests.slice(1).some(({ authenticated }) => authenticated === false),
      false,
    );
    assert.equal(
      requests.find(({ path }) => path === "/v1/sessions")?.idempotencyKey,
      "session-create-critical-journey-attempt",
    );
    assert.equal(
      requests.at(-1)?.idempotencyKey,
      "critical-journey-reward-claim",
    );
  });

  it("starts and verifies the static QR pilot with distinct idempotent events", async () => {
    const requests: RecordedRequest[] = [];
    let scanNumber = 0;
    const api: ApiClient = {
      request: async <TResponse, TBody = never>(
        path: string,
        options?: ApiRequestOptions<TBody>,
      ) => {
        requests.push(recordRequest(path, options));
        scanNumber += 1;
        return {
          credentialVersion: 1,
          expiresAt: null,
          gymLocationId: "80000000-0000-4000-8000-000000000001",
          gymName: "Partner Gym",
          minimumCompleteAt: "2026-08-12T13:30:00.000Z",
          outcome: scanNumber === 1 ? "started" : "verified",
          rejectionReason: null,
          remainingSeconds: scanNumber === 1 ? 1800 : 0,
          serverTimestamp:
            scanNumber === 1
              ? "2026-08-12T13:00:00.000Z"
              : "2026-08-12T13:31:00.000Z",
          sessionId,
          startedAt: "2026-08-12T13:00:00.000Z",
        } as TResponse;
      },
    };
    const scans = createGymScanRepository(api);

    const started = await scans.scan({
      accuracyMeters: 8,
      credential: gymCredential,
      eventId: "90000000-0000-4000-8000-000000000001",
      latitude: 49.2827,
      longitude: -123.1207,
    });
    const verified = await scans.scan({
      accuracyMeters: 8,
      competitionId,
      eventId: "90000000-0000-4000-8000-000000000002",
      latitude: 49.2827,
      longitude: -123.1207,
    });

    assert.equal(started.outcome, "started");
    assert.equal(verified.outcome, "verified");
    assert.deepEqual(
      requests.map(({ idempotencyKey, method, path }) => ({
        idempotencyKey,
        method,
        path,
      })),
      [
        {
          idempotencyKey: "gym-scan-90000000-0000-4000-8000-000000000001",
          method: "POST",
          path: "/v1/gym-scans",
        },
        {
          idempotencyKey: "gym-scan-90000000-0000-4000-8000-000000000002",
          method: "POST",
          path: "/v1/gym-scans",
        },
      ],
    );
  });

  it("closes a cancelled static QR workout through the authoritative session contract", async () => {
    const requests: RecordedRequest[] = [];
    const api: ApiClient = {
      request: async <TResponse, TBody = never>(
        path: string,
        options?: ApiRequestOptions<TBody>,
      ) => {
        requests.push(recordRequest(path, options));
        if (path === "/v1/gym-scans") {
          return {
            credentialVersion: 1,
            expiresAt: "2026-08-12T17:00:00.000Z",
            gymLocationId: "80000000-0000-4000-8000-000000000001",
            gymName: "Partner Gym",
            minimumCompleteAt: "2026-08-12T13:30:00.000Z",
            outcome: "started",
            rejectionReason: null,
            remainingSeconds: 1800,
            serverTimestamp: "2026-08-12T13:00:00.000Z",
            sessionId,
            startedAt: "2026-08-12T13:00:00.000Z",
          } as TResponse;
        }
        if (path === `/v1/sessions/${sessionId}/cancel`) {
          return {
            completedAt: "2026-08-12T13:05:00.000Z",
            competitionId,
            eligibleDate: "2026-08-12",
            id: sessionId,
            policyVersion: "rules-v1",
            startedAt: "2026-08-12T13:00:00.000Z",
            status: "cancelled",
          } as TResponse;
        }
        throw new Error(`Unexpected cancellation request: ${path}`);
      },
    };
    const scans = createGymScanRepository(api);
    const sessions = createWorkoutSessionRepository("api", api);

    const started = await scans.scan({
      accuracyMeters: 8,
      credential: gymCredential,
      eventId: "90000000-0000-4000-8000-000000000003",
      latitude: 49.2827,
      longitude: -123.1207,
    });
    const cancelled = await sessions.cancelSession(started.sessionId!);

    assert.equal(cancelled.status, "cancelled");
    assert.deepEqual(
      requests.map(({ idempotencyKey, method, path }) => ({
        idempotencyKey,
        method,
        path,
      })),
      [
        {
          idempotencyKey: "gym-scan-90000000-0000-4000-8000-000000000003",
          method: "POST",
          path: "/v1/gym-scans",
        },
        {
          idempotencyKey: `session-cancel-${sessionId}`,
          method: "POST",
          path: `/v1/sessions/${sessionId}/cancel`,
        },
      ],
    );
  });
});

function createJourneyApi(requests: RecordedRequest[]): ApiClient {
  return {
    request: async <TResponse, TBody = never>(
      path: string,
      options?: ApiRequestOptions<TBody>,
    ) => {
      requests.push(recordRequest(path, options));

      const response = journeyResponse(path, options?.method ?? "GET");
      return response as TResponse;
    },
  };
}

function recordRequest<TBody>(
  path: string,
  options?: ApiRequestOptions<TBody>,
): RecordedRequest {
  return {
    authenticated: options?.authenticated,
    body: options?.body,
    idempotencyKey: options?.idempotencyKey,
    method: options?.method ?? "GET",
    path,
  };
}

function journeyResponse(path: string, method: string): unknown {
  if (path.startsWith("/v1/legal-documents/current?")) return legalBundle;
  if (path === "/v1/me/legal-receipts") {
    return {
      ...legalBundle,
      acceptedAt: "2026-08-12T12:45:00.000Z",
      complete: true,
      receiptBundleId: "20000000-0000-4000-8000-000000000001",
    };
  }
  if (path === "/v1/me/region-verifications") {
    return {
      createdAt: "2026-08-12T12:46:00.000Z",
      expiresAt: "2026-09-12T12:46:00.000Z",
      id: "30000000-0000-4000-8000-000000000001",
      jurisdictionCode: "CA-BC",
      method: "device_location",
      policyVersion: "vancouver-policy-v1",
      regionCode: "vancouver-bc",
      regionName: "Vancouver",
      regionPolicyId: "30000000-0000-4000-8000-000000000002",
      reviewedAt: "2026-08-12T12:46:00.000Z",
      status: "approved",
      timezone: "America/Vancouver",
    };
  }
  if (path === "/v1/competitions/resolve-gym-qr") {
    return {
      endsAt: "2026-09-01T07:00:00.000Z",
      entrantCap: null,
      goalDays: [3, 4, 5],
      id: competitionId,
      minimumEntrants: 1,
      monthKey: "2026-08",
      name: "August Challenge",
      regionCode: "vancouver-bc",
      regionName: "Vancouver",
      registrationClosesAt: "2026-08-31T07:00:00.000Z",
      registrationOpensAt: "2026-07-01T07:00:00.000Z",
      rulesVersion: "rules-v1",
      serverTime: "2026-08-12T12:46:00.000Z",
      startsAt: "2026-08-01T07:00:00.000Z",
      status: "active",
    };
  }
  if (path.endsWith("enrollments")) {
    return {
      competitionId,
      enrolledAt: "2026-08-12T12:47:00.000Z",
      goalDays: 4,
      id: enrollmentId,
      status: "active",
    };
  }
  if (path === "/v1/sessions" && method === "POST") {
    return {
      completedAt: null,
      competitionId,
      eligibleDate: "2026-08-12",
      id: sessionId,
      policyVersion: "rules-v1",
      requirements: {
        minHeartRateSamples: 1,
        minSessionMinutes: 30,
        requireDeviceAttestation: false,
        requireGymQr: true,
        requirePresenceCheck: true,
      },
      startedAt: "2026-08-12T13:00:00.000Z",
      status: "active",
    };
  }
  if (path.endsWith("events")) return {};
  if (path.endsWith("complete")) {
    return {
      completedAt: "2026-08-12T13:30:00.000Z",
      competitionId,
      eligibleDate: "2026-08-12",
      eligibleForReview: true,
      id: sessionId,
      policyVersion: "rules-v1",
      startedAt: "2026-08-12T13:00:00.000Z",
      status: "verified",
      violations: [],
    };
  }
  if (path === "/v1/me/progress") {
    return {
      categoryScore: 1,
      competitionId,
      enrolledDateKey: "2026-08-12",
      goalDays: 4,
      monthKey: "2026-08",
      prizeDrawEntries: 2,
      sessions: [],
      updatedAt: "2026-08-12T13:30:00.000Z",
      verifiedDateKeys: ["2026-08-12"],
      verifiedDays: 1,
    };
  }
  if (path === "/v1/results/mine/latest") {
    return {
      categoryLeaderboards: [],
      competitionId,
      competitionName: "August Challenge",
      endedAt: "2026-09-01T07:00:00.000Z",
      monthKey: "2026-08",
      participantGoalDays: 4,
      regionCode: "vancouver-bc",
      regionName: "Vancouver",
      resultsStatus: "settled",
      rewardCount: 1,
      rewardWinners: [],
      settledAt: "2026-09-01T08:00:00.000Z",
    };
  }
  if (path === "/v1/rewards/awards/me") {
    return [
      {
        awardRank: 1,
        awardedAt: "2026-09-01T08:00:00.000Z",
        claimedAt: null,
        id: awardId,
        imageUrl: null,
        rewardType: "physical",
        sponsorName: "GoGymGo",
        status: "awarded",
        title: "Recovery Kit",
      },
    ];
  }
  if (path.endsWith("claim")) {
    return {
      awardRank: 1,
      awardedAt: "2026-09-01T08:00:00.000Z",
      claimUrl: null,
      claimedAt: "2026-09-01T08:05:00.000Z",
      couponCode: null,
      fulfillmentInstructions: "Collect at the partner gym.",
      id: awardId,
      imageUrl: null,
      rewardType: "physical",
      sponsorName: "GoGymGo",
      status: "claimed",
      title: "Recovery Kit",
    };
  }

  throw new Error(`Unexpected critical journey request: ${method} ${path}`);
}

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
let server;
let decoders;

before(async () => {
  server = await createServer({
    configFile: false,
    logLevel: "silent",
    root: appRoot,
    server: { middlewareMode: true },
  });
  decoders = await server.ssrLoadModule("/app/admin-dashboard-utils.ts");
});

after(async () => {
  await server?.close();
});

const queueItem = {
  createdAt: "2026-08-20T12:00:00.000Z",
  decisionAllowed: true,
  id: "10000000-0000-4000-8000-000000000001",
  kind: "profile_media",
  reviewVersion: 2,
  status: "pending_review",
};

function health() {
  return {
    checkedAt: "2026-08-20T12:00:00.000Z",
    database: "ok",
    providers: Object.fromEntries(
      ["notifications", "observability", "privacy", "profileMedia"].map(
        (key) => [
          key,
          {
            evidence:
              "Configuration evidence only. No provider probe was made.",
            status: "configured",
          },
        ],
      ),
    ),
    queues: Object.fromEntries(
      [
        "competitionStartsDue",
        "incompleteSessionsDue",
        "notificationsExhausted",
        "notificationsLeased",
        "notificationsPending",
        "notificationsRetryScheduled",
        "notificationsStaleLeases",
        "privacyOperationsLeased",
        "privacyOperationsPending",
        "privacyOperationsRetryScheduled",
        "privacyOperationsStaleLeases",
        "profileMediaCleanupLeased",
        "profileMediaCleanupPending",
        "profileMediaCleanupRetryScheduled",
        "profileMediaCleanupStaleLeases",
        "socialInvitationsDue",
      ].map((key) => [key, 0]),
    ),
    reviewQueues: Object.fromEntries(
      [
        "creatorSubmissions",
        "partnerApplications",
        "privacyRequests",
        "profileMedia",
        "regionVerifications",
        "regionWaitlist",
        "workoutSessions",
      ].map((key) => [key, 0]),
    ),
    worker: {
      heartbeatAgeSeconds: 4,
      lastCompletedAt: "2026-08-20T11:59:56.000Z",
      lastFailedAt: null,
      lastFailureCode: null,
      status: "healthy",
    },
  };
}

test("accepts the exact bounded queue, health, and private-action contracts", () => {
  assert.deepEqual(
    decoders.decodeWorkQueuePage({ items: [queueItem], nextCursor: null }),
    { items: [queueItem], nextCursor: null },
  );
  assert.equal(decoders.decodeSystemHealth(health()).worker.status, "healthy");
  assert.equal(
    decoders.decodeProfileMediaReviewAction({
      contentLength: 2048,
      contentType: "image/jpeg",
      expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
      height: 640,
      id: queueItem.id,
      reviewVersion: 2,
      sha256: "a".repeat(64),
      submittedAt: queueItem.createdAt,
      url: "https://private.example/review?signature=one",
      width: 640,
    }).reviewVersion,
    2,
  );
});

test("rejects undeclared actions, private facts, and malformed retry dates", () => {
  assert.throws(() =>
    decoders.decodeWorkQueueDetail({
      ...queueItem,
      allowedDecisions: ["delete_object"],
      facts: [],
    }),
  );
  assert.throws(() =>
    decoders.decodeProfileMediaReviewAction({
      contentLength: 2048,
      contentType: "image/jpeg",
      expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
      height: 640,
      id: queueItem.id,
      reviewVersion: 2,
      sha256: "a".repeat(64),
      submittedAt: queueItem.createdAt,
      url: "http://public.example/permanent.jpg",
      width: 640,
    }),
  );
  assert.throws(() =>
    decoders.decodeWorkQueueDetail({
      ...queueItem,
      allowedDecisions: ["approved"],
      facts: [{ label: "Object key", value: "avatars/private.jpg" }],
    }),
  );
  assert.throws(() =>
    decoders.decodeProfileMediaReviewAction({
      contentLength: 2048,
      contentType: "image/jpeg",
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
      height: 640,
      id: queueItem.id,
      reviewVersion: 2,
      sha256: "a".repeat(64),
      submittedAt: queueItem.createdAt,
      url: "https://private.example/review?signature=one",
      width: 640,
    }),
  );
  assert.throws(() =>
    decoders.decodeWorkQueuePage({
      items: [{ ...queueItem, nextAttemptAt: "tomorrow" }],
      nextCursor: null,
    }),
  );
});

test("rejects sensitive audit fields nested inside arrays", () => {
  assert.throws(() =>
    decoders.decodeAuditPage({
      items: [
        {
          action: "profile_media.decided",
          actorEmail: null,
          after: { decisions: [{ token: "private" }] },
          before: null,
          createdAt: queueItem.createdAt,
          entityId: queueItem.id,
          entityType: "profile_media",
          id: "20000000-0000-4000-8000-000000000002",
          reason: "Approved after content review.",
        },
      ],
      nextCursor: null,
    }),
  );
});

test("rejects fabricated queue counts, provider states, and heartbeat dates", () => {
  const negativeQueue = health();
  negativeQueue.queues.notificationsPending = -1;
  assert.throws(() => decoders.decodeSystemHealth(negativeQueue));

  const inventedProvider = health();
  inventedProvider.providers.notifications.status = "healthy";
  assert.throws(() => decoders.decodeSystemHealth(inventedProvider));

  const invalidHeartbeat = health();
  invalidHeartbeat.worker.lastCompletedAt = "recently";
  assert.throws(() => decoders.decodeSystemHealth(invalidHeartbeat));
});

test("decodes only minimized paginated partner projections", () => {
  const decoded = decoders.decodePartnerDashboardSnapshot({
    competitions: {
      items: [
        {
          competitionStatus: "draft",
          configurationVersion: 2,
          endsAt: "2026-10-01T07:00:00.000Z",
          enrollmentCount: 0,
          entrantCap: 500,
          goalBrackets: [{ goalDays: 3, label: "3 DAYS / WEEK" }],
          gymLocationId: "gym-1",
          gymName: "Harbour Gym",
          id: "contest-1",
          monthKey: "2026-09",
          name: "Harbour Challenge",
          proposalStatus: "submitted",
          proposalVersion: 3,
          proposedByUserId: "must-not-cross-client-boundary",
          regionCode: "ca-bc-victoria",
          regionName: "Victoria",
          regionPolicyId: "region-1",
          registrationClosesAt: "2026-09-01T07:00:00.000Z",
          registrationOpensAt: "2026-08-25T07:00:00.000Z",
          startsAt: "2026-09-02T07:00:00.000Z",
        },
      ],
      nextCursor: "opaque-next",
    },
    generatedAt: "2026-08-20T12:00:00.000Z",
    gyms: [
      {
        accessLevel: "admin",
        activeQrCredentials: [],
        address: "Approved gym display address",
        id: "gym-1",
        latitude: 48.4,
        name: "Harbour Gym",
        radiusMeters: 75,
        regionCode: "ca-bc-victoria",
        regionPolicyId: "region-1",
      },
    ],
    operator: {
      email: "partner@example.com",
      id: "must-not-cross-client-boundary",
      roles: ["gym_partner_admin"],
    },
    overview: {
      activeVisitCount: 2,
      assignedGymCount: 1,
      draftProposalCount: 0,
      submittedProposalCount: 1,
    },
    regions: [
      {
        code: "ca-bc-victoria",
        competitionEnabled: true,
        id: "region-1",
        name: "Victoria",
        timezone: "America/Vancouver",
      },
    ],
    visits: {
      items: [
        {
          count: 2,
          gymLocationId: "gym-1",
          gymName: "Harbour Gym",
          sessionId: "must-not-cross-client-boundary",
          startedAt: "2026-08-19T12:00:00.000Z",
          status: "in_progress",
        },
      ],
      nextCursor: null,
    },
  });

  assert.deepEqual(decoded.operator, { email: "partner@example.com" });
  assert.equal(decoded.competitions.items[0].proposedByUserId, undefined);
  assert.equal(decoded.gyms[0].latitude, undefined);
  assert.equal(decoded.visits.items[0].sessionId, undefined);
  assert.equal(decoded.visits.items[0].startedAt, undefined);
});

test("rejects invalid partner lifecycle, visit, and secret-bearing history shapes", () => {
  assert.throws(() =>
    decoders.decodePartnerCompetitionPage({
      items: [{ proposalStatus: "platform_published" }],
      nextCursor: null,
    }),
  );
  assert.throws(() =>
    decoders.decodePartnerVisitPage({
      items: [
        {
          count: 0,
          gymLocationId: "gym-1",
          gymName: "Gym",
          status: "completed",
        },
      ],
      nextCursor: null,
    }),
  );
  assert.throws(() =>
    decoders.decodeGymQrCredentialHistoryPage({
      items: [
        {
          competitionId: "contest-1",
          competitionName: "Contest",
          credentialVersion: 1,
          expiresAt: "2026-10-01T07:00:00.000Z",
          gymLocationId: "gym-1",
          id: "credential-1",
          issuedAt: "2026-08-20T12:00:00.000Z",
          qrPayload: "https://app.gogymgo.com/scan?credential=secret",
          revokedAt: null,
          status: "active",
        },
      ],
      nextCursor: null,
    }),
  );
});

test("accepts only an exact canonical QR poster handoff", () => {
  const credential = "a".repeat(43);
  const value = {
    competitionId: "contest-1",
    competitionName: "September Contest",
    credentialVersion: 1,
    expiresAt: "2026-10-01T07:00:00.000Z",
    gymLocationId: "gym-1",
    id: "credential-1",
    issuedAt: "2026-08-20T12:00:00.000Z",
    printablePosterSvg: "<svg></svg>",
    qrPayload: `https://app.gogymgo.com/scan?credential=${credential}`,
  };

  assert.equal(decoders.decodeGymQrCredential(value).qrPayload, value.qrPayload);
  for (const qrPayload of [
    `https://app.gogymgo.com/scanner?credential=${credential}`,
    `https://app.gogymgo.com/scan?credential=${credential}&next=/profile`,
    `https://app.gogymgo.com/scan?credential=${credential}#fragment`,
    "https://app.gogymgo.com/scan?credential=too-short",
  ]) {
    assert.throws(() =>
      decoders.decodeGymQrCredential({ ...value, qrPayload }),
    );
  }
});

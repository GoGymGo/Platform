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
      expiresAt: "2026-08-20T12:05:00.000Z",
      id: queueItem.id,
      reviewVersion: 2,
      submittedAt: queueItem.createdAt,
      url: "https://private.example/review",
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
    decoders.decodeWorkQueueDetail({
      ...queueItem,
      allowedDecisions: ["approved"],
      facts: [{ label: "Object key", value: "avatars/private.jpg" }],
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeExportCursor,
  isAuthorizedPublicSiteOwner,
  readEventExportPage,
  readFeedbackExportPage,
  readPublicSiteOwnerConfig,
} from "../app/api/internal/public-site-owner";
import { handlePublicSiteEvent } from "../app/api/public-site-events/handler";
import { handlePublicSiteFeedback } from "../app/api/public-site-feedback/handler";
import {
  exportPublicSiteEvents,
  exportPublicSiteFeedback,
} from "../app/api/public-site-storage";
import { publicSiteEventDefinitions } from "../app/public-site-events";
import { readPublicSiteRetentionPolicy } from "../app/public-site-policy";

const validSubmissionId = "123e4567-e89b-42d3-a456-426614174000";

test("anonymous event intake accepts only the fixed event-name schema", async () => {
  const stored: string[] = [];
  const response = await handlePublicSiteEvent(
    jsonPost("https://gogymgo.com/api/public-site-events", {
      eventName: "member_app_click",
    }),
    {
      store: async (eventName) => {
        stored.push(eventName);
        return "saved";
      },
    },
  );

  assert.equal(response.status, 204);
  assert.deepEqual(stored, ["member_app_click"]);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.has("access-control-allow-origin"), false);

  for (const body of [
    { eventName: "member_app_click", path: "/private?token=secret" },
    { eventName: "arbitrary_event" },
    { eventName: "member_app_click", properties: {} },
  ]) {
    const rejected = await handlePublicSiteEvent(
      jsonPost("https://gogymgo.com/api/public-site-events", body),
      { store: async () => "saved" },
    );
    assert.equal(rejected.status, 400);
  }
});

test("public writes enforce same-origin JSON and bounded bodies without CORS", async () => {
  const crossOrigin = await handlePublicSiteEvent(
    jsonPost(
      "https://gogymgo.com/api/public-site-events",
      { eventName: "demo_click" },
      { Origin: "https://example.com", "Sec-Fetch-Site": "cross-site" },
    ),
    { store: async () => "saved" },
  );
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.has("access-control-allow-origin"), false);

  const wrongType = await handlePublicSiteEvent(
    new Request("https://gogymgo.com/api/public-site-events", {
      body: "{}",
      headers: {
        "Content-Type": "text/plain",
        Origin: "https://gogymgo.com",
      },
      method: "POST",
    }),
    { store: async () => "saved" },
  );
  assert.equal(wrongType.status, 415);

  const oversized = await handlePublicSiteEvent(
    jsonPost("https://gogymgo.com/api/public-site-events", {
      eventName: "x".repeat(300),
    }),
    { store: async () => "saved" },
  );
  assert.equal(oversized.status, 413);

  const wrongMethod = await handlePublicSiteEvent(
    new Request("https://gogymgo.com/api/public-site-events"),
    { store: async () => "saved" },
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");

  const brokenBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("private stream detail"));
    },
  });
  const unreadable = await handlePublicSiteEvent(
    new Request("https://gogymgo.com/api/public-site-events", {
      body: brokenBody,
      duplex: "half",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://gogymgo.com",
      },
      method: "POST",
    } as RequestInit & { duplex: "half" }),
    { store: async () => "saved" },
  );
  assert.equal(unreadable.status, 400);
  assert.doesNotMatch(await unreadable.text(), /private stream detail/);
});

test("measurement failure is a generic no-store response and rate limits are bounded", async () => {
  const unavailable = await handlePublicSiteEvent(
    jsonPost("https://gogymgo.com/api/public-site-events", {
      eventName: "demo_click",
    }),
    { store: async () => Promise.reject(new Error("private database value")) },
  );
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private database value/);

  const limited = await handlePublicSiteEvent(
    jsonPost("https://gogymgo.com/api/public-site-events", {
      eventName: "demo_click",
    }),
    { store: async () => "rate_limited" },
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("feedback accepts optional contact, canonical pages and replay IDs", async () => {
  const stored: unknown[] = [];
  const response = await handlePublicSiteFeedback(
    validFeedbackRequest(),
    {
      store: async (feedback) => {
        stored.push(feedback);
        return "saved";
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(stored, [
    {
      category: "accessibility",
      consent: false,
      email: "",
      message: "Keyboard focus disappears after opening the menu.",
      page: "accessibility",
      submissionId: validSubmissionId,
    },
  ]);

  const contacted = await handlePublicSiteFeedback(
    validFeedbackRequest({ consent: true, email: " Visitor@Example.com " }),
    {
      store: async (feedback) => {
        assert.equal(feedback.email, "visitor@example.com");
        return "saved";
      },
    },
  );
  assert.equal(contacted.status, 201);
});

test("feedback rejects ambiguous contact, unknown keys and silent truncation", async () => {
  for (const [overrides, status] of [
    [{ consent: false, email: "visitor@example.com" }, 400],
    [{ consent: true, email: "" }, 400],
    [{ message: "short" }, 400],
    [{ message: "x".repeat(2_001) }, 400],
    [{ page: "/faq?token=secret" }, 400],
    [{ submissionId: "not-a-uuid" }, 400],
  ] as const) {
    const response = await handlePublicSiteFeedback(
      validFeedbackRequest(overrides),
      { store: async () => "saved" },
    );
    assert.equal(response.status, status);
  }

  const unknownKey = await handlePublicSiteFeedback(
    jsonPost("https://gogymgo.com/api/public-site-feedback", {
      ...validFeedbackBody(),
      userAgent: "private-device-value",
    }),
    { store: async () => "saved" },
  );
  assert.equal(unknownKey.status, 400);
  assert.doesNotMatch(await unknownKey.text(), /private-device-value/);
});

test("feedback honeypot is accepted without persistence", async () => {
  let writes = 0;
  const response = await handlePublicSiteFeedback(
    validFeedbackRequest({ contactFax: "filled-by-bot" }),
    {
      store: async () => {
        writes += 1;
        return "saved";
      },
    },
  );
  assert.equal(response.status, 201);
  assert.equal(writes, 0);
});

test("retention configuration is exact, bounded and fail closed", () => {
  assert.deepEqual(
    readPublicSiteRetentionPolicy({
      PUBLIC_SITE_EVENT_RETENTION_DAYS: "30",
      PUBLIC_SITE_FEEDBACK_RETENTION_DAYS: "90",
    }),
    { eventDays: 30, feedbackDays: 90 },
  );

  for (const values of [
    {},
    {
      PUBLIC_SITE_EVENT_RETENTION_DAYS: "6",
      PUBLIC_SITE_FEEDBACK_RETENTION_DAYS: "90",
    },
    {
      PUBLIC_SITE_EVENT_RETENTION_DAYS: "30",
      PUBLIC_SITE_FEEDBACK_RETENTION_DAYS: "181",
    },
    {
      PUBLIC_SITE_EVENT_RETENTION_DAYS: "30.0",
      PUBLIC_SITE_FEEDBACK_RETENTION_DAYS: "90",
    },
  ]) {
    assert.equal(readPublicSiteRetentionPolicy(values), null);
  }
});

test("owner operations require complete config and both exact identities", async () => {
  const values = {
    LANDING_D1_EXPORT_ENABLED: "yes",
    LANDING_D1_EXPORT_OWNER_EMAIL: "owner@example.com",
    LANDING_D1_EXPORT_OWNER_USER_ID: "site-owner-123",
  };
  const owner = readPublicSiteOwnerConfig(values, "LANDING_D1_EXPORT_ENABLED");
  assert.deepEqual(owner, {
    email: "owner@example.com",
    userId: "site-owner-123",
  });
  assert.ok(owner);
  assert.equal(
    readPublicSiteOwnerConfig(
      { ...values, LANDING_D1_EXPORT_OWNER_USER_ID: "" },
      "LANDING_D1_EXPORT_ENABLED",
    ),
    null,
  );

  const compare = async (provided: string, expected: string) =>
    provided === expected;
  const user = {
    displayName: "Owner",
    email: "OWNER@example.com",
    fullName: "Owner",
    id: "site-owner-123",
  };
  assert.equal(await isAuthorizedPublicSiteOwner(user, owner, compare), true);
  assert.equal(
    await isAuthorizedPublicSiteOwner(
      { ...user, id: "different-owner" },
      owner,
      compare,
    ),
    false,
  );
  assert.equal(
    await isAuthorizedPublicSiteOwner(
      { ...user, email: "other@example.com" },
      owner,
      compare,
    ),
    false,
  );
  assert.equal(
    await isAuthorizedPublicSiteOwner({ ...user, id: null }, owner, compare),
    false,
  );
});

test("owner export pagination accepts only bounded exact cursors", () => {
  const feedbackCursor = encodeExportCursor({
    createdAt: "2026-08-21T12:00:00.000Z",
    id: validSubmissionId,
    kind: "feedback",
  });
  assert.deepEqual(
    readFeedbackExportPage(
      new Request(
        `https://gogymgo.com/api/internal/export-public-site-feedback?limit=25&cursor=${feedbackCursor}`,
      ),
    ),
    {
      cursor: {
        createdAt: "2026-08-21T12:00:00.000Z",
        id: validSubmissionId,
        kind: "feedback",
      },
      limit: 25,
    },
  );

  const eventCursor = encodeExportCursor({
    day: "2026-08-21",
    eventName: "member_app_click",
    kind: "events",
  });
  assert.equal(
    readEventExportPage(
      new Request(
        `https://gogymgo.com/api/internal/export-public-site-events?cursor=${eventCursor}`,
      ),
    )?.limit,
    50,
  );

  for (const url of [
    "https://gogymgo.com/api/internal/export-public-site-feedback?limit=0",
    "https://gogymgo.com/api/internal/export-public-site-feedback?limit=101",
    "https://gogymgo.com/api/internal/export-public-site-feedback?limit=10&limit=20",
    "https://gogymgo.com/api/internal/export-public-site-feedback?private=value",
    "https://gogymgo.com/api/internal/export-public-site-feedback?cursor=invalid",
  ]) {
    assert.equal(readFeedbackExportPage(new Request(url)), null);
  }
});

test("owner export decoders minimize legacy metadata and filter retired events", async () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  const feedbackQueries: CapturedQuery[] = [];
  const feedback = await exportPublicSiteFeedback(
    fakeExportDb(
      [
        {
          category: "accessibility",
          consent: 0,
          created_at: "2026-08-21T11:00:00.000Z",
          email: "visitor@example.com",
          id: validSubmissionId,
          message: "Keyboard focus disappears after opening the menu.",
          page: "/faq?legacy_private_value=removed",
        },
      ],
      feedbackQueries,
    ),
    { cursor: null, limit: 10 },
    now,
    90,
  );
  assert.deepEqual(feedback.results, [
    {
      category: "accessibility",
      contact_email: null,
      created_at: "2026-08-21T11:00:00.000Z",
      id: validSubmissionId,
      message: "Keyboard focus disappears after opening the menu.",
      page: "legacy_unclassified",
    },
  ]);

  const eventQueries: CapturedQuery[] = [];
  const events = await exportPublicSiteEvents(
    fakeExportDb(
      [
        {
          event_count: 2,
          event_day: "2026-08-21",
          event_name: "member_app_click",
        },
      ],
      eventQueries,
    ),
    { cursor: null, limit: 10 },
    now,
    30,
  );
  assert.deepEqual(events.results, [
    {
      canonical_path: "/join",
      count: 2,
      day: "2026-08-21",
      event_name: "member_app_click",
    },
  ]);
  assert.match(eventQueries[0]?.sql ?? "", /event_name IN \(\?2/);
  assert.doesNotMatch(eventQueries[0]?.sql ?? "", /SELECT[\s\S]*\bpath\b/);
  assert.deepEqual(eventQueries[0]?.values.slice(1, 9), [
    "brand_form_start",
    "brand_partnership_click",
    "demo_click",
    "faq_open",
    "feedback_form_start",
    "gym_form_start",
    "member_app_click",
    "regional_updates_click",
  ]);

  await assert.rejects(
    exportPublicSiteFeedback(
      fakeExportDb(
        [
          {
            category: "accessibility",
            consent: 0,
            created_at: "2026-08-21T11:00:00.000Z",
            email: "",
            id: validSubmissionId,
            message: "Keyboard focus disappears after opening the menu.",
            page: "/faq",
            unexpected: "private",
          },
        ],
        [],
      ),
      { cursor: null, limit: 10 },
      now,
      90,
    ),
    /Invalid feedback export row/,
  );
});

test("the event allowlist maps only current GGG-025 actions", () => {
  assert.deepEqual(publicSiteEventDefinitions, {
    brand_form_start: { canonicalPath: "/brands" },
    brand_partnership_click: { canonicalPath: "/partners" },
    demo_click: { canonicalPath: "/demo" },
    faq_open: { canonicalPath: "/faq" },
    feedback_form_start: { canonicalPath: "/contact" },
    gym_form_start: { canonicalPath: "/gym-goers" },
    member_app_click: { canonicalPath: "/join" },
    regional_updates_click: { canonicalPath: "/gym-goers" },
  });
});

function jsonPost(
  url: string,
  body: unknown,
  headerOverrides: Record<string, string> = {},
): Request {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: new URL(url).origin,
      "Sec-Fetch-Site": "same-origin",
      ...headerOverrides,
    },
    method: "POST",
  });
}

function validFeedbackBody(overrides: Record<string, unknown> = {}) {
  return {
    category: "accessibility",
    consent: false,
    contactFax: "",
    email: "",
    message: "Keyboard focus disappears after opening the menu.",
    page: "accessibility",
    submissionId: validSubmissionId,
    ...overrides,
  };
}

function validFeedbackRequest(overrides: Record<string, unknown> = {}) {
  return jsonPost(
    "https://gogymgo.com/api/public-site-feedback",
    validFeedbackBody(overrides),
  );
}

type CapturedQuery = { sql: string; values: unknown[] };

function fakeExportDb(
  rows: Array<Record<string, unknown>>,
  captured: CapturedQuery[],
): D1Database {
  return {
    prepare(sql: string) {
      const query = { sql, values: [] as unknown[] };
      captured.push(query);
      const statement = {
        all: async () => ({ results: rows }),
        bind: (...values: unknown[]) => {
          query.values = values;
          return statement;
        },
        run: async () => ({ meta: { changes: 1 } }),
      };
      return statement as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}

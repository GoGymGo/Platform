import assert from "node:assert/strict";
import test from "node:test";

import {
  exportLandingInterestPage,
  readLandingInterestExportConfig,
  readLandingInterestExportPageRequest,
} from "../app/api/landing-intake-export";
import {
  handlePartnershipInterest,
  handleRegionalUpdates,
} from "../app/api/landing-intake-request";

const submissionId = "10000000-0000-4000-8000-000000000027";
const exportId = "20000000-0000-4000-8000-000000000027";
const cutoffExclusive = "2026-08-21T12:00:00.000Z";

function publicRequest(path: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(`https://gogymgo.com${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json; charset=utf-8",
      origin: "https://gogymgo.com",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    method: "POST",
  });
}

test("regional updates forward one normalized API-only submission", async () => {
  const calls: unknown[][] = [];
  const response = await handleRegionalUpdates(
    publicRequest("/api/regional-updates", {
      consent: true,
      consentNoticeVersion: "regional-updates-2026-08-13-v1",
      contactFax: "",
      email: " PLAYER@Example.com ",
      requestedRegion: " Victoria, BC ",
      submissionId,
    }),
    {
      forward: async (...args) => {
        calls.push(args);
        return Response.json({ status: "received" }, { status: 201 });
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { saved: true });
  assert.deepEqual(calls, [
    [
      "/v1/region-waitlist",
      submissionId,
      {
        consent: true,
        consentNoticeVersion: "regional-updates-2026-08-13-v1",
        email: "player@example.com",
        requestedRegion: "Victoria, BC",
      },
    ],
  ]);
});

test("landing intake rejects cross-origin, loose schema, oversized and silent failure paths", async () => {
  let forwarded = 0;
  const dependencies = {
    forward: async () => {
      forwarded += 1;
      return Response.json({ error: "private upstream detail" }, { status: 503 });
    },
  };
  const valid = {
    consent: true,
    consentNoticeVersion: "regional-updates-2026-08-13-v1",
    contactFax: "",
    email: "player@example.com",
    requestedRegion: "Victoria, BC",
    submissionId,
  };

  const crossOrigin = await handleRegionalUpdates(
    publicRequest("/api/regional-updates", valid, {
      origin: "https://attacker.example",
    }),
    dependencies,
  );
  assert.equal(crossOrigin.status, 403);

  const looseSchema = await handleRegionalUpdates(
    publicRequest("/api/regional-updates", { ...valid, unexpected: true }),
    dependencies,
  );
  assert.equal(looseSchema.status, 400);

  const oversized = await handleRegionalUpdates(
    publicRequest("/api/regional-updates", {
      ...valid,
      requestedRegion: "x".repeat(1_500),
    }),
    dependencies,
  );
  assert.equal(oversized.status, 413);

  const upstreamFailure = await handleRegionalUpdates(
    publicRequest("/api/regional-updates", valid),
    dependencies,
  );
  assert.equal(upstreamFailure.status, 503);
  assert.doesNotMatch(await upstreamFailure.text(), /private upstream detail/);
  assert.equal(forwarded, 1);
});

test("forwarder authorization failures are reported as authority unavailable", async () => {
  const response = await handleRegionalUpdates(
    publicRequest("/api/regional-updates", {
      consent: true,
      consentNoticeVersion: "regional-updates-2026-08-13-v1",
      contactFax: "",
      email: "player@example.com",
      requestedRegion: "Victoria, BC",
      submissionId,
    }),
    {
      forward: async () =>
        Response.json({ error: "invalid forwarding key" }, { status: 403 }),
    },
  );

  assert.equal(response.status, 503);
  assert.match(await response.text(), /temporarily unavailable/);
});

test("honeypot submissions receive a quiet receipt without forwarding", async () => {
  let forwarded = false;
  const response = await handlePartnershipInterest(
    publicRequest("/api/interest", {
      audience: "brand",
      companyName: "Example Co",
      consent: true,
      contactFax: "bot-filled",
      email: "partner@example.com",
      fullName: "Partner Person",
      partnershipInterest: "regional-sponsor",
      region: "Victoria, BC",
      submissionId,
    }),
    {
      forward: async () => {
        forwarded = true;
        return new Response(null, { status: 201 });
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal(forwarded, false);
});

test("historical export configuration and cursors are exact and frozen", async () => {
  const config = readLandingInterestExportConfig({
    LANDING_D1_EXPORT_CUTOFF_EXCLUSIVE: cutoffExclusive,
    LANDING_D1_EXPORT_ID: exportId,
  });
  assert.deepEqual(config, { cutoffExclusive, exportId });
  assert.equal(
    readLandingInterestExportConfig({
      LANDING_D1_EXPORT_CUTOFF_EXCLUSIVE: "2026-08-21",
      LANDING_D1_EXPORT_ID: exportId,
    }),
    null,
  );
  assert.ok(config);

  const firstRequest = readLandingInterestExportPageRequest(
    new Request("https://gogymgo.com/api/internal/export?limit=1"),
    config,
  );
  assert.ok(firstRequest);

  const preparedSql: string[] = [];
  const fakeDb = {
    batch: async () => [
      {
        results: [
          {
            audience: "brand",
            company_name: "Example Co",
            consent: 1,
            created_at: "2026-08-20T10:00:00.000Z",
            discovery_source: null,
            email: "partner@example.com",
            full_name: "Partner Person",
            goal_days: null,
            id: "legacy-1",
            message: null,
            partnership_interest: "regional-sponsor",
            region: "Victoria, BC",
            updated_at: "2026-08-20T10:00:00.000Z",
            website: null,
            workout_style: null,
          },
          {
            audience: "gym_goer",
            company_name: null,
            consent: true,
            created_at: "2026-08-20T11:00:00.000Z",
            discovery_source: null,
            email: "player@example.com",
            full_name: "Pilot Player",
            goal_days: 3,
            id: "legacy-2",
            message: null,
            partnership_interest: null,
            region: "Victoria, BC",
            updated_at: "2026-08-20T11:00:00.000Z",
            website: null,
            workout_style: "Strength",
          },
        ],
      },
      { results: [{ source_count: 2 }] },
    ],
    prepare: (sql: string) => {
      preparedSql.push(sql);
      return { bind: (...values: unknown[]) => ({ sql, values }) };
    },
  } as unknown as D1Database;

  const page = await exportLandingInterestPage(fakeDb, config, firstRequest);
  assert.equal(page.page_count, 1);
  assert.equal(page.source_count, 2);
  assert.equal(page.results.length, 1);
  assert.match(page.content_sha256, /^[0-9a-f]{64}$/);
  assert.match(page.results[0]!.source_record_sha256, /^[0-9a-f]{64}$/);
  assert.ok(page.next_cursor);
  assert.equal(preparedSql.every((sql) => /^SELECT/u.test(sql.trim())), true);

  const secondRequest = readLandingInterestExportPageRequest(
    new Request(
      `https://gogymgo.com/api/internal/export?limit=1&cursor=${page.next_cursor}`,
    ),
    config,
  );
  assert.equal(secondRequest?.sequence, 2);
  assert.equal(
    readLandingInterestExportPageRequest(
      new Request("https://gogymgo.com/api/internal/export?extra=true"),
      config,
    ),
    null,
  );
});

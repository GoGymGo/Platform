import assert from "node:assert/strict";
import test from "node:test";

import {
  getSeptemberCampaignState,
  isSeptemberPilotPublished,
} from "../app/campaign";
import {
  normalizeLocalMemberAppOrigin,
  normalizeMemberAppOrigin,
} from "../app/site-links";
import {
  applyPublicSecurityHeaders,
  productionContentSecurityPolicy,
} from "../worker/security-headers";

test("member-app origins are canonical, allowlisted and fail closed", () => {
  assert.equal(
    normalizeMemberAppOrigin("https://app.gogymgo.com/"),
    "https://app.gogymgo.com",
  );

  for (const value of [
    undefined,
    "",
    "/join",
    "http://app.gogymgo.com",
    "https://app.gogymgo.com/join",
    "https://app.gogymgo.com?next=/join",
    "https://app.gogymgo.com#join",
    "https://user:password@app.gogymgo.com",
    "https://app.gogymgo.com:444",
    "https://gogymgo-admin-control.wilson-1212.chatgpt.site",
    "https://example.com",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
  ]) {
    assert.equal(normalizeMemberAppOrigin(value), null, value);
  }

  assert.equal(
    normalizeLocalMemberAppOrigin("http://localhost:8081"),
    "http://localhost:8081",
  );
  assert.equal(
    normalizeLocalMemberAppOrigin("http://127.0.0.1:8081"),
    "http://127.0.0.1:8081",
  );
});

test("pilot publication is explicit and never inferred from the calendar", () => {
  assert.equal(isSeptemberPilotPublished(undefined), false);
  assert.equal(isSeptemberPilotPublished("no"), false);
  assert.equal(isSeptemberPilotPublished("true"), false);
  assert.equal(isSeptemberPilotPublished("yes"), true);

  assert.deepEqual(
    getSeptemberCampaignState(new Date("2026-09-15T12:00:00.000Z"), false),
    {
      phase: "unpublished",
      primaryAction: "regionalUpdates",
      primaryLabel: "GET REGIONAL UPDATES",
      statusLabel: "PILOT NOT YET PUBLISHED",
    },
  );
  assert.equal(
    getSeptemberCampaignState(new Date("2026-08-21T12:00:00.000Z"), true)
      .phase,
    "registration",
  );
  assert.equal(
    getSeptemberCampaignState(new Date("2026-09-15T12:00:00.000Z"), true)
      .phase,
    "active",
  );
  assert.equal(
    getSeptemberCampaignState(new Date("2026-10-02T12:00:00.000Z"), true)
      .phase,
    "ended",
  );
});

test("public responses receive browser security headers", async () => {
  const secured = applyPublicSecurityHeaders(
    new Response("ok", {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 202,
    }),
    "https://gogymgo.com/partners",
  );

  assert.equal(secured.status, 202);
  assert.equal(await secured.text(), "ok");
  assert.equal(
    secured.headers.get("content-security-policy"),
    productionContentSecurityPolicy,
  );
  assert.equal(secured.headers.get("x-content-type-options"), "nosniff");
  assert.equal(secured.headers.get("x-frame-options"), "DENY");
  assert.equal(secured.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(
    secured.headers.get("permissions-policy"),
    "camera=(), geolocation=(), microphone=()",
  );
  assert.equal(
    secured.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );

  const local = applyPublicSecurityHeaders(
    new Response("ok"),
    "http://localhost:4173/",
  );
  assert.equal(local.headers.has("strict-transport-security"), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { submitRegionWaitlist } from "@/data/regionWaitlistRepository";

test("submits a consented regional update for the bearer-owned member", async () => {
  const requests: unknown[] = [];
  const api = {
    request: async (path: string, options: unknown) => {
      requests.push({ options, path });
      return { status: "received" };
    },
  };

  await assert.doesNotReject(
    submitRegionWaitlist(api as never, {
      consent: true,
      requestedRegion: "North Island",
    }),
  );
  assert.deepEqual(requests, [
    {
      options: {
        body: {
          consent: true,
          consentNoticeVersion: "regional-updates-2026-08-13-v1",
          requestedRegion: "North Island",
        },
        method: "POST",
      },
      path: "/v1/me/region-waitlist",
    },
  ]);
});

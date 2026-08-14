import assert from "node:assert/strict";
import test from "node:test";

import {
  FirebaseTokenUnavailableError,
  sendWithFirebaseTokenRecovery,
} from "../app/admin-auth-request.mjs";

test("forces one token refresh and retries exactly once after a 401", async () => {
  const tokenRequests = [];
  const sentTokens = [];
  const user = {
    async getIdToken(forceRefresh = false) {
      tokenRequests.push(forceRefresh);
      return forceRefresh ? "fresh-token" : "cached-token";
    },
  };

  const response = await sendWithFirebaseTokenRecovery(user, async (token) => {
    sentTokens.push(token);
    return { status: sentTokens.length === 1 ? 401 : 200 };
  });

  assert.equal(response.status, 200);
  assert.deepEqual(tokenRequests, [false, true]);
  assert.deepEqual(sentTokens, ["cached-token", "fresh-token"]);
});

test("does not refresh or retry non-401 failures", async () => {
  let sends = 0;
  const user = {
    async getIdToken(forceRefresh = false) {
      assert.equal(forceRefresh, false);
      return "cached-token";
    },
  };

  const response = await sendWithFirebaseTokenRecovery(user, async () => {
    sends += 1;
    return { status: 403 };
  });

  assert.equal(response.status, 403);
  assert.equal(sends, 1);
});

test("stops after the single refreshed retry when the API stays unauthorized", async () => {
  let sends = 0;
  const user = {
    async getIdToken() {
      return "token";
    },
  };

  const response = await sendWithFirebaseTokenRecovery(user, async () => {
    sends += 1;
    return { status: 401 };
  });

  assert.equal(response.status, 401);
  assert.equal(sends, 2);
});

test("reports an unavailable Firebase token without sending a request", async () => {
  let sends = 0;
  const user = {
    async getIdToken() {
      throw new Error("revoked");
    },
  };

  await assert.rejects(
    sendWithFirebaseTokenRecovery(user, async () => {
      sends += 1;
      return { status: 200 };
    }),
    FirebaseTokenUnavailableError,
  );
  assert.equal(sends, 0);
});

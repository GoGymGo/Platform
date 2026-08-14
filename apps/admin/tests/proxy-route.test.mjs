import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";

const validAuthorization = `Bearer ${"a".repeat(40)}`;
const requests = [];
let responseMode = "json";
let server;
let upstreamOrigin;
let worker;

before(async () => {
  server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({
      body,
      headers: request.headers,
      method: request.method,
      url: request.url,
    });
    if (responseMode === "redirect") {
      response.writeHead(302, { location: "https://attacker.example/" });
      response.end();
      return;
    }
    if (responseMode === "html") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<p>upstream detail</p>");
      return;
    }
    const status = responseMode === "unauthorized" ? 401 : 200;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        status === 401
          ? { error: { code: "AUTH_REQUIRED", message: "Sign in." } }
          : { ok: true },
      ),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  upstreamOrigin = `http://127.0.0.1:${address.port}`;
  process.env.GOGYMGO_API_URL = upstreamOrigin;

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("proxy-test", `${process.pid}-${Date.now()}`);
  ({ default: worker } = await import(workerUrl.href));
});

beforeEach(() => {
  requests.length = 0;
  responseMode = "json";
  process.env.GOGYMGO_API_URL = upstreamOrigin;
});

after(async () => {
  delete process.env.GOGYMGO_API_URL;
  server.close();
  await once(server, "close");
});

function dispatch(path, init = {}) {
  return worker.fetch(
    new Request(new URL(path, "http://admin.local"), init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { passThroughOnException() {}, waitUntil() {} },
  );
}

test("allows only operator paths and supported methods", async () => {
  const outside = await dispatch("/api/gogymgo/profiles/me", {
    headers: { authorization: validAuthorization },
  });
  assert.equal(outside.status, 404);
  assert.deepEqual(requests, []);

  const unsupported = await dispatch("/api/gogymgo/operator/access", {
    headers: { authorization: validAuthorization },
    method: "PATCH",
  });
  assert.equal(unsupported.status, 405);
  assert.deepEqual(requests, []);
});

test("rejects malformed auth, idempotency, queries, and bodies before upstream", async () => {
  const malformedAuth = await dispatch("/api/gogymgo/operator/access", {
    headers: { authorization: "Bearer short" },
  });
  assert.equal(malformedAuth.status, 401);

  const malformedKey = await dispatch("/api/gogymgo/operator/action", {
    body: "{}",
    headers: {
      authorization: validAuthorization,
      "content-type": "application/json",
      "idempotency-key": "x".repeat(201),
    },
    method: "POST",
  });
  assert.equal(malformedKey.status, 400);

  const sensitiveQuery = await dispatch(
    "/api/gogymgo/operator/access?token=secret",
    { headers: { authorization: validAuthorization } },
  );
  assert.equal(sensitiveQuery.status, 400);

  const wrongContentType = await dispatch("/api/gogymgo/operator/action", {
    body: "value=true",
    headers: {
      authorization: validAuthorization,
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  assert.equal(wrongContentType.status, 415);

  const invalidJson = await dispatch("/api/gogymgo/operator/action", {
    body: "{",
    headers: {
      authorization: validAuthorization,
      "content-type": "application/json",
    },
    method: "POST",
  });
  assert.equal(invalidJson.status, 400);

  const tooLarge = await dispatch("/api/gogymgo/operator/action", {
    body: JSON.stringify({ value: "small" }),
    headers: {
      authorization: validAuthorization,
      "content-length": "1048577",
      "content-type": "application/json",
    },
    method: "POST",
  });
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(requests, []);
});

test("forwards only the allowlisted request shape", async () => {
  const response = await dispatch("/api/gogymgo/operator/action?gymId=gym-1", {
    body: JSON.stringify({ reason: "Approved access change" }),
    headers: {
      authorization: validAuthorization,
      cookie: "private=session",
      "content-type": "application/json; charset=utf-8",
      "idempotency-key": "operator-action-1",
      origin: "https://attacker.example",
      "x-forwarded-host": "attacker.example",
    },
    method: "POST",
  });

  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].url, "/v1/operator/action?gymId=gym-1");
  assert.equal(requests[0].body, '{"reason":"Approved access change"}');
  assert.equal(requests[0].headers.authorization, validAuthorization);
  assert.equal(requests[0].headers["idempotency-key"], "operator-action-1");
  assert.equal(requests[0].headers.cookie, undefined);
  assert.equal(requests[0].headers.origin, undefined);
  assert.equal(requests[0].headers["x-forwarded-host"], undefined);
});

test("passes JSON auth failures but sanitizes invalid upstream responses", async () => {
  responseMode = "unauthorized";
  const unauthorized = await dispatch("/api/gogymgo/operator/access", {
    headers: { authorization: validAuthorization },
  });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), {
    error: { code: "AUTH_REQUIRED", message: "Sign in." },
  });

  responseMode = "redirect";
  const redirect = await dispatch("/api/gogymgo/operator/access", {
    headers: { authorization: validAuthorization },
  });
  assert.equal(redirect.status, 502);
  assert.doesNotMatch(await redirect.text(), /attacker\.example/);

  responseMode = "html";
  const html = await dispatch("/api/gogymgo/operator/access", {
    headers: { authorization: validAuthorization },
  });
  assert.equal(html.status, 502);
  assert.doesNotMatch(await html.text(), /upstream detail/);
});

test("sanitizes upstream network failures", async () => {
  process.env.GOGYMGO_API_URL = "https://127.0.0.1:1";
  const response = await dispatch("/api/gogymgo/operator/access", {
    headers: { authorization: validAuthorization },
  });
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /127\.0\.0\.1|ECONNREFUSED/);
});

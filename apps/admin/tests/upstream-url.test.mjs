import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildUpstreamUrl,
  isAllowedAdminProxyPath,
  parseAdminApiBaseUrl,
  validatedAdminProxySearch,
} from "../app/api/gogymgo/[...path]/upstream-url.mjs";

test("admin proxy targets the versioned operator contract", async () => {
  const openapi = JSON.parse(
    await readFile(
      new URL("../../../services/api/openapi.json", import.meta.url),
      "utf8",
    ),
  );
  const target = buildUpstreamUrl(
    "https://api.gogymgo.com/",
    ["operator", "configuration", "dashboard"],
    "?region=vancouver-island",
  );

  assert.equal(
    target.toString(),
    "https://api.gogymgo.com/v1/operator/configuration/dashboard?region=vancouver-island",
  );
  assert.ok(openapi.paths[target.pathname]);
});

test("admin proxy does not duplicate an explicitly versioned base URL", () => {
  const target = buildUpstreamUrl("https://api.gogymgo.com/v1/", [
    "operator",
    "system-health",
  ]);

  assert.equal(
    target.toString(),
    "https://api.gogymgo.com/v1/operator/system-health",
  );
});

test("admin proxy accepts only exact operator path segments", () => {
  assert.equal(isAllowedAdminProxyPath(["operator", "access"]), true);
  assert.equal(isAllowedAdminProxyPath(["operator"]), false);
  assert.equal(isAllowedAdminProxyPath(["profiles", "me"]), false);
  assert.equal(isAllowedAdminProxyPath(["operator", "..", "health"]), false);
  assert.equal(isAllowedAdminProxyPath(["operator", "%2e%2e"]), false);
  assert.equal(isAllowedAdminProxyPath(["operator", "a/b"]), false);
  assert.equal(isAllowedAdminProxyPath(["operator", "a\\b"]), false);
});

test("admin proxy rejects unsafe or ambiguous upstream configuration", () => {
  assert.equal(
    parseAdminApiBaseUrl("https://api.gogymgo.com/v1/"),
    "https://api.gogymgo.com/v1",
  );
  assert.equal(
    parseAdminApiBaseUrl("http://localhost:3000"),
    "http://localhost:3000/v1",
  );
  for (const baseUrl of [
    "http://api.gogymgo.com",
    "https://user:password@api.gogymgo.com",
    "https://api.gogymgo.com/internal",
    "https://api.gogymgo.com?origin=https://attacker.example",
  ]) {
    assert.throws(() => parseAdminApiBaseUrl(baseUrl));
  }
});

test("admin proxy preserves safe queries without forwarding authentication material", () => {
  assert.equal(
    validatedAdminProxySearch("?region=vancouver-island&limit=20"),
    "?region=vancouver-island&limit=20",
  );
  for (const search of [
    "?token=secret",
    "?authorization=Bearer+secret",
    "?refresh_token=secret",
    `?query=${"x".repeat(2_100)}`,
  ]) {
    assert.throws(() => validatedAdminProxySearch(search));
  }
});

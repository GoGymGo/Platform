import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildUpstreamUrl } from "../app/api/gogymgo/[...path]/upstream-url.mjs";

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

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createStaticExportAttestation,
  verifyStaticExportAttestation,
} from "./static-export-attestation.mjs";

const metadata = {
  apiOrigin: "https://api-staging.gogymgo.com",
  releaseMode: "browser-pilot",
  sourceCommit: "a".repeat(40),
};

test("attests and re-verifies the exact static artifact", (context) => {
  const root = createFixture(context);
  const attestation = createStaticExportAttestation(root, metadata);

  assert.equal(attestation.fileCount, 2);
  assert.match(attestation.artifactSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(verifyStaticExportAttestation(root, attestation), attestation);
});

test("rejects artifact mutation after attestation", (context) => {
  const root = createFixture(context);
  const attestation = createStaticExportAttestation(root, metadata);
  fs.writeFileSync(path.join(root, "index.html"), "changed");

  assert.throws(
    () => verifyStaticExportAttestation(root, attestation),
    /Expected values to be strictly deep-equal/,
  );
});

test("rejects symlinks instead of following content outside the export", (context) => {
  const root = createFixture(context);
  const target = path.join(root, "index.html");
  const link = path.join(root, "linked-index.html");
  try {
    fs.symlinkSync(target, link, "file");
  } catch (error) {
    if (process.platform === "win32" && error?.code === "EPERM") {
      context.skip("Windows symlink permission is unavailable.");
      return;
    }
    throw error;
  }
  assert.throws(
    () => createStaticExportAttestation(root, metadata),
    /must not contain symbolic links/,
  );
});

test("rejects decorated, credentialed, and private API origins", (context) => {
  const root = createFixture(context);
  for (const apiOrigin of [
    "https://api.gogymgo.com/",
    "https://user@api.gogymgo.com",
    "https://api.gogymgo.com:443",
    "https://127.0.0.1",
    "https://localhost",
  ]) {
    assert.throws(
      () =>
        createStaticExportAttestation(root, {
          ...metadata,
          apiOrigin,
        }),
      /exact HTTPS origin/,
      apiOrigin,
    );
  }
});

function createFixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gogymgo-static-export-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app.js"), "console.log('ready');\n");
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html><title>GoGymGo</title>\n");
  return root;
}

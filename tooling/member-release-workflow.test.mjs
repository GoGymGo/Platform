import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const memberWorkflow = read(".github/workflows/member-web-deployment.yml");
const platformWorkflow = read(".github/workflows/deployment.yml");
const memberInfrastructure = read("infrastructure/aws/terraform/member_web.tf");
const memberDeployIdentity = read("infrastructure/aws/terraform/identity.tf");

test("keeps browser-pilot and native-link publication as explicit release modes", () => {
  assert.match(memberWorkflow, /release_mode:[\s\S]*browser-pilot[\s\S]*native-links/);
  assert.match(
    platformWorkflow,
    /member-native-links:[\s\S]*release_mode: native-links/,
  );
  assert.match(
    platformWorkflow,
    /member-web:[\s\S]*release_mode: browser-pilot/,
  );
  assert.match(memberWorkflow, /node apps\/member-app\/scripts\/member-release-policy\.mjs/);
  assert.match(memberWorkflow, /npm run audit:native-link-release -- dist/);
  assert.match(memberWorkflow, /npm run audit:browser-pilot-release -- dist/);
});

test("checks out and attests the exact authorized source before cloud access", () => {
  const checkoutIndex = memberWorkflow.indexOf("ref: ${{ inputs.source_commit }}");
  const actualCommitIndex = memberWorkflow.indexOf('actual_commit="$(git rev-parse HEAD)"');
  const createIndex = memberWorkflow.indexOf("            create \\", actualCommitIndex);
  const credentialsIndex = memberWorkflow.indexOf("aws-actions/configure-aws-credentials@");
  const verifyIndex = memberWorkflow.indexOf("            verify \\", credentialsIndex);

  assert.ok(checkoutIndex >= 0);
  assert.ok(actualCommitIndex > checkoutIndex);
  assert.ok(createIndex > actualCommitIndex);
  assert.ok(credentialsIndex > createIndex);
  assert.ok(verifyIndex > credentialsIndex);
  assert.match(memberWorkflow, /persist-credentials: false/);
});

test("publishes assets before the entrypoint and preserves automatic rollback", () => {
  const assetsIndex = memberWorkflow.indexOf("aws s3 sync apps/member-app/dist");
  const entrypointIndex = memberWorkflow.indexOf(
    "aws s3 cp apps/member-app/dist/index.html",
  );
  const invalidationIndex = memberWorkflow.indexOf("invalidate_all", entrypointIndex);

  assert.ok(assetsIndex >= 0);
  assert.ok(entrypointIndex > assetsIndex);
  assert.ok(invalidationIndex > entrypointIndex);
  assert.doesNotMatch(memberWorkflow, /aws s3 sync[^\n]*--delete/);
  assert.match(memberWorkflow, /--exclude index\.html/);
  assert.match(memberWorkflow, /--exclude '\.well-known\/\*'/);
  assert.match(memberWorkflow, /trap rollback ERR/);
  assert.match(memberWorkflow, /restore_object index\.html/);
  assert.match(memberWorkflow, /Could not capture s3:\/\//);
  assert.match(memberWorkflow, /Automatic recovery was incomplete/);
  assert.match(memberWorkflow, /expected_index_sha=.*sha256sum/);
  assert.match(memberWorkflow, /did not return the exact released entrypoint/);
});

test("verifies direct native associations and browser-only omission", () => {
  assert.match(memberWorkflow, /--content-type 'application\/json'/);
  assert.match(memberWorkflow, /cmp --silent "apps\/member-app\/dist\/\.well-known\/\$\{key\}"/);
  assert.match(memberWorkflow, /"\$status" != "403" && "\$status" != "404"/);
  assert.match(
    memberInfrastructure,
    /request\.uri\.startsWith\('\/\.well-known\/'\)/,
  );
  assert.match(memberInfrastructure, /!associationFile/);
});

test("retains least-privilege read/write/rollback permissions", () => {
  const policy = memberDeployIdentity.match(
    /data "aws_iam_policy_document" "github_member_web_deploy" \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(policy);
  for (const action of [
    "s3:DeleteObject",
    "s3:GetObject",
    "s3:PutObject",
    "cloudfront:CreateInvalidation",
    "cloudfront:GetInvalidation",
  ]) {
    assert.match(policy, new RegExp(action));
  }
  assert.doesNotMatch(policy, /s3:\*/);
  assert.doesNotMatch(policy, /cloudfront:\*/);
});

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationDocuments,
  parseExactPublicHttpsOrigin,
  validateMemberWebDeploymentEnvironment,
  validateNativeReleaseValues,
} from "../apps/member-app/scripts/member-release-policy.mjs";

const fingerprint = Array.from({ length: 32 }, () => "AA").join(":");
const nativeValues = {
  GOGYMGO_ACCOUNT_DELETION_URL: "https://gogymgo.com/account-deletion",
  GOGYMGO_ANDROID_CERT_SHA256: fingerprint,
  GOGYMGO_ANDROID_PACKAGE: "ca.releaseowner.product",
  GOGYMGO_APP_STORE_URL:
    "https://apps.apple.com/ca/app/product/id1234567890",
  GOGYMGO_EAS_OWNER: "releaseowner",
  GOGYMGO_EAS_PROJECT_ID: "10000000-0000-4000-8000-000000000001",
  GOGYMGO_IOS_BUNDLE_ID: "ca.releaseowner.product",
  GOGYMGO_IOS_TEAM_ID: "A1B2C3D4E5",
  GOGYMGO_NATIVE_LINKS_APPROVED: "yes",
  GOGYMGO_PLAY_STORE_URL:
    "https://play.google.com/store/apps/details?id=ca.releaseowner.product",
  GOGYMGO_PRIVACY_POLICY_URL: "https://gogymgo.com/privacy",
};

test("accepts a strict browser-only staging deployment", () => {
  assert.deepEqual(
    validateMemberWebDeploymentEnvironment({
      API_URL: "https://api-staging.gogymgo.com",
      GOGYMGO_DEPLOYMENT_ENVIRONMENT: "staging",
      GOGYMGO_RELEASE_MODE: "browser-pilot",
      MEMBER_WEB_URL: "https://d111111abcdef8.cloudfront.net",
    }),
    [],
  );
});

test("requires canonical production origins and rejects decorated origins", () => {
  for (const value of [
    "http://app.gogymgo.com",
    "https://app.gogymgo.com/scan",
    "https://app.gogymgo.com/",
    "https://app.gogymgo.com:443",
    "https://user@app.gogymgo.com",
    "https://172.16.0.1",
    "https://[2001:db8::1]",
    "https://localhost",
    "https://example.com",
  ]) {
    assert.equal(parseExactPublicHttpsOrigin(value), null, value);
  }

  const issues = validateMemberWebDeploymentEnvironment({
    API_URL: "https://api-staging.gogymgo.com",
    GOGYMGO_DEPLOYMENT_ENVIRONMENT: "production",
    GOGYMGO_RELEASE_MODE: "browser-pilot",
    MEMBER_WEB_URL: "https://staging.gogymgo.com",
  });
  assert.ok(issues.some((issue) => issue.includes("https://api.gogymgo.com")));
  assert.ok(issues.some((issue) => issue.includes("https://app.gogymgo.com")));
});

test("keeps native publication fail-closed behind exact approved inputs", () => {
  assert.deepEqual(validateNativeReleaseValues(nativeValues), []);
  for (const mutation of [
    { GOGYMGO_NATIVE_LINKS_APPROVED: "true" },
    { GOGYMGO_IOS_TEAM_ID: "placeholder" },
    { GOGYMGO_ANDROID_PACKAGE: "com.gogymgo.staging" },
    {
      GOGYMGO_PLAY_STORE_URL:
        "https://play.google.com/store/apps/details?id=com.attacker.app",
    },
  ]) {
    assert.notDeepEqual(
      validateNativeReleaseValues({ ...nativeValues, ...mutation }),
      [],
    );
  }
});

test("accepts native association publication only at the canonical production target", () => {
  assert.deepEqual(
    validateMemberWebDeploymentEnvironment({
      ...nativeValues,
      API_URL: "https://api.gogymgo.com",
      GOGYMGO_DEPLOYMENT_ENVIRONMENT: "production",
      GOGYMGO_RELEASE_MODE: "native-links",
      MEMBER_WEB_URL: "https://app.gogymgo.com",
    }),
    [],
  );

  const stagingIssues = validateMemberWebDeploymentEnvironment({
    ...nativeValues,
    API_URL: "https://api-staging.gogymgo.com",
    GOGYMGO_DEPLOYMENT_ENVIRONMENT: "staging",
    GOGYMGO_RELEASE_MODE: "native-links",
    MEMBER_WEB_URL: "https://staging.gogymgo.com",
  });
  assert.ok(stagingIssues.some((issue) => issue.includes("only to")));
  assert.ok(stagingIssues.some((issue) => issue.includes("app.gogymgo.com")));
});

test("generates associations for only the canonical /scan handoff", () => {
  assert.deepEqual(buildAssociationDocuments(nativeValues), {
    android: [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "ca.releaseowner.product",
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    ios: {
      applinks: {
        apps: [],
        details: [
          {
            appID: "A1B2C3D4E5.ca.releaseowner.product",
            paths: ["/scan"],
          },
        ],
      },
    },
  });
});

test("browser-only deployments reject native release values", () => {
  const issues = validateMemberWebDeploymentEnvironment({
    ...nativeValues,
    API_URL: "https://api-staging.gogymgo.com",
    GOGYMGO_DEPLOYMENT_ENVIRONMENT: "staging",
    GOGYMGO_RELEASE_MODE: "browser-pilot",
    MEMBER_WEB_URL: "https://d111111abcdef8.cloudfront.net",
  });
  assert.ok(issues.some((issue) => issue.includes("must be omitted")));
  assert.ok(
    issues.some((issue) => issue.includes("omitted or exactly no")),
  );
  assert.ok(
    validateMemberWebDeploymentEnvironment({
      API_URL: "https://api-staging.gogymgo.com",
      GOGYMGO_DEPLOYMENT_ENVIRONMENT: "staging",
      GOGYMGO_NATIVE_LINKS_APPROVED: "true",
      GOGYMGO_RELEASE_MODE: "browser-pilot",
      MEMBER_WEB_URL: "https://d111111abcdef8.cloudfront.net",
    }).some((issue) => issue.includes("omitted or exactly no")),
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateDependencyAudit,
  validateDependencyRiskPolicy,
} from "./dependency-risk-policy.mjs";

const TODAY = "2026-08-13";

function exception(overrides = {}) {
  return {
    advisoryId: 123456,
    package: "example-package",
    url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
    severity: "high",
    scope: "build-only",
    remediation: "no-patch-available",
    patchedVersion: null,
    expiresOn: "2026-09-01",
    reason:
      "The affected parser is isolated to trusted build inputs pending an upstream release.",
    controls: [
      "Do not expose the affected build process to untrusted network clients.",
    ],
    ...overrides,
  };
}

function policy(exceptions = [exception()]) {
  return { schemaVersion: 1, maximumReviewWindowDays: 45, exceptions };
}

function report(advisoryOverrides = {}) {
  return {
    vulnerabilities: {
      "example-package": {
        via: [
          {
            source: 123456,
            dependency: "example-package",
            url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
            severity: "high",
            ...advisoryOverrides,
          },
        ],
      },
      wrapper: { via: ["example-package"] },
    },
  };
}

test("accepts exact, current exceptions and explained transitive paths", () => {
  const result = evaluateDependencyAudit(report(), policy(), { today: TODAY });
  assert.equal(result.advisoryCount, 1);
  assert.equal(result.vulnerabilityCount, 2);
});

test("rejects an advisory that does not exactly match its exception", () => {
  assert.throws(
    () =>
      evaluateDependencyAudit(report({ severity: "critical" }), policy(), {
        today: TODAY,
      }),
    /unapproved or mismatched advisories/,
  );
});

test("rejects expired exceptions", () => {
  assert.throws(
    () =>
      validateDependencyRiskPolicy(
        policy([exception({ expiresOn: "2026-08-12" })]),
        TODAY,
      ),
    /expired/,
  );
});

test("rejects exceptions with an excessive review window", () => {
  assert.throws(
    () =>
      validateDependencyRiskPolicy(
        policy([exception({ expiresOn: "2026-10-01" })]),
        TODAY,
      ),
    /exceeds the 45-day review window/,
  );
});

test("rejects stale exceptions after an advisory disappears", () => {
  assert.throws(
    () =>
      evaluateDependencyAudit({ vulnerabilities: {} }, policy(), {
        today: TODAY,
      }),
    /stale temporary exceptions/,
  );
});

test("rejects vulnerability paths that do not reach an approved advisory", () => {
  const audit = report();
  audit.vulnerabilities.orphan = { via: [] };
  assert.throws(
    () => evaluateDependencyAudit(audit, policy(), { today: TODAY }),
    /do not reach an approved advisory: orphan/,
  );
});

test("rejects missing transitive references beside an approved path", () => {
  const audit = report();
  audit.vulnerabilities.wrapper.via.push("missing-package");
  assert.throws(
    () => evaluateDependencyAudit(audit, policy(), { today: TODAY }),
    /missing vulnerability references: wrapper -> missing-package/,
  );
});

test("requires a patched version for migration-based exceptions", () => {
  assert.throws(
    () =>
      validateDependencyRiskPolicy(
        policy([
          exception({
            remediation: "upstream-migration-required",
            patchedVersion: null,
          }),
        ]),
        TODAY,
      ),
    /patchedVersion must identify the upstream fix/,
  );
});

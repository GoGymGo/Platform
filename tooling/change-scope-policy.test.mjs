import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeChangedPaths,
  evaluateChangeScope,
  validateChangePlan,
} from "./change-scope-policy.mjs";

const completePlan = `
# Coordinated release

## Outcome
Deliver one reviewed product outcome without combining unrelated maintenance.

## Boundaries
The member app, API, and admin change only at their documented public contracts.

## Rollout
Merge behind disabled capabilities, validate staging, then enable deliberately.

## Validation
Run each owning workspace check and the complete integration workflow before merge.

## Recovery
Disable the capability and revert the application change while retaining forward migrations.
`;

test("keeps an ordinary client and API change plan-free", () => {
  const result = analyzeChangedPaths([
    "apps/member-app/src/data/example.ts",
    "services/api/src/modules/example.ts",
  ]);
  assert.equal(result.requiresPlan, false);
  assert.deepEqual(result.runtimeScopes, ["api", "member-app"]);
});

test("requires a plan for three runtime owners or more than 75 files", () => {
  assert.equal(
    analyzeChangedPaths([
      "apps/admin/app/a.ts",
      "apps/member-app/app/a.ts",
      "services/api/src/a.ts",
    ]).requiresPlan,
    true,
  );
  assert.equal(
    analyzeChangedPaths(
      Array.from(
        { length: 76 },
        (_, index) => `apps/member-app/src/${index}.ts`,
      ),
    ).requiresPlan,
    true,
  );
});

test("accepts only a concrete plan with every recovery section", () => {
  assert.equal(validateChangePlan(completePlan), null);
  assert.match(validateChangePlan("## Outcome\nToo short"), /missing/i);
});

test("blocks a broad change without a plan and accepts one with a plan", () => {
  const broadPaths = [
    "apps/admin/app/a.ts",
    "apps/member-app/app/a.ts",
    "services/api/src/a.ts",
  ];
  assert.equal(evaluateChangeScope(broadPaths, () => "").issues.length, 1);
  assert.deepEqual(
    evaluateChangeScope(
      [...broadPaths, "docs/change-plans/coordinated-release.md"],
      () => completePlan,
    ).issues,
    [],
  );
});

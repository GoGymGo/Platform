import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExactCommitChecks,
  selectMergedMainPullRequest,
  selectRequiredChecks,
  validateDeploymentInputs,
} from "./deployment-source-policy.mjs";

const sourceCommit = "a".repeat(40);

test("accepts a full commit when the workflow itself runs from main", () => {
  assert.doesNotThrow(() =>
    validateDeploymentInputs({
      repository: "GoGymGo/Platform",
      sourceCommit,
      workflowRef: "refs/heads/main",
    }),
  );
});

test("rejects branch-controlled workflows and ambiguous commit identifiers", () => {
  assert.throws(
    () =>
      validateDeploymentInputs({
        repository: "GoGymGo/Platform",
        sourceCommit,
        workflowRef: "refs/heads/feature",
      }),
    /must run from refs\/heads\/main/i,
  );
  assert.throws(
    () =>
      validateDeploymentInputs({
        repository: "GoGymGo/Platform",
        sourceCommit: sourceCommit.slice(0, 12),
        workflowRef: "refs/heads/main",
      }),
    /full lowercase Git commit SHA/i,
  );
});

test("selects only the merged main pull request for the exact commit", () => {
  assert.deepEqual(
    selectMergedMainPullRequest(
      [
        {
          base: { ref: "main" },
          merge_commit_sha: sourceCommit,
          merged_at: null,
          number: 10,
        },
        {
          base: { ref: "release" },
          merge_commit_sha: sourceCommit,
          merged_at: "2026-08-13T00:00:00Z",
          number: 11,
        },
        {
          base: { ref: "main" },
          merge_commit_sha: "b".repeat(40),
          merged_at: "2026-08-13T00:00:00Z",
          number: 12,
        },
        {
          base: { ref: "main" },
          merge_commit_sha: sourceCommit,
          merged_at: "2026-08-13T00:00:00Z",
          number: 13,
        },
      ],
      sourceCommit,
    ),
    {
      base: { ref: "main" },
      merge_commit_sha: sourceCommit,
      merged_at: "2026-08-13T00:00:00Z",
      number: 13,
    },
  );
});

test("rejects commits without a merged pull request into main", () => {
  assert.equal(selectMergedMainPullRequest([], sourceCommit), null);
});

test("normalizes app-bound and legacy required check contexts", () => {
  assert.deepEqual(
    selectRequiredChecks({
      checks: [{ app_id: 15368, context: "API CI" }],
      contexts: ["API CI", "Platform Integration"],
    }),
    [
      { appId: 15368, context: "API CI" },
      { appId: null, context: "Platform Integration" },
    ],
  );
});

test("requires success on the exact commit and the configured check app", () => {
  assert.doesNotThrow(() =>
    assertExactCommitChecks({
      checkRuns: [
        {
          app: { id: 15368 },
          conclusion: "success",
          name: "API CI",
        },
      ],
      minimumContexts: ["API CI"],
      requiredChecks: [{ appId: 15368, context: "API CI" }],
      statuses: [],
    }),
  );

  for (const checkRuns of [
    [{ app: { id: 15368 }, conclusion: null, name: "API CI" }],
    [{ app: { id: 15368 }, conclusion: "failure", name: "API CI" }],
    [{ app: { id: 99999 }, conclusion: "success", name: "API CI" }],
  ]) {
    assert.throws(
      () =>
        assertExactCommitChecks({
          checkRuns,
          minimumContexts: ["API CI"],
          requiredChecks: [{ appId: 15368, context: "API CI" }],
          statuses: [],
        }),
      /missing successful required checks: API CI/i,
    );
  }
});

test("accepts a successful legacy status but refuses an empty policy", () => {
  assert.doesNotThrow(() =>
    assertExactCommitChecks({
      checkRuns: [],
      requiredChecks: [{ appId: null, context: "external/security" }],
      statuses: [{ context: "external/security", state: "success" }],
    }),
  );
  assert.throws(
    () =>
      assertExactCommitChecks({
        checkRuns: [],
        requiredChecks: [],
        statuses: [],
      }),
    /no discoverable required status checks/i,
  );
});

test("allows a non-triggered path check but rejects emitted pending checks", () => {
  const requiredChecks = [
    { appId: 15368, context: "api-quality" },
    { appId: 15368, context: "codeql-analysis" },
  ];
  const successfulBaseline = {
    app: { id: 15368 },
    conclusion: "success",
    name: "codeql-analysis",
  };

  assert.doesNotThrow(() =>
    assertExactCommitChecks({
      checkRuns: [successfulBaseline],
      minimumContexts: ["codeql-analysis"],
      requiredChecks,
      statuses: [],
    }),
  );
  assert.throws(
    () =>
      assertExactCommitChecks({
        checkRuns: [
          successfulBaseline,
          { app: { id: 15368 }, conclusion: null, name: "api-quality" },
        ],
        minimumContexts: ["codeql-analysis"],
        requiredChecks,
        statuses: [],
      }),
    /missing successful required checks: api-quality/i,
  );
});

test("fails closed when an always-on exact-main check leaves protection", () => {
  assert.throws(
    () =>
      assertExactCommitChecks({
        checkRuns: [],
        minimumContexts: ["contracts-and-local-stack"],
        requiredChecks: [{ appId: 15368, context: "api-quality" }],
        statuses: [],
      }),
    /baseline checks are not required on main/i,
  );
});

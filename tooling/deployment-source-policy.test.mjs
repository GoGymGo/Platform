import assert from "node:assert/strict";
import test from "node:test";
import {
  selectMergedMainPullRequest,
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

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const FULL_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
export const EXACT_COMMIT_BASELINE_CONTEXTS = [
  "codeql-analysis",
  "contracts-and-local-stack",
];

export function validateDeploymentInputs({
  repository,
  sourceCommit,
  workflowRef,
}) {
  if (workflowRef !== "refs/heads/main") {
    throw new Error(
      `Deployment workflows must run from refs/heads/main; received ${workflowRef || "an empty ref"}.`,
    );
  }
  if (!FULL_COMMIT_PATTERN.test(sourceCommit)) {
    throw new Error("source_commit must be a full lowercase Git commit SHA.");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must use the owner/name form.");
  }
}

export function selectMergedMainPullRequest(pullRequests, sourceCommit) {
  const candidates = pullRequests
    .filter(
      (pullRequest) =>
        pullRequest?.base?.ref === "main" &&
        typeof pullRequest.merged_at === "string" &&
        pullRequest.merge_commit_sha === sourceCommit &&
        Number.isSafeInteger(pullRequest.number),
    )
    .sort((left, right) => left.merged_at.localeCompare(right.merged_at));

  return candidates.at(-1) ?? null;
}

export function selectRequiredChecks(requiredStatusChecks) {
  const selected = new Map();
  for (const check of requiredStatusChecks?.checks ?? []) {
    if (typeof check?.context !== "string" || check.context.length === 0)
      continue;
    selected.set(check.context, {
      appId: Number.isSafeInteger(check.app_id) ? check.app_id : null,
      context: check.context,
    });
  }
  for (const context of requiredStatusChecks?.contexts ?? []) {
    if (typeof context !== "string" || context.length === 0) continue;
    if (!selected.has(context)) selected.set(context, { appId: null, context });
  }
  return [...selected.values()].sort((left, right) =>
    left.context.localeCompare(right.context),
  );
}

export function assertExactCommitChecks({
  checkRuns,
  minimumContexts = [],
  requiredChecks,
  statuses,
}) {
  if (requiredChecks.length === 0) {
    throw new Error(
      "The main branch has no discoverable required status checks; refusing to authorize a deployment.",
    );
  }

  const requiredToVerify = requiredChecks.filter(({ appId, context }) => {
    if (minimumContexts.includes(context)) return true;
    return (
      checkRuns.some(
        (checkRun) =>
          checkRun?.name === context &&
          (appId === null || appId === -1 || checkRun?.app?.id === appId),
      ) ||
      ((appId === null || appId === -1) &&
        statuses.some((status) => status?.context === context))
    );
  });
  const missingBaseline = minimumContexts.filter(
    (context) => !requiredChecks.some((check) => check.context === context),
  );
  if (missingBaseline.length > 0) {
    throw new Error(
      `Exact-commit baseline checks are not required on main: ${missingBaseline.join(", ")}.`,
    );
  }

  const missing = requiredToVerify.filter(({ appId, context }) => {
    const successfulCheckRun = checkRuns.some(
      (checkRun) =>
        checkRun?.name === context &&
        checkRun.conclusion === "success" &&
        (appId === null || appId === -1 || checkRun?.app?.id === appId),
    );
    if (successfulCheckRun) return false;
    if (appId !== null && appId !== -1) return true;
    return !statuses.some(
      (status) => status?.context === context && status.state === "success",
    );
  });

  if (missing.length > 0) {
    throw new Error(
      `Exact source commit is missing successful required checks: ${missing
        .map(({ context }) => context)
        .join(", ")}.`,
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
  return result.stdout ?? "";
}

export function authorizeDeploymentSource({
  repository = process.env.GITHUB_REPOSITORY ?? "",
  sourceCommit = process.argv[2] ?? "",
  workflowRef = process.env.GITHUB_REF ?? "",
} = {}) {
  validateDeploymentInputs({ repository, sourceCommit, workflowRef });

  run("git", ["cat-file", "-e", `${sourceCommit}^{commit}`]);
  run("git", ["merge-base", "--is-ancestor", sourceCommit, "HEAD"]);

  const response = run(
    "gh",
    [
      "api",
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${repository}/commits/${sourceCommit}/pulls?per_page=100`,
    ],
    { capture: true },
  );
  const pullRequest = selectMergedMainPullRequest(
    JSON.parse(response),
    sourceCommit,
  );
  if (!pullRequest) {
    throw new Error(
      `Commit ${sourceCommit} is not the merge commit of a pull request into main.`,
    );
  }

  run("gh", [
    "pr",
    "checks",
    String(pullRequest.number),
    "--repo",
    repository,
    "--required",
  ]);

  const requiredStatusChecks = JSON.parse(
    run(
      "gh",
      [
        "api",
        "-H",
        "Accept: application/vnd.github+json",
        `repos/${repository}/branches/main/protection/required_status_checks`,
      ],
      { capture: true },
    ),
  );
  const checkRunsResponse = JSON.parse(
    run(
      "gh",
      [
        "api",
        "-H",
        "Accept: application/vnd.github+json",
        `repos/${repository}/commits/${sourceCommit}/check-runs?filter=latest&per_page=100`,
      ],
      { capture: true },
    ),
  );
  if (checkRunsResponse.total_count > 100) {
    throw new Error(
      "Exact source commit has more than 100 check runs; refusing an incomplete authorization query.",
    );
  }
  const combinedStatus = JSON.parse(
    run(
      "gh",
      [
        "api",
        "-H",
        "Accept: application/vnd.github+json",
        `repos/${repository}/commits/${sourceCommit}/status?per_page=100`,
      ],
      { capture: true },
    ),
  );
  assertExactCommitChecks({
    checkRuns: checkRunsResponse.check_runs ?? [],
    minimumContexts: EXACT_COMMIT_BASELINE_CONTEXTS,
    requiredChecks: selectRequiredChecks(requiredStatusChecks),
    statuses: combinedStatus.statuses ?? [],
  });
  console.log(
    `Authorized ${sourceCommit} from merged PR #${pullRequest.number}; all required PR checks, always-on exact-main checks, and emitted path-scoped exact-main checks passed.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  authorizeDeploymentSource();
}

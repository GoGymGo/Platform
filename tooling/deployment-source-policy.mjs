import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const FULL_COMMIT_PATTERN = /^[0-9a-f]{40}$/;

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
  console.log(
    `Authorized ${sourceCommit} from merged PR #${pullRequest.number}; all currently required checks passed.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  authorizeDeploymentSource();
}

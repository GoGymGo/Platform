import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RUNTIME_SCOPES = new Map([
  ["apps/admin/", "admin"],
  ["apps/landing/", "landing"],
  ["apps/member-app/", "member-app"],
  ["services/api/", "api"],
]);

const REQUIRED_PLAN_SECTIONS = [
  "## Outcome",
  "## Boundaries",
  "## Rollout",
  "## Validation",
  "## Recovery",
];

function normalized(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function analyzeChangedPaths(changedPaths) {
  const paths = [...new Set(changedPaths.map(normalized).filter(Boolean))];
  const runtimeScopes = new Set();
  for (const filePath of paths) {
    for (const [prefix, scope] of RUNTIME_SCOPES) {
      if (filePath.startsWith(prefix)) runtimeScopes.add(scope);
    }
  }
  const planPaths = paths.filter(
    (filePath) =>
      filePath.startsWith("docs/change-plans/") &&
      filePath.endsWith(".md") &&
      !filePath.endsWith("/README.md"),
  );
  const reasons = [];
  if (runtimeScopes.size > 2) {
    reasons.push(`${runtimeScopes.size} runtime owners are changed`);
  }
  if (paths.length > 75) reasons.push(`${paths.length} files are changed`);
  return {
    paths,
    planPaths,
    reasons,
    requiresPlan: reasons.length > 0,
    runtimeScopes: [...runtimeScopes].sort(),
  };
}

export function validateChangePlan(planText) {
  const missingSections = REQUIRED_PLAN_SECTIONS.filter(
    (section) => !planText.includes(section),
  );
  if (missingSections.length > 0) {
    return `change plan is missing ${missingSections.join(", ")}`;
  }
  for (const section of REQUIRED_PLAN_SECTIONS) {
    const start = planText.indexOf(section) + section.length;
    const nextHeading = planText.indexOf("\n## ", start);
    const content = planText
      .slice(start, nextHeading === -1 ? undefined : nextHeading)
      .trim();
    if (content.length < 20)
      return `${section} must contain a concrete explanation`;
  }
  return null;
}

export function evaluateChangeScope(changedPaths, readPlan) {
  const analysis = analyzeChangedPaths(changedPaths);
  const issues = [];
  if (analysis.requiresPlan && analysis.planPaths.length === 0) {
    issues.push(
      `broad change requires one plan under docs/change-plans/ because ${analysis.reasons.join(" and ")}.`,
    );
  }
  for (const planPath of analysis.planPaths) {
    const issue = validateChangePlan(readPlan(planPath));
    if (issue) issues.push(`${planPath}: ${issue}.`);
  }
  return { ...analysis, issues };
}

function changedPathsSince(baseCommit) {
  const result = spawnSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseCommit}...HEAD`],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "git diff failed");
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const baseCommit = process.argv[2] ?? "";
  if (!/^[0-9a-f]{40}$/.test(baseCommit)) {
    throw new Error(
      "Pass the pull request base as a full lowercase commit SHA.",
    );
  }
  const result = evaluateChangeScope(
    changedPathsSince(baseCommit),
    (planPath) => readFileSync(planPath, "utf8"),
  );
  const owners = result.runtimeScopes.length
    ? result.runtimeScopes.join(", ")
    : "no runtime owners";
  console.log(
    `Change scope: ${result.paths.length} files across ${owners}; plan ${result.requiresPlan ? "required" : "not required"}.`,
  );
  if (result.issues.length > 0) {
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  }
}

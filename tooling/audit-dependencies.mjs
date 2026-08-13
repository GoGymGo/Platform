import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { evaluateDependencyAudit } from "./dependency-risk-policy.mjs";

const repositoryRoot = new URL("../", import.meta.url);
const policy = JSON.parse(
  readFileSync(
    new URL("config/dependency-risk-exceptions.json", repositoryRoot),
    "utf8",
  ),
);

function fail(message) {
  console.error(`Dependency audit failed: ${message}`);
  process.exitCode = 1;
}

function runAudit() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error(
      "Run this check through npm so the npm executable is known.",
    );
  }
  const result = spawnSync(process.execPath, [npmCli, "audit", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!result.stdout.trim()) {
    throw new Error(result.stderr.trim() || "npm audit returned no report.");
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      result.stderr.trim() || `npm audit exited with status ${result.status}.`,
    );
  }
  return JSON.parse(result.stdout);
}

try {
  const result = evaluateDependencyAudit(runAudit(), policy);
  console.log(
    `Dependency audit passed: ${result.vulnerabilityCount} reported paths resolve to ${result.advisoryCount} exact temporary exceptions.`,
  );
  for (const exception of result.exceptions) {
    console.log(
      `- ${exception.advisoryId} ${exception.package} (${exception.scope}; expires ${exception.expiresOn})`,
    );
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

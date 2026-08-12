import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const policy = JSON.parse(
  readFileSync(
    new URL("../config/dependency-audit-exceptions.json", import.meta.url),
    "utf8",
  ),
);

function fail(message) {
  console.error(`Admin dependency audit failed: ${message}`);
  process.exitCode = 1;
}

function runAudit() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error("Run this check through npm so the npm executable is known.");
  }

  const result = spawnSync(
    process.execPath,
    [
      npmCli,
      "audit",
      "--workspace",
      "@gogymgo/admin",
      "--json",
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );
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

function matchesException(advisory, exception, today) {
  return (
    String(advisory.source) === String(exception.advisoryId) &&
    advisory.dependency === exception.package &&
    advisory.url === exception.url &&
    exception.scope === "build-only" &&
    today <= exception.expiresOn
  );
}

function compareVersions(left, right) {
  const parts = (version) =>
    String(version)
      .replace(/^v/, "")
      .split("-", 1)[0]
      .split(".")
      .map((value) => Number(value) || 0);
  const leftParts = parts(left);
  const rightParts = parts(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function installedVersion(packageName) {
  const packageJson = JSON.parse(
    readFileSync(
      new URL(`../../../node_modules/${packageName}/package.json`, import.meta.url),
      "utf8",
    ),
  );
  return packageJson.version;
}

function auditReport(report) {
  const vulnerabilities = report.vulnerabilities ?? {};
  if (Object.keys(vulnerabilities).length === 0) {
    console.log("Admin dependency audit passed with no known vulnerabilities.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const expired = policy.exceptions.filter(
    (exception) => today > exception.expiresOn,
  );
  if (expired.length > 0) {
    fail(
      `temporary exception${expired.length === 1 ? "" : "s"} ${expired
        .map((exception) => exception.advisoryId)
        .join(", ")} expired. Upgrade or reassess the affected dependency.`,
    );
    return;
  }

  const upgradeFixes = Object.values(vulnerabilities).flatMap(
    (vulnerability) => {
      const fix = vulnerability.fixAvailable;
      if (!fix || typeof fix !== "object") return [];
      const currentVersion = installedVersion(fix.name);
      return compareVersions(fix.version, currentVersion) > 0
        ? [`${fix.name} ${currentVersion} -> ${fix.version}`]
        : [];
    },
  );
  if (upgradeFixes.length > 0) {
    fail(
      `an upstream remediation is available: ${[...new Set(upgradeFixes)].join(", ")}. Upgrade and remove the temporary exception.`,
    );
    return;
  }

  const approvedAdvisories = new Map();
  const unapprovedAdvisories = [];
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === "string") continue;
      const exception = policy.exceptions.find((candidate) =>
        matchesException(via, candidate, today),
      );
      if (exception) {
        approvedAdvisories.set(String(via.source), exception);
      } else {
        unapprovedAdvisories.push(`${via.source} (${packageName})`);
      }
    }
  }

  if (unapprovedAdvisories.length > 0) {
    fail(`unapproved advisories found: ${unapprovedAdvisories.join(", ")}.`);
    return;
  }

  const reachability = new Map();
  function reachesApprovedAdvisory(packageName, visiting = new Set()) {
    if (reachability.has(packageName)) return reachability.get(packageName);
    if (visiting.has(packageName)) return false;
    const vulnerability = vulnerabilities[packageName];
    if (!vulnerability) return false;

    const nextVisiting = new Set(visiting).add(packageName);
    const reachesApproved = (vulnerability.via ?? []).some((via) => {
      if (typeof via !== "string") {
        return approvedAdvisories.has(String(via.source));
      }
      return reachesApprovedAdvisory(via, nextVisiting);
    });
    reachability.set(packageName, reachesApproved);
    return reachesApproved;
  }

  const unexplained = Object.keys(vulnerabilities).filter(
    (packageName) => !reachesApprovedAdvisory(packageName),
  );
  if (unexplained.length > 0) {
    fail(
      `vulnerabilities are not explained by the approved advisories: ${unexplained.join(", ")}.`,
    );
    return;
  }

  if (approvedAdvisories.size === 0) {
    fail("vulnerabilities were reported without a recognized advisory.");
    return;
  }

  const approvals = [...approvedAdvisories.values()];
  console.log(
    `Admin build-tool audit passed with ${approvals.length} temporary image-size exceptions: ${approvals
      .map(
        (exception) =>
          `${exception.advisoryId} (expires ${exception.expiresOn})`,
      )
      .join(", ")}.`,
  );
}

try {
  auditReport(runAudit());
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

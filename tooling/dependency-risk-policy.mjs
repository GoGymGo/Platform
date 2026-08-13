const ALLOWED_SEVERITIES = new Set(["low", "moderate", "high", "critical"]);
const ALLOWED_SCOPES = new Set(["build-only", "api-transitive"]);
const ALLOWED_REMEDIATIONS = new Set([
  "no-patch-available",
  "upstream-migration-required",
]);
const EXCEPTION_KEYS = new Set([
  "advisoryId",
  "package",
  "url",
  "severity",
  "scope",
  "remediation",
  "patchedVersion",
  "expiresOn",
  "reason",
  "controls",
]);

function policyError(message) {
  throw new Error(`Dependency risk policy failed: ${message}`);
}

function parseIsoDate(value, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    policyError(`${fieldName} must be an ISO date (YYYY-MM-DD).`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    policyError(`${fieldName} is not a real calendar date.`);
  }
  return parsed;
}

export function validateDependencyRiskPolicy(policy, today) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    policyError("the policy must be a JSON object.");
  }
  if (policy.schemaVersion !== 1) {
    policyError("schemaVersion must be 1.");
  }
  if (
    !Number.isInteger(policy.maximumReviewWindowDays) ||
    policy.maximumReviewWindowDays < 1 ||
    policy.maximumReviewWindowDays > 90
  ) {
    policyError(
      "maximumReviewWindowDays must be an integer from 1 through 90.",
    );
  }
  if (!Array.isArray(policy.exceptions)) {
    policyError("exceptions must be an array.");
  }

  const todayDate = parseIsoDate(today, "today");
  const ids = new Set();
  for (const [index, exception] of policy.exceptions.entries()) {
    const label = `exceptions[${index}]`;
    if (
      !exception ||
      typeof exception !== "object" ||
      Array.isArray(exception)
    ) {
      policyError(`${label} must be an object.`);
    }
    const unexpectedKeys = Object.keys(exception).filter(
      (key) => !EXCEPTION_KEYS.has(key),
    );
    const missingKeys = [...EXCEPTION_KEYS].filter(
      (key) => !Object.hasOwn(exception, key),
    );
    if (unexpectedKeys.length > 0 || missingKeys.length > 0) {
      policyError(
        `${label} has an invalid shape (missing: ${missingKeys.join(", ") || "none"}; unexpected: ${unexpectedKeys.join(", ") || "none"}).`,
      );
    }
    if (!Number.isInteger(exception.advisoryId) || exception.advisoryId < 1) {
      policyError(`${label}.advisoryId must be a positive integer.`);
    }
    if (ids.has(exception.advisoryId)) {
      policyError(
        `advisory ${exception.advisoryId} is approved more than once.`,
      );
    }
    ids.add(exception.advisoryId);
    if (typeof exception.package !== "string" || exception.package.length < 1) {
      policyError(`${label}.package must be a package name.`);
    }
    if (
      typeof exception.url !== "string" ||
      !/^https:\/\/github\.com\/advisories\/GHSA-[\w-]+$/.test(exception.url)
    ) {
      policyError(`${label}.url must be a GitHub advisory URL.`);
    }
    if (!ALLOWED_SEVERITIES.has(exception.severity)) {
      policyError(`${label}.severity is not recognized.`);
    }
    if (!ALLOWED_SCOPES.has(exception.scope)) {
      policyError(`${label}.scope is not recognized.`);
    }
    if (!ALLOWED_REMEDIATIONS.has(exception.remediation)) {
      policyError(`${label}.remediation is not recognized.`);
    }
    if (
      exception.remediation === "no-patch-available" &&
      exception.patchedVersion !== null
    ) {
      policyError(`${label}.patchedVersion must be null when no patch exists.`);
    }
    if (
      exception.remediation === "upstream-migration-required" &&
      (typeof exception.patchedVersion !== "string" ||
        exception.patchedVersion.length < 1)
    ) {
      policyError(`${label}.patchedVersion must identify the upstream fix.`);
    }
    if (typeof exception.reason !== "string" || exception.reason.length < 40) {
      policyError(`${label}.reason must contain a substantive rationale.`);
    }
    if (
      !Array.isArray(exception.controls) ||
      exception.controls.length < 1 ||
      exception.controls.some(
        (control) => typeof control !== "string" || control.length < 20,
      )
    ) {
      policyError(
        `${label}.controls must list substantive compensating controls.`,
      );
    }

    const expiry = parseIsoDate(exception.expiresOn, `${label}.expiresOn`);
    const daysUntilExpiry = Math.ceil(
      (expiry.valueOf() - todayDate.valueOf()) / 86_400_000,
    );
    if (daysUntilExpiry < 0) {
      policyError(
        `temporary exception ${exception.advisoryId} expired on ${exception.expiresOn}.`,
      );
    }
    if (daysUntilExpiry > policy.maximumReviewWindowDays) {
      policyError(
        `temporary exception ${exception.advisoryId} exceeds the ${policy.maximumReviewWindowDays}-day review window.`,
      );
    }
  }

  return new Map(
    policy.exceptions.map((exception) => [
      String(exception.advisoryId),
      exception,
    ]),
  );
}

function advisoryMatchesException(advisory, exception) {
  return (
    advisory.dependency === exception.package &&
    advisory.url === exception.url &&
    advisory.severity === exception.severity
  );
}

export function evaluateDependencyAudit(report, policy, { today } = {}) {
  const effectiveToday = today ?? new Date().toISOString().slice(0, 10);
  const exceptionsById = validateDependencyRiskPolicy(policy, effectiveToday);
  const vulnerabilities = report?.vulnerabilities ?? {};
  const vulnerabilityNames = Object.keys(vulnerabilities);

  if (vulnerabilityNames.length === 0) {
    if (exceptionsById.size > 0) {
      policyError("the audit is clean but stale temporary exceptions remain.");
    }
    return { advisoryCount: 0, vulnerabilityCount: 0, exceptions: [] };
  }

  const missingReferences = [];
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === "string" && !Object.hasOwn(vulnerabilities, via)) {
        missingReferences.push(`${packageName} -> ${via}`);
      }
    }
  }
  if (missingReferences.length > 0) {
    policyError(
      `the audit contains missing vulnerability references: ${missingReferences.join(", ")}.`,
    );
  }

  const approved = new Map();
  const unexpected = [];
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === "string") continue;
      const id = String(via.source);
      const exception = exceptionsById.get(id);
      if (!exception || !advisoryMatchesException(via, exception)) {
        unexpected.push(`${id} (${packageName})`);
        continue;
      }
      approved.set(id, exception);
    }
  }
  if (unexpected.length > 0) {
    policyError(
      `unapproved or mismatched advisories found: ${unexpected.join(", ")}.`,
    );
  }

  const unused = [...exceptionsById.keys()].filter((id) => !approved.has(id));
  if (unused.length > 0) {
    policyError(
      `stale temporary exceptions are no longer reported: ${unused.join(", ")}.`,
    );
  }

  const reachability = new Map();
  function reachesApprovedAdvisory(packageName, visiting = new Set()) {
    if (reachability.has(packageName)) return reachability.get(packageName);
    if (visiting.has(packageName)) return false;
    const vulnerability = vulnerabilities[packageName];
    if (!vulnerability) return false;

    const nextVisiting = new Set(visiting).add(packageName);
    const result = (vulnerability.via ?? []).some((via) => {
      if (typeof via !== "string") return approved.has(String(via.source));
      return reachesApprovedAdvisory(via, nextVisiting);
    });
    reachability.set(packageName, result);
    return result;
  }

  const unexplained = vulnerabilityNames.filter(
    (packageName) => !reachesApprovedAdvisory(packageName),
  );
  if (unexplained.length > 0) {
    policyError(
      `vulnerability paths do not reach an approved advisory: ${unexplained.join(", ")}.`,
    );
  }

  return {
    advisoryCount: approved.size,
    vulnerabilityCount: vulnerabilityNames.length,
    exceptions: [...approved.values()],
  };
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const commitPattern = /^[0-9a-f]{40}$/;
const releaseModes = new Set(["browser-pilot", "native-links"]);

export function createStaticExportAttestation(
  exportRoot,
  { apiOrigin, releaseMode, sourceCommit },
) {
  if (!commitPattern.test(sourceCommit)) {
    throw new Error("sourceCommit must be a full lowercase Git commit SHA.");
  }
  if (!releaseModes.has(releaseMode)) {
    throw new Error("releaseMode must be browser-pilot or native-links.");
  }
  if (!isExactHttpsOrigin(apiOrigin)) {
    throw new Error("apiOrigin must be an exact HTTPS origin.");
  }

  const files = collectFiles(path.resolve(exportRoot));
  if (!files.some((file) => file.path === "index.html")) {
    throw new Error("The static export must contain index.html.");
  }
  const digestInput = files
    .map((file) => `${file.sha256}\t${file.size}\t${file.path}`)
    .join("\n");

  return {
    apiOrigin,
    artifactSha256: sha256(digestInput),
    fileCount: files.length,
    files,
    releaseMode,
    schemaVersion: 1,
    sourceCommit,
  };
}

export function verifyStaticExportAttestation(exportRoot, expected) {
  const actual = createStaticExportAttestation(exportRoot, {
    apiOrigin: expected.apiOrigin,
    releaseMode: expected.releaseMode,
    sourceCommit: expected.sourceCommit,
  });
  assert.deepEqual(actual, expected);
  return actual;
}

function collectFiles(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Static export directory does not exist: ${root}`);
  }
  const files = [];
  walk(root, root, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function walk(root, directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Static exports must not contain symbolic links: ${relativePath(root, entryPath)}`,
      );
    }
    if (entry.isDirectory()) {
      walk(root, entryPath, files);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(
        `Static exports may contain only regular files: ${relativePath(root, entryPath)}`,
      );
    }
    const contents = fs.readFileSync(entryPath);
    files.push({
      path: relativePath(root, entryPath),
      sha256: sha256(contents),
      size: contents.byteLength,
    });
  }
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isExactHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return (
      value === url.origin &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.includes(".") &&
      !url.hostname.startsWith("[") &&
      !/^[0-9.]+$/.test(url.hostname) &&
      !/(?:^|\.)(?:local|localhost)$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [command, exportRoot, attestationPath, sourceCommit, releaseMode, apiOrigin] =
    process.argv.slice(2);
  if (
    !["create", "verify"].includes(command) ||
    !exportRoot ||
    !attestationPath ||
    !sourceCommit ||
    !releaseMode ||
    !apiOrigin
  ) {
    throw new Error(
      "Usage: static-export-attestation.mjs <create|verify> <export-root> <attestation-path> <source-commit> <release-mode> <api-origin>",
    );
  }

  if (command === "create") {
    const attestation = createStaticExportAttestation(exportRoot, {
      apiOrigin,
      releaseMode,
      sourceCommit,
    });
    fs.writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);
    console.log(
      `Static export attested: ${attestation.fileCount} files, ${attestation.artifactSha256}.`,
    );
  } else {
    const attestation = JSON.parse(fs.readFileSync(attestationPath, "utf8"));
    if (
      attestation.sourceCommit !== sourceCommit ||
      attestation.releaseMode !== releaseMode ||
      attestation.apiOrigin !== apiOrigin
    ) {
      throw new Error("Attestation metadata does not match the requested release.");
    }
    const verified = verifyStaticExportAttestation(exportRoot, attestation);
    console.log(
      `Static export attestation verified: ${verified.fileCount} files, ${verified.artifactSha256}.`,
    );
  }
}

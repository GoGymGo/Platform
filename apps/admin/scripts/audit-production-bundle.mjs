import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const bundleDirectory = resolve(process.argv[2] ?? "dist");
const textExtensions = new Set([".cjs", ".js", ".json", ".mjs"]);
const vulnerableParserMarkers = [
  "Invalid ICNS, no sizes found",
  "Invalid HEIF, no sizes found",
  "No codestream found in JXL container",
  "ICON_TYPE_SIZE",
];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const pathname = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(pathname) : [pathname];
  });
}

function fail(message) {
  console.error(`Admin production-bundle audit failed: ${message}`);
  process.exitCode = 1;
}

try {
  if (!statSync(bundleDirectory).isDirectory()) {
    throw new Error(`${bundleDirectory} is not a build directory.`);
  }

  const bundleFiles = filesUnder(bundleDirectory).filter((pathname) =>
    textExtensions.has(extname(pathname)),
  );
  if (bundleFiles.length === 0) {
    throw new Error(`${bundleDirectory} contains no deployable code files.`);
  }

  const findings = [];
  for (const pathname of bundleFiles) {
    const content = readFileSync(pathname, "utf8");
    const marker = vulnerableParserMarkers.find((candidate) =>
      content.includes(candidate),
    );
    if (marker) findings.push(`${pathname} (${marker})`);
  }

  if (findings.length > 0) {
    fail(
      `the vulnerable image-size parser became reachable in the deployable artifact: ${findings.join(", ")}.`,
    );
  } else {
    console.log(
      `Admin production-bundle audit passed: ${bundleFiles.length} deployable code files contain no vulnerable image-size parser.`,
    );
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

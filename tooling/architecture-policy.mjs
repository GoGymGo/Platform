import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);

export const BOUNDARIES = [
  {
    name: "admin",
    packageName: "@gogymgo/admin",
    packageRoot: "apps/admin",
    roots: ["apps/admin/app", "apps/admin/worker"],
    allowedWorkspacePackages: ["@gogymgo/brand", "@gogymgo/contracts"],
  },
  {
    name: "landing",
    packageName: "@gogymgo/landing",
    packageRoot: "apps/landing",
    roots: ["apps/landing/app", "apps/landing/worker"],
    allowedWorkspacePackages: ["@gogymgo/brand"],
  },
  {
    name: "member-app",
    packageName: "@gogymgo/member-app",
    packageRoot: "apps/member-app",
    roots: [
      "apps/member-app/app",
      "apps/member-app/plugins",
      "apps/member-app/src",
    ],
    allowedWorkspacePackages: ["@gogymgo/brand", "@gogymgo/contracts"],
  },
  {
    name: "api",
    packageName: "@gogymgo/api",
    packageRoot: "services/api",
    roots: ["services/api/src"],
    allowedWorkspacePackages: [],
  },
  {
    name: "brand",
    packageName: "@gogymgo/brand",
    packageRoot: "packages/brand",
    roots: ["packages/brand/src"],
    allowedWorkspacePackages: [],
  },
  {
    name: "contracts",
    packageName: "@gogymgo/contracts",
    packageRoot: "packages/contracts",
    roots: ["packages/contracts/src"],
    allowedWorkspacePackages: [],
  },
];

const APPROVED_CROSS_BOUNDARY_IMPORTS = new Map([
  [
    "apps/member-app/src/constants/legal.ts=>services/api/config/legal/public-ca-bc-en.json",
    "The API-owned public legal bundle is embedded into the offline member fallback at build time.",
  ],
]);

function normalizeRepositoryPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function classifyRepositoryPath(filePath) {
  const normalized = normalizeRepositoryPath(filePath);
  return (
    BOUNDARIES.find(
      (boundary) =>
        normalized === boundary.packageRoot ||
        normalized.startsWith(`${boundary.packageRoot}/`),
    ) ?? null
  );
}

export function extractImportSpecifiers(sourceText) {
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;'"`]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

export function evaluateImport({ importer, specifier }) {
  const normalizedImporter = normalizeRepositoryPath(importer);
  const sourceBoundary = classifyRepositoryPath(normalizedImporter);
  if (!sourceBoundary) return null;

  if (specifier.startsWith("@gogymgo/")) {
    if (
      sourceBoundary.allowedWorkspacePackages.some(
        (packageName) =>
          specifier === packageName || specifier.startsWith(`${packageName}/`),
      )
    ) {
      return null;
    }
    return `${normalizedImporter}: ${sourceBoundary.name} may not import workspace package ${specifier}.`;
  }

  if (specifier === "@" || specifier.startsWith("@/")) return null;
  if (!specifier.startsWith(".")) return null;

  const target = path.posix.normalize(
    path.posix.join(path.posix.dirname(normalizedImporter), specifier),
  );
  if (target === ".." || target.startsWith("../")) {
    return `${normalizedImporter}: relative import ${specifier} escapes the repository.`;
  }

  const targetBoundary = classifyRepositoryPath(target);
  if (targetBoundary?.name === sourceBoundary.name) return null;

  const exceptionKey = `${normalizedImporter}=>${target}`;
  if (APPROVED_CROSS_BOUNDARY_IMPORTS.has(exceptionKey)) return null;

  if (!targetBoundary) {
    if (
      target.startsWith("apps/") ||
      target.startsWith("services/") ||
      target.startsWith("packages/")
    ) {
      return `${normalizedImporter}: relative import ${specifier} reaches non-public source ${target}.`;
    }
    return null;
  }

  return `${normalizedImporter}: ${sourceBoundary.name} may not import ${targetBoundary.name} source via ${specifier}.`;
}

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

export function validateWorkspaceDependencies(manifests) {
  const knownPackages = new Set(
    BOUNDARIES.map((boundary) => boundary.packageName),
  );
  const boundariesByPackage = new Map(
    BOUNDARIES.map((boundary) => [boundary.packageName, boundary]),
  );
  const issues = [];

  for (const manifest of manifests) {
    const boundary = boundariesByPackage.get(manifest.name);
    if (!boundary) continue;
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };
    for (const dependency of Object.keys(dependencies)) {
      if (
        knownPackages.has(dependency) &&
        !boundary.allowedWorkspacePackages.includes(dependency)
      ) {
        issues.push(
          `${manifest.name}: workspace dependency ${dependency} is outside its allowed boundary.`,
        );
      }
    }
  }
  return issues;
}

export function auditArchitecture(repositoryRoot = process.cwd()) {
  const issues = [];
  let sourceFileCount = 0;
  for (const boundary of BOUNDARIES) {
    for (const root of boundary.roots) {
      const absoluteRoot = path.join(repositoryRoot, root);
      let files;
      try {
        files = collectSourceFiles(absoluteRoot);
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      for (const absoluteFile of files) {
        sourceFileCount += 1;
        const importer = normalizeRepositoryPath(
          path.relative(repositoryRoot, absoluteFile),
        );
        const sourceText = readFileSync(absoluteFile, "utf8");
        for (const specifier of extractImportSpecifiers(sourceText)) {
          const issue = evaluateImport({ importer, specifier });
          if (issue) issues.push(issue);
        }
      }
    }
  }

  const manifests = BOUNDARIES.map((boundary) =>
    JSON.parse(
      readFileSync(
        path.join(repositoryRoot, boundary.packageRoot, "package.json"),
        "utf8",
      ),
    ),
  );
  issues.push(...validateWorkspaceDependencies(manifests));
  return { issues, sourceFileCount };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = auditArchitecture();
  if (result.issues.length > 0) {
    console.error("Architecture boundary audit failed:");
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Architecture boundary audit passed: ${result.sourceFileCount} runtime source files remain inside six declared owners.`,
    );
  }
}

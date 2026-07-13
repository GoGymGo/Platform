import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceFiles = ['app', 'src']
  .flatMap((directory) => collectFiles(path.join(projectRoot, directory)))
  .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
  .filter((filePath) => !/\.test\.(ts|tsx)$/.test(filePath));
const issues = [];
const forbiddenSourceTokens = [
  '@/mocks',
  'EXPO_PUBLIC_ENABLE_ONBOARDING_PREVIEW',
  'FRONTEND PREVIEW',
  'local-preview',
  "mode === 'demo'",
  "mode: 'demo'",
  'PREVIEW APP FLOW',
  'sessionTimeScale'
];

for (const filePath of sourceFiles) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const relativePath = toRelativePath(filePath);

  for (const token of forbiddenSourceTokens) {
    if (sourceText.includes(token)) {
      issues.push(`${relativePath}: forbidden production token ${JSON.stringify(token)}`);
    }
  }
}

const routedSourceFiles = collectFiles(path.join(projectRoot, 'app'))
  .filter((filePath) => /\.(ts|tsx)$/.test(filePath));
for (const filePath of routedSourceFiles) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const relativePath = toRelativePath(filePath);

  for (const token of ['markMidSessionVerified(', 'startWorkoutSession(']) {
    if (sourceText.includes(token)) {
      issues.push(`${relativePath}: simulated verification action ${JSON.stringify(token)}`);
    }
  }
}

for (const forbiddenPath of [
  'app/(preview)',
  'src/config/runtime.ts',
  'src/mocks'
]) {
  const absolutePath = path.join(projectRoot, forbiddenPath);
  if (fs.existsSync(absolutePath) && collectFiles(absolutePath).length > 0) {
    issues.push(`${forbiddenPath}: preview or mock runtime source must not ship`);
  }
}

const fallbackChecks = [
  ['src/services/creatorApplication.ts', 'createUserStorage'],
  ['src/services/gymRegistration.ts', 'Promise.resolve({'],
  ['src/services/payouts.ts', 'claim.portalUrl'],
  ['src/services/sponsorApplication.ts', 'Promise.resolve({']
];

for (const [relativePath, token] of fallbackChecks) {
  const filePath = path.join(projectRoot, relativePath);
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes(token)) {
    issues.push(`${relativePath}: false-success fallback ${JSON.stringify(token)}`);
  }
}

if (issues.length > 0) {
  console.error('Production readiness audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Production readiness audit passed: ${sourceFiles.length} runtime source files checked.`);
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const stat = fs.statSync(directory);
  if (stat.isFile()) {
    return [directory];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

function toRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll('\\', '/');
}

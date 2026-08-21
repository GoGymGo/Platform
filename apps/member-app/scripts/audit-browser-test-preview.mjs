import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const exportRoot = path.resolve(
  projectRoot,
  process.argv[2] ?? 'dist'
);
const requiredMarkers = [
  'WEB TEST PREVIEW',
  'START NEW PLAYER DEMO',
  'This preview simulates the email-verification step without sending a message.',
  'COMPLETE NEW-PLAYER FLOW',
  'PULSE_RIDER',
  'Northline Wellness',
  'BROWSER PREVIEW QR',
  'USE PRIVATE PLAYER ID',
  'ACCOUNT DATA & DELETION',
  'RESET APP ON THIS DEVICE',
  'Your private player ID works immediately.',
  'New pictures stay private and pending until moderation.'
];
const forbiddenMarkers = [
  'DEVELOPMENT ONLY // LOCAL TESTING',
  'INTERNAL TEST LEGAL DRAFTS ARE ACTIVE',
  'creator tools remain visible while paused',
  'CREATOR PLANNING PAUSED',
  'CREATOR WORKOUTS ARE PAUSED',
  'APP_TOUR_PLAYER',
  'Tour Partner',
  'Firebase will send a secure password-reset link.',
  'INTERNAL TEST DRAFT',
  'NOT APPROVED FOR PUBLIC LAUNCH',
  '[INSERT LEGAL ENTITY'
];

if (!fs.existsSync(exportRoot) || !fs.statSync(exportRoot).isDirectory()) {
  console.error(
    `Browser preview audit failed: export directory does not exist: ${exportRoot}`
  );
  process.exit(1);
}

const files = collectFiles(exportRoot);
const combined = Buffer.concat(files.map((filePath) => fs.readFileSync(filePath)));
const issues = [];

for (const marker of requiredMarkers) {
  if (!combined.includes(Buffer.from(marker, 'utf8'))) {
    issues.push(`required browser-preview marker is missing: ${JSON.stringify(marker)}`);
  }
}
for (const marker of forbiddenMarkers) {
  if (combined.includes(Buffer.from(marker, 'utf8'))) {
    issues.push(`internal-status copy is present: ${JSON.stringify(marker)}`);
  }
}
if (!fs.existsSync(path.join(exportRoot, 'index.html'))) {
  issues.push('index.html is missing');
}
const buildManifestPath = path.join(
  exportRoot,
  'browser-test-preview-build.json'
);
if (!fs.existsSync(buildManifestPath)) {
  issues.push('browser-test-preview-build.json is missing; use export:web-test-preview');
} else {
  try {
    const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
    if (
      manifest.browserTestPreviewEnabled !== true ||
      manifest.cacheCleared !== true
    ) {
      issues.push('browser preview build manifest does not confirm an enabled, cache-cleared export');
    }
  } catch {
    issues.push('browser-test-preview-build.json is invalid');
  }
}

if (issues.length > 0) {
  console.error('Browser preview audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `Browser preview audit passed: ${requiredMarkers.length} required markers and ` +
  `${forbiddenMarkers.length} forbidden markers checked across ${files.length} files.`
);

function collectFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const exportRoot = path.resolve(
  projectRoot,
  process.argv[2] ?? '.expo-ci-export'
);
const nativeOnlyFixtureMarkers = [
  '10000000-0000-4000-8000-000000000001',
  'BROWSER PREVIEW QR',
  'MOVE_MORE',
  'NORTH_STAR',
  'PULSE_RIDER',
  'Northline Wellness',
  'preview.player@example.com',
  'RECOVER20',
  'app-tour-active-session',
  'app-tour@gogymgo.local',
  'app-tour-legal-receipt',
  'app-tour-player',
  'app-tour-region-verification',
  'app-tour-reward',
  'app-tour-session-',
  'app-tour-workout',
  'data:text/plain,GoGymGo%20App%20Tour%20export',
  'example.invalid/app-tour',
  'gogymgo:gym:entry:app-tour'
];
const universalForbiddenMarkers = [
  'APP-TOUR',
  'APP TOUR ACTIVE',
  'APP TOUR QR SIMULATOR',
  'APP_TOUR_PLAYER',
  'App Tour Player',
  'DEVELOPMENT ONLY // LOCAL TESTING',
  'GOGYMGO APP TOUR',
  'Presence confirmed in App Tour.',
  'Tour Partner',
  'INTERNAL TEST DRAFT',
  'NOT APPROVED FOR PUBLIC LAUNCH',
  '[INSERT LEGAL ENTITY'
];
const publicDemoRequiredMarkers = [
  'THE REAL APP UI // READ-ONLY SHOWCASE',
  'SAFE SHOWCASE MODE',
  'LEAVE DEMO + JOIN BETA'
];

if (!fs.existsSync(exportRoot) || !fs.statSync(exportRoot).isDirectory()) {
  console.error(
    `Production bundle audit failed: export directory does not exist: ${exportRoot}`
  );
  process.exit(1);
}

const files = collectFiles(exportRoot);
const issues = [];
const webFiles = files.filter(isWebBundle);

for (const filePath of files) {
  const source = fs.readFileSync(filePath);
  const markers = isWebBundle(filePath)
    ? universalForbiddenMarkers
    : [...universalForbiddenMarkers, ...nativeOnlyFixtureMarkers];

  for (const marker of markers) {
    if (source.includes(Buffer.from(marker, 'utf8'))) {
      issues.push(
        `${path.relative(exportRoot, filePath)} contains development marker ${JSON.stringify(marker)}`
      );
    }
  }
}

if (webFiles.length > 0) {
  const webSource = Buffer.concat(webFiles.map((filePath) => fs.readFileSync(filePath)));
  for (const marker of publicDemoRequiredMarkers) {
    if (!webSource.includes(Buffer.from(marker, 'utf8'))) {
      issues.push(`web production bundle is missing public-demo marker ${JSON.stringify(marker)}`);
    }
  }
}

if (files.length === 0) {
  issues.push('the export does not contain any generated files');
}

if (issues.length > 0) {
  console.error('Production bundle audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `Production bundle audit passed: native fixtures are absent, the web-only public demo is present, and internal test markers are absent across ${files.length} generated files.`
);

function isWebBundle(filePath) {
  return filePath.replaceAll('\\', '/').includes('/static/js/web/');
}

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

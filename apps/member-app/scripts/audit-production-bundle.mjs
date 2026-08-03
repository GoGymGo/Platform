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
const forbiddenMarkers = [
  '10000000-0000-4000-8000-000000000001',
  'APP-TOUR',
  'APP TOUR ACTIVE',
  'APP TOUR QR SIMULATOR',
  'APP_TOUR_PLAYER',
  'App Tour Player',
  'BROWSER PREVIEW QR',
  'DEVELOPMENT ONLY // LOCAL TESTING',
  'GOGYMGO APP TOUR',
  'HARBOUR VIEW CONDO GYM',
  'MOVE_MORE',
  'NORTH_STAR',
  'Presence confirmed in App Tour.',
  'PULSE_RIDER',
  'Northline Wellness',
  'preview.player@example.com',
  'SAMPLE SERVER TIMER',
  'SIMULATE QR ENTRY',
  'RECOVER20',
  'Tour Partner',
  'Toronto',
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
  'gogymgo:gym:entry:app-tour',
  'INTERNAL TEST DRAFT',
  'NOT APPROVED FOR PUBLIC LAUNCH',
  '[INSERT LEGAL ENTITY'
];

if (!fs.existsSync(exportRoot) || !fs.statSync(exportRoot).isDirectory()) {
  console.error(
    `Production bundle audit failed: export directory does not exist: ${exportRoot}`
  );
  process.exit(1);
}

const files = collectFiles(exportRoot);
const issues = [];

for (const filePath of files) {
  const source = fs.readFileSync(filePath);

  for (const marker of forbiddenMarkers) {
    if (source.includes(Buffer.from(marker, 'utf8'))) {
      issues.push(
        `${path.relative(exportRoot, filePath)} contains development marker ${JSON.stringify(marker)}`
      );
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
  `Production bundle audit passed: ${forbiddenMarkers.length} development markers are absent across ${files.length} generated files.`
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

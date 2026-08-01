import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const buildRoot = path.join(root, 'dist');
const forbiddenMarkers = [
  'AUTH_MODE',
  'DEMO_VERIFICATION_',
  'INVALID_TEST_TOKEN',
  'TestTokenVerifier',
  'canada_demo',
  'demo_verification_checkpoints',
  'draw_winners',
  'hyperwallet',
  'non_cash_demo',
  'payout_claims',
  'payout_payments',
  'payout_release_control',
  'payout_state_events',
  'test-token-verifier',
  '/v1/demo-verifications',
  '/v1/me/sponsor-ad-placements',
  '/v1/payouts',
  '/v1/webhooks/hyperwallet',
  'IRON DISTRICT',
  'VOLT PERFORMANCE CLUB',
  'NORTHLINE FITNESS',
];

if (!fs.existsSync(buildRoot) || !fs.statSync(buildRoot).isDirectory()) {
  console.error(
    `Production backend build audit failed: build directory does not exist: ${buildRoot}`,
  );
  process.exit(1);
}

const files = collectFiles(buildRoot).filter((filePath) =>
  ['.js', '.json'].includes(path.extname(filePath)),
);
const issues = [];

for (const filePath of files) {
  const source = fs.readFileSync(filePath);
  for (const marker of forbiddenMarkers) {
    if (source.includes(Buffer.from(marker, 'utf8'))) {
      issues.push(
        `${path.relative(buildRoot, filePath)} contains prohibited runtime marker ${JSON.stringify(marker)}`,
      );
    }
  }
}

if (files.length === 0) {
  issues.push('the build does not contain any JavaScript or JSON artifacts');
}

if (issues.length > 0) {
  console.error('Production backend build audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `Production backend build audit passed: ${forbiddenMarkers.length} prohibited markers are absent across ${files.length} generated files.`,
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

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const issues = [];
const demo = read('app/demo.tsx');
const rootLayout = read('app/_layout.tsx');

for (const pattern of [
  /firebase/i,
  /expo-camera/,
  /expo-location/,
  /useApi\b/,
  /useAuth\b/,
  /\bfetch\s*\(/
]) {
  if (pattern.test(demo)) {
    issues.push(`app/demo.tsx imports or invokes a prohibited live service: ${pattern}`);
  }
}

for (const required of [
  'DEMO // SAMPLE DATA // NO ACCOUNT OR BACKEND',
  'VANCOUVER ISLAND + GULF ISLANDS',
  'SIMULATE QR ENTRY',
  'one real second equals one sample minute'
]) {
  if (!demo.includes(required)) {
    issues.push(`app/demo.tsx is missing required isolated-demo copy: ${required}`);
  }
}

if (
  !rootLayout.includes("pathname === '/demo'") ||
  !rootLayout.includes('return <DemoNavigation')
) {
  issues.push('app/_layout.tsx does not bypass authenticated providers for /demo.');
}

for (const [relativePath, serviceName] of [
  ['src/services/auth/firebaseApp.ts', 'Firebase'],
  ['src/services/api/client.ts', 'GoGymGo API'],
  ['src/services/competitionRegionVerification.ts', 'Device location'],
  ['src/services/gymScanLocation.ts', 'Device location']
]) {
  const source = read(relativePath);
  if (
    !source.includes('assertLiveServicesAllowed') ||
    !source.includes(`assertLiveServicesAllowed('${serviceName}')`)
  ) {
    issues.push(`${relativePath} is missing the public-demo runtime guard.`);
  }
}

if (issues.length > 0) {
  console.error('Demo isolation audit failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    'Demo isolation audit passed: no account, Firebase, camera, location or API path is reachable from /demo.'
  );
}

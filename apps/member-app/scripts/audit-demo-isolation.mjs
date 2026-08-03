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

for (const prohibited of [
  'SAMPLE DATA',
  'HARBOUR VIEW CONDO GYM',
  'SIMULATE QR',
  'sample minute'
]) {
  if (demo.includes(prohibited)) {
    issues.push(`app/demo.tsx contains retired public-demo content: ${prohibited}`);
  }
}

if (!demo.includes("Redirect href=\"/join\"")) {
  issues.push('app/demo.tsx must redirect old public-demo links to /join.');
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
    'Retired demo audit passed: /demo redirects to /join without sample data or live-service access.'
  );
}

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const issues = [];
const demoRoute = read('app/demo.tsx');
const demoScreen = read('src/demo/PublicDemoScreen.tsx');
const rootLayout = read('app/_layout.tsx');
const appTourState = read('src/state/appTour.tsx');
const apiState = read('src/state/api.tsx');
const authState = read('src/state/auth.tsx');
const metro = read('metro.config.js');

for (const [relativePath, source] of [
  ['app/demo.tsx', demoRoute],
  ['src/demo/PublicDemoScreen.tsx', demoScreen]
]) {
  for (const pattern of [
    /(?:from|import\()\s*['"][^'"]*firebase/i,
    /(?:from|import\()\s*['"]expo-camera/,
    /(?:from|import\()\s*['"]expo-location/,
    /useApi\b/,
    /useAuth\b/,
    /\bfetch\s*\(/
  ]) {
    if (pattern.test(source)) {
      issues.push(`${relativePath} imports or invokes a prohibited live service: ${pattern}`);
    }
  }
}

for (const required of [
  'PublicDemoScreen',
  'THE REAL APP UI // READ-ONLY SHOWCASE',
  'SCREEN DIRECTORY',
  'SAFE SHOWCASE MODE',
  'buildAppTourHref(route, \'demo\')',
  'publicDemoRoutes'
]) {
  if (!demoRoute.includes(required) && !demoScreen.includes(required)) {
    issues.push(`public demo is missing required isolated-demo behavior: ${required}`);
  }
}

if (rootLayout.includes('DemoNavigation')) {
  issues.push('app/_layout.tsx still uses the obsolete parallel demo navigator.');
}
if (!rootLayout.includes("<AuthProvider key={active ? 'tour' : 'app'}>")) {
  issues.push('app/_layout.tsx does not route demo screens through the shared app providers.');
}
if (
  !appTourState.includes('publicDemoRequested') ||
  !appTourState.includes('isDemoSearch(firstParam(params.demo))')
) {
  issues.push('src/state/appTour.tsx does not keep public demo mode active across real app routes.');
}
if (!apiState.includes('!appTourActive && isApiConfigured')) {
  issues.push('src/state/api.tsx does not disable API access while the public demo is active.');
}
if (!authState.includes('? <AppTourAuthProvider>')) {
  issues.push('src/state/auth.tsx does not replace Firebase auth while the public demo is active.');
}
for (const moduleName of [
  '@/demo/PublicDemoScreen',
  '@/state/appTour',
  '@/testing/appTourData',
  '@/testing/appTourRegion',
  '@/testing/appTourRoutes',
  '@/testing/AppTourModeBanner',
  '@/testing/AppTourQrSimulator'
]) {
  if (!metro.includes(`'${moduleName}'`)) {
    issues.push(`metro.config.js does not retain ${moduleName} for the web-only public demo.`);
  }
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
    issues.push(`${relativePath} is missing the public-Demo runtime guard.`);
  }
}

if (issues.length > 0) {
  console.error('Demo isolation audit failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    'Demo isolation audit passed: the public tour reuses real app routes while account, Firebase, camera, location and API services remain disabled.'
  );
}

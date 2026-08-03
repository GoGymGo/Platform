import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const issues = [];
const demo = read('app/demo.tsx');
const demoRoutes = read('src/demo/demoRoutes.ts');
const demoBanner = read('src/demo/DemoModeBanner.tsx');
const rootLayout = read('app/_layout.tsx');
const workoutLayout = read('app/workout/_layout.tsx');
const appTourState = read('src/state/appTour.tsx');
const authState = read('src/state/auth.tsx');
const apiState = read('src/state/api.tsx');
const appData = read('src/data/appDataHooks.tsx');
const metro = read('metro.config.js');

for (const pattern of [
  /firebase/i,
  /expo-camera/,
  /expo-location/,
  /useApi\b/,
  /useAuth\b/,
  /\bfetch\s*\(/
]) {
  if (pattern.test(demo) || pattern.test(demoBanner) || pattern.test(demoRoutes)) {
    issues.push(`public Demo UI imports or invokes a prohibited live service: ${pattern}`);
  }
}

for (const required of [
  'DEMO // DUMMY DATA // NO ACCOUNT REQUIRED',
  'same production screen used by app.gogymgo.com',
  'No sign-in, account creation, camera, location or live GoGymGo data',
  'buildDemoHref(firstRoute)'
]) {
  if (!demo.includes(required)) {
    issues.push(`app/demo.tsx is missing required public-Demo behavior: ${required}`);
  }
}

for (const route of [
  '/home',
  '/calendar',
  '/session',
  '/workout/active',
  '/leaderboard',
  '/winners-circle',
  '/leaderboard/rewards',
  '/rewards/awards',
  '/squad',
  '/squad/social',
  '/squad/gym',
  '/profile',
  '/account-data'
]) {
  if (!demoRoutes.includes(`route: '${route}'`)) {
    issues.push(`src/demo/demoRoutes.ts is missing real member-app route ${route}`);
  }
}

for (const required of [
  "Platform.OS === 'web'",
  "pathname === '/demo'",
  "firstParam(params.demo) === '1'",
  'enterDemo',
  'demoActive'
]) {
  if (!appTourState.includes(required)) {
    issues.push(`src/state/appTour.tsx is missing public-Demo activation guard: ${required}`);
  }
}

if (
  rootLayout.includes('DemoNavigation') ||
  !rootLayout.includes('<AuthProvider') ||
  !rootLayout.includes('<AppDataProvider') ||
  !rootLayout.includes('<DemoModeBanner />')
) {
  issues.push('app/_layout.tsx must render the Demo through the same providers and router as the real app screens.');
}

for (const required of ['demoActive', '<Slot />', '<Redirect href="/session" />']) {
  if (!workoutLayout.includes(required)) {
    issues.push(`app/workout/_layout.tsx must expose the real timer only inside Demo mode: ${required}`);
  }
}

for (const required of [
  "'@/state/appTour'",
  "'@/testing/appTourData'",
  "'@/testing/appTourRegion'",
  'publicWebDemoModules',
  "platform === 'web'",
  'keepPublicWebDemo'
]) {
  if (!metro.includes(required)) {
    issues.push(`metro.config.js is missing the web-only public-Demo module boundary: ${required}`);
  }
}

if (!authState.includes('appTourActive') || !authState.includes('<AppTourAuthProvider>')) {
  issues.push('src/state/auth.tsx must provide the in-memory Demo user instead of Firebase authentication.');
}
if (!apiState.includes('!appTourActive && isApiConfigured')) {
  issues.push('src/state/api.tsx must prevent API client creation while Demo mode is active.');
}
for (const factory of [
  'createAppTourDataSource',
  'createAppTourSocialRepository',
  'createAppTourWorkoutSessionRepository',
  'createAppTourAccountReadinessRepository',
  'createAppTourAccountSettingsRepository'
]) {
  if (!appData.includes(factory)) {
    issues.push(`src/data/appDataHooks.tsx is missing in-memory Demo repository ${factory}`);
  }
}

for (const required of [
  'demoActive',
  'findDemoRouteIndex(pathname)',
  'buildDemoHref(route)',
  'Previous Demo screen',
  'Next Demo screen',
  'Finish Demo'
]) {
  if (!demoBanner.includes(required)) {
    issues.push(`src/demo/DemoModeBanner.tsx is missing required step navigation: ${required}`);
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
    'Demo isolation audit passed: /demo routes through the production screen components with in-memory data, next/previous controls, and no account, Firebase, camera, location or API access.'
  );
}

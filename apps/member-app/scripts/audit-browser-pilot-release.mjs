import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportRoot = path.resolve(projectRoot, process.argv[2] ?? 'dist');
const issues = [];
const environment = process.env;
const apiUrl = environment.EXPO_PUBLIC_API_URL?.trim() ?? '';

if (environment.GOGYMGO_BROWSER_ONLY_PILOT !== 'true') {
  issues.push('GOGYMGO_BROWSER_ONLY_PILOT must be true for this release audit');
}

if (!isPublicHttpsUrl(apiUrl)) {
  issues.push('EXPO_PUBLIC_API_URL must be a permanent public HTTPS origin');
}

for (const name of [
  'EXPO_PUBLIC_ENABLE_APPLE_AUTH',
  'EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW',
  'EXPO_PUBLIC_ENABLE_GOOGLE_AUTH'
]) {
  if (environment[name] === 'true') {
    issues.push(`${name} must be false for the browser-only pilot`);
  }
}

for (const name of [
  'GOGYMGO_IOS_TEAM_ID',
  'GOGYMGO_IOS_BUNDLE_ID',
  'GOGYMGO_ANDROID_PACKAGE',
  'GOGYMGO_ANDROID_CERT_SHA256'
]) {
  if (environment[name]?.trim()) {
    issues.push(`${name} must be omitted from a browser-only pilot build`);
  }
}

if (!fs.existsSync(exportRoot) || !fs.statSync(exportRoot).isDirectory()) {
  issues.push(`the browser export does not exist: ${exportRoot}`);
} else {
  auditExport();
}

auditPilotCapabilities();

if (issues.length > 0) {
  console.error('Browser-only pilot release audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  'Browser-only pilot release audit passed: the connected web build uses the protected API, excludes test endpoints and native-link claims, and limits workout verification to QR plus foreground location.'
);

function auditExport() {
  const indexPath = path.join(exportRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    issues.push('the browser export is missing index.html');
  }

  for (const associationPath of [
    '.well-known/apple-app-site-association',
    '.well-known/assetlinks.json'
  ]) {
    if (fs.existsSync(path.join(exportRoot, associationPath))) {
      issues.push(`${associationPath} must not be published without real native signing identifiers`);
    }
  }

  const source = collectFiles(exportRoot)
    .filter((filePath) => /\.(?:html|js|json)$/i.test(filePath))
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');

  if (apiUrl && !source.includes(apiUrl)) {
    issues.push(`the browser export does not contain the configured API origin: ${apiUrl}`);
  }

  for (const marker of [
    'http://localhost:',
    'http://127.0.0.1:',
    'https://127.0.0.1',
    'trycloudflare.com'
  ]) {
    if (source.includes(marker)) {
      issues.push(`the browser export contains a forbidden endpoint marker: ${marker}`);
    }
  }
}

function auditPilotCapabilities() {
  const packageJson = readJson('package.json');
  const appJson = readJson('app.json');
  const capabilities = readText('src/config/workoutVerification.ts');
  const plugins = new Map(
    (appJson.expo?.plugins ?? []).map((plugin) => [
      typeof plugin === 'string' ? plugin : plugin[0],
      typeof plugin === 'string' ? null : plugin[1]
    ])
  );

  if (packageJson.dependencies?.['expo-local-authentication']) {
    issues.push('the browser pilot must not ship the disabled biometric runtime');
  }
  if (plugins.has('expo-local-authentication')) {
    issues.push('the browser pilot must not request an unused biometric permission');
  }

  for (const capability of ['devicePresence', 'heartRate', 'midSessionPresence']) {
    if (!new RegExp(`^\\s*${capability}\\s*:\\s*false\\s*,?\\s*$`, 'm').test(capabilities)) {
      issues.push(`${capability} must remain disabled for the browser pilot`);
    }
  }
  if (!/^\s*partnerGymQr\s*:\s*true\s*,?\s*$/m.test(capabilities)) {
    issues.push('partnerGymQr must remain enabled for the browser pilot');
  }

  const locationPermission = plugins.get('expo-location')?.locationWhenInUsePermission ?? '';
  for (const phrase of ['region', 'start and finish', 'does not track your location in the background']) {
    if (!locationPermission.toLowerCase().includes(phrase)) {
      issues.push(`the foreground location permission must explain ${JSON.stringify(phrase)}`);
    }
  }
}

function isPublicHttpsUrl(value) {
  if (!/^https:\/\//i.test(value)) {
    return false;
  }
  return !/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|\.local(?:[/:]|$)|trycloudflare\.com)/i.test(value);
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

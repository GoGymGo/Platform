import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  parseExactPublicHttpsOrigin,
  productionApiOrigin,
  validateNativeReleaseValues
} from './member-release-policy.mjs';

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const issues = [];
const appJson = readJson('app.json');
const easJson = readJson('eas.json');
const expo = appJson.expo ?? {};
const environment = loadEnvironment(['.env', '.env.local']);

requireValue('EXPO_PUBLIC_API_URL');
issues.push(...validateNativeReleaseValues(environment));
for (const name of [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID'
]) {
  requireValue(name);
}

const apiUrl = environment.EXPO_PUBLIC_API_URL ?? '';
const browserTestPreviewEnabled =
  environment.EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW === 'true';
const legalSource = readText('src/constants/legal.ts');
const workoutVerificationSource = readText('src/config/workoutVerification.ts');
const devicePresenceEnabled = capabilityEnabled('devicePresence');
const heartRateEnabled = capabilityEnabled('heartRate');

if (apiUrl && parseExactPublicHttpsOrigin(apiUrl) !== productionApiOrigin) {
  issues.push(`EXPO_PUBLIC_API_URL must be the exact production origin ${productionApiOrigin}`);
}
if (browserTestPreviewEnabled) {
  issues.push('EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW must be false for store releases');
}
for (const marker of [
  'INTERNAL TEST DRAFT',
  'NOT APPROVED FOR PUBLIC LAUNCH',
  '[INSERT LEGAL ENTITY'
]) {
  if (legalSource.includes(marker)) {
    issues.push(`src/constants/legal.ts must replace release-blocking legal placeholder: ${marker}`);
  }
}

if (easJson.build?.production?.autoIncrement !== true) {
  issues.push('eas.json production builds must auto-increment the store build number');
}
if (easJson.build?.production?.env?.GOGYMGO_RELEASE_BUILD !== 'true') {
  issues.push('eas.json production builds must enable native release cleanup');
}
if (!easJson.submit?.production) {
  issues.push('eas.json must contain a production submit profile');
}

const blockedPermissions = new Set(expo.android?.blockedPermissions ?? []);
if (!blockedPermissions.has('android.permission.RECORD_AUDIO')) {
  issues.push('Android RECORD_AUDIO must be blocked because GoGymGo does not record audio');
}

const associatedDomains = new Set(expo.ios?.associatedDomains ?? []);
if (!associatedDomains.has('applinks:app.gogymgo.com')) {
  issues.push('iOS must associate app.gogymgo.com so poster scans can open the installed app');
}
const gymScanIntentFilter = (expo.android?.intentFilters ?? []).find(
  (intentFilter) =>
    intentFilter.action === 'VIEW' &&
    intentFilter.autoVerify === true &&
    intentFilter.category?.includes('BROWSABLE') &&
    intentFilter.category?.includes('DEFAULT') &&
    intentFilter.data?.some(
      (entry) =>
        entry.scheme === 'https' &&
        entry.host === 'app.gogymgo.com' &&
        entry.path === '/scan' &&
        entry.pathPrefix === undefined &&
        entry.pathPattern === undefined
    )
);
if (!gymScanIntentFilter) {
  issues.push('Android must register an exact verified App Link for https://app.gogymgo.com/scan');
}

const plugins = new Map(
  (expo.plugins ?? []).map((plugin) => [
    typeof plugin === 'string' ? plugin : plugin[0],
    typeof plugin === 'string' ? null : plugin[1]
  ])
);
const camera = plugins.get('expo-camera');
if (
  !camera ||
  camera.recordAudioAndroid !== false ||
  camera.barcodeScannerEnabled !== true
) {
  issues.push('expo-camera must enable barcode scanning and disable Android audio recording');
}
const imagePicker = plugins.get('expo-image-picker');
if (
  !imagePicker ||
  imagePicker.cameraPermission === false ||
  imagePicker.microphonePermission !== false
) {
  issues.push(
    'expo-image-picker must preserve QR camera access and block Android audio recording'
  );
}
if (!plugins.has('expo-location')) {
  issues.push('expo-location must declare the region and Partner gym permission copy');
}
if (devicePresenceEnabled) {
  if (!plugins.has('expo-local-authentication')) {
    issues.push('expo-local-authentication must declare the device-presence permission copy');
  }
  if (!hasDependency('expo-local-authentication')) {
    issues.push('expo-local-authentication is required when device-presence verification is enabled');
  }
} else {
  if (plugins.has('expo-local-authentication')) {
    issues.push('the pilot release must not declare an unused device-presence permission');
  }
  if (hasDependency('expo-local-authentication')) {
    issues.push('the pilot release must not ship the disabled local-authentication runtime');
  }
}
if (!hasDependency('expo-system-ui')) {
  issues.push('expo-system-ui is required to apply the configured Android dark appearance');
}

const privacyManifest = expo.ios?.privacyManifests;
if (
  privacyManifest?.NSPrivacyTracking !== false ||
  !Array.isArray(privacyManifest.NSPrivacyTrackingDomains) ||
  privacyManifest.NSPrivacyTrackingDomains.length !== 0
) {
  issues.push('the iOS privacy manifest must declare no tracking or tracking domains');
}
const expectedCollectedDataTypes = new Set([
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypePhoneNumber',
  'NSPrivacyCollectedDataTypePhysicalAddress',
  'NSPrivacyCollectedDataTypeCoarseLocation',
  'NSPrivacyCollectedDataTypePhotosorVideos',
  'NSPrivacyCollectedDataTypeGameplayContent',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeDeviceID'
]);
if (heartRateEnabled) {
  expectedCollectedDataTypes.add('NSPrivacyCollectedDataTypeHealth');
  expectedCollectedDataTypes.add('NSPrivacyCollectedDataTypeFitness');
}
const configuredCollectedDataTypes = new Set(
  (privacyManifest?.NSPrivacyCollectedDataTypes ?? []).map(
    (entry) => entry.NSPrivacyCollectedDataType
  )
);
for (const dataType of expectedCollectedDataTypes) {
  if (!configuredCollectedDataTypes.has(dataType)) {
    issues.push(`the iOS privacy manifest is missing ${dataType}`);
  }
}
if (!heartRateEnabled) {
  for (const dataType of [
    'NSPrivacyCollectedDataTypeHealth',
    'NSPrivacyCollectedDataTypeFitness'
  ]) {
    if (configuredCollectedDataTypes.has(dataType)) {
      issues.push(`the pilot privacy manifest must not declare unused ${dataType}`);
    }
  }
}
const requiredReasonCategories = new Set(
  (privacyManifest?.NSPrivacyAccessedAPITypes ?? []).map(
    (entry) => entry.NSPrivacyAccessedAPIType
  )
);
for (const category of [
  'NSPrivacyAccessedAPICategoryFileTimestamp',
  'NSPrivacyAccessedAPICategoryDiskSpace',
  'NSPrivacyAccessedAPICategorySystemBootTime',
  'NSPrivacyAccessedAPICategoryUserDefaults'
]) {
  if (!requiredReasonCategories.has(category)) {
    issues.push(`the iOS privacy manifest is missing required-reason category ${category}`);
  }
}
const releaseConfig = readText('app.config.ts');
const releasePermissionPlugin = readText('plugins/withReleaseIosPermissions.js');
for (const marker of [
  'GOGYMGO_EAS_OWNER',
  'GOGYMGO_EAS_PROJECT_ID',
  'GOGYMGO_IOS_BUNDLE_ID',
  'GOGYMGO_ANDROID_PACKAGE'
]) {
  if (!releaseConfig.includes(marker)) {
    issues.push(`app.config.ts must inject the approved ${marker} value`);
  }
}
if (
  !releaseConfig.includes('./plugins/withReleaseIosPermissions') ||
  !releasePermissionPlugin.includes('withFinalizedMod')
) {
  issues.push('the iOS production permission cleanup plugin is not configured');
}
for (const permission of [
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSMotionUsageDescription'
]) {
  if (!releasePermissionPlugin.includes(permission)) {
    issues.push(`the iOS production permission cleanup does not remove ${permission}`);
  }
}
const reactNativeRoot = path.dirname(require.resolve('react-native/package.json'));
const reactNativeVersions = fs.readFileSync(
  path.join(reactNativeRoot, 'gradle', 'libs.versions.toml'),
  'utf8'
);
const androidTargetSdk = Number(
  reactNativeVersions.match(/^targetSdk\s*=\s*"(\d+)"/m)?.[1] ?? 0
);
if (androidTargetSdk < 36) {
  issues.push('the Android production build must target API level 36 or newer');
}

const partnerGymProvider = readText('src/config/partnerGyms.ts');
if (
  !['devicePresence', 'heartRate', 'midSessionPresence', 'partnerGymQr'].some(
    capabilityEnabled
  ) &&
  !partnerGymProvider.includes('verifiedPartnerGymCatalogAvailable = true')
) {
  issues.push(
    'at least one production workout verification provider must be connected before store release'
  );
}

auditPng(expo.icon, 1024, 1024, false, 'store icon');
auditPng(expo.android?.adaptiveIcon?.foregroundImage, 1024, 1024, true, 'adaptive icon');
const splash = plugins.get('expo-splash-screen');
auditPng(splash?.image, 1024, 1024, true, 'splash image');
const notifications = plugins.get('expo-notifications');
auditPng(notifications?.icon, 96, 96, true, 'notification icon');

const appTourSource = readText('src/state/appTour.tsx');
const appTourRoute = readText('app/app-tour.tsx');
const browserTestPreviewConfig = readText('src/config/browserTestPreview.ts');
const metroConfig = readText('metro.config.js');
if (
  !appTourRoute.includes('if (!__DEV__)') ||
  !appTourSource.includes('browserTestPreviewEnabled') ||
  !browserTestPreviewConfig.includes('__DEV__') ||
  !browserTestPreviewConfig.includes("Platform.OS === 'web'")
) {
  issues.push('test preview entry points must remain limited to development or explicit web-preview builds');
}
if (
  !metroConfig.includes('context.dev') ||
  !metroConfig.includes("platform === 'web'") ||
  !metroConfig.includes('EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW') ||
  !metroConfig.includes('publicDemoWebModules') ||
  !metroConfig.includes('keepPublicWebDemo') ||
  !metroConfig.includes('@/state/appTour') ||
  !metroConfig.includes('@/testing/appTourData') ||
  !metroConfig.includes('@/testing/appTourRegion') ||
  !metroConfig.includes('@/testing/AppTourScreen')
) {
  issues.push('production Metro builds must retain the isolated web Demo data while replacing internal test-tour UI and native fixtures with release stubs');
}

if (issues.length > 0) {
  console.error('Store release audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    'Store release audit passed: identifiers, EAS linkage, production services, native permissions, assets, and test-mode guards are configured.'
  );
}

function requireValue(name) {
  if (!environment[name]?.trim()) {
    issues.push(`${name} is required in the release environment`);
  }
}

function auditPng(relativePath, width, height, alphaRequired, label) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    issues.push(`${label} path is missing from app.json`);
    return;
  }

  const filePath = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    issues.push(`${label} is missing at ${relativePath}`);
    return;
  }

  const header = fs.readFileSync(filePath).subarray(0, 26);
  const pngSignature = '89504e470d0a1a0a';
  if (header.subarray(0, 8).toString('hex') !== pngSignature) {
    issues.push(`${label} must be a PNG file`);
    return;
  }

  const actualWidth = header.readUInt32BE(16);
  const actualHeight = header.readUInt32BE(20);
  const colorType = header[25];
  if (actualWidth !== width || actualHeight !== height) {
    issues.push(`${label} must be ${width}x${height}, found ${actualWidth}x${actualHeight}`);
  }
  if (alphaRequired && colorType !== 4 && colorType !== 6) {
    issues.push(`${label} must include an alpha channel`);
  }
  if (!alphaRequired && (colorType === 4 || colorType === 6)) {
    issues.push(`${label} must be opaque for App Store submission`);
  }
}

function loadEnvironment(fileNames) {
  const values = { ...process.env };

  for (const fileName of fileNames) {
    const filePath = path.join(projectRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) {
        continue;
      }
      values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }

  return values;
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function hasDependency(name) {
  const packageJson = readJson('package.json');
  return Boolean(packageJson.dependencies?.[name]);
}

function capabilityEnabled(name) {
  return new RegExp(`^\\s*${name}\\s*:\\s*true\\s*,?\\s*$`, 'm').test(
    workoutVerificationSource
  );
}

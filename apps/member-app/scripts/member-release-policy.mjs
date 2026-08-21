import { pathToFileURL } from 'node:url';

export const canonicalMemberWebOrigin = 'https://app.gogymgo.com';
export const productionApiOrigin = 'https://api.gogymgo.com';
export const stagingApiOrigin = 'https://api-staging.gogymgo.com';

export const nativeReleaseEnvironmentNames = [
  'GOGYMGO_ANDROID_CERT_SHA256',
  'GOGYMGO_ANDROID_PACKAGE',
  'GOGYMGO_APP_STORE_URL',
  'GOGYMGO_EAS_OWNER',
  'GOGYMGO_EAS_PROJECT_ID',
  'GOGYMGO_IOS_BUNDLE_ID',
  'GOGYMGO_IOS_TEAM_ID',
  'GOGYMGO_PLAY_STORE_URL',
  'GOGYMGO_PRIVACY_POLICY_URL',
  'GOGYMGO_ACCOUNT_DELETION_URL'
];

export function validateMemberWebDeploymentEnvironment(environment) {
  const issues = [];
  const deploymentEnvironment = environment.GOGYMGO_DEPLOYMENT_ENVIRONMENT ?? '';
  const releaseMode = environment.GOGYMGO_RELEASE_MODE ?? '';
  const apiOrigin = parseExactPublicHttpsOrigin(environment.API_URL);
  const memberOrigin = parseExactPublicHttpsOrigin(environment.MEMBER_WEB_URL);

  if (!['production', 'staging'].includes(deploymentEnvironment)) {
    issues.push('deployment environment must be staging or production');
  }
  if (!['browser-pilot', 'native-links'].includes(releaseMode)) {
    issues.push('release mode must be browser-pilot or native-links');
  }
  if (!apiOrigin) {
    issues.push('API_URL must be an exact public HTTPS origin without credentials, a port, path, query, or fragment');
  }
  if (!memberOrigin) {
    issues.push('MEMBER_WEB_URL must be an exact public HTTPS origin without credentials, a port, path, query, or fragment');
  }
  if (deploymentEnvironment === 'staging' && apiOrigin !== stagingApiOrigin) {
    issues.push(`staging releases must use ${stagingApiOrigin}`);
  }
  if (deploymentEnvironment === 'production') {
    if (apiOrigin !== productionApiOrigin) {
      issues.push(`production releases must use ${productionApiOrigin}`);
    }
    if (memberOrigin !== canonicalMemberWebOrigin) {
      issues.push(`production releases must use ${canonicalMemberWebOrigin}`);
    }
  }

  if (releaseMode === 'browser-pilot') {
    for (const name of nativeReleaseEnvironmentNames) {
      if (environment[name]?.trim()) {
        issues.push(`${name} must be omitted from a browser-only pilot deployment`);
      }
    }
    const approval = environment.GOGYMGO_NATIVE_LINKS_APPROVED?.trim() ?? '';
    if (approval && approval !== 'no') {
      issues.push('GOGYMGO_NATIVE_LINKS_APPROVED must be omitted or exactly no for a browser-only pilot');
    }
  }

  if (releaseMode === 'native-links') {
    if (deploymentEnvironment !== 'production') {
      issues.push('native links may be published only to the protected production environment');
    }
    if (memberOrigin !== canonicalMemberWebOrigin) {
      issues.push(`native links must be published at ${canonicalMemberWebOrigin}`);
    }
    issues.push(...validateNativeReleaseValues(environment));
  }

  return issues;
}

export function validateNativeReleaseValues(environment) {
  const issues = [];
  for (const name of nativeReleaseEnvironmentNames) {
    if (!environment[name]?.trim()) {
      issues.push(`${name} is required for a native-link release`);
    }
  }
  if (environment.GOGYMGO_NATIVE_LINKS_APPROVED !== 'yes') {
    issues.push('GOGYMGO_NATIVE_LINKS_APPROVED must be exactly yes');
  }

  const iosTeamId = environment.GOGYMGO_IOS_TEAM_ID?.trim() ?? '';
  const iosBundleId = environment.GOGYMGO_IOS_BUNDLE_ID?.trim() ?? '';
  const androidPackage = environment.GOGYMGO_ANDROID_PACKAGE?.trim() ?? '';
  const easProjectId = environment.GOGYMGO_EAS_PROJECT_ID?.trim() ?? '';
  const easOwner = environment.GOGYMGO_EAS_OWNER?.trim() ?? '';
  const fingerprints = parseAndroidFingerprints(
    environment.GOGYMGO_ANDROID_CERT_SHA256
  );

  if (iosTeamId && !/^[A-Z0-9]{10}$/.test(iosTeamId)) {
    issues.push('GOGYMGO_IOS_TEAM_ID must be the 10-character Apple Developer Team ID');
  }
  if (iosBundleId && !isProductionAppId(iosBundleId)) {
    issues.push('GOGYMGO_IOS_BUNDLE_ID must be a final production reverse-domain identifier');
  }
  if (androidPackage && !isProductionAppId(androidPackage)) {
    issues.push('GOGYMGO_ANDROID_PACKAGE must be a final production reverse-domain identifier');
  }
  if (
    environment.GOGYMGO_ANDROID_CERT_SHA256?.trim() &&
    fingerprints === null
  ) {
    issues.push('GOGYMGO_ANDROID_CERT_SHA256 must contain colon-delimited SHA-256 fingerprints');
  }
  if (easProjectId && !isUuid(easProjectId)) {
    issues.push('GOGYMGO_EAS_PROJECT_ID must be an exact EAS project UUID');
  }
  if (easOwner && !/^[A-Za-z0-9][A-Za-z0-9_-]{1,38}$/.test(easOwner)) {
    issues.push('GOGYMGO_EAS_OWNER must be an exact EAS account owner');
  }
  if (
    environment.GOGYMGO_APP_STORE_URL?.trim() &&
    !isCanonicalAppStoreUrl(environment.GOGYMGO_APP_STORE_URL)
  ) {
    issues.push('GOGYMGO_APP_STORE_URL must be a canonical public App Store listing');
  }
  if (
    environment.GOGYMGO_PLAY_STORE_URL?.trim() &&
    !isCanonicalPlayStoreUrl(
      environment.GOGYMGO_PLAY_STORE_URL,
      androidPackage
    )
  ) {
    issues.push('GOGYMGO_PLAY_STORE_URL must be the canonical Google Play listing for GOGYMGO_ANDROID_PACKAGE');
  }
  for (const name of [
    'GOGYMGO_PRIVACY_POLICY_URL',
    'GOGYMGO_ACCOUNT_DELETION_URL'
  ]) {
    if (environment[name]?.trim() && !parseExactPublicHttpsUrl(environment[name])) {
      issues.push(`${name} must be a final public HTTPS URL without credentials or a fragment`);
    }
  }

  return issues;
}

export function buildAssociationDocuments(environment) {
  const fingerprints = parseAndroidFingerprints(
    environment.GOGYMGO_ANDROID_CERT_SHA256
  );
  if (fingerprints === null) {
    throw new Error('Android signing fingerprints are invalid.');
  }

  return {
    android: [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: environment.GOGYMGO_ANDROID_PACKAGE.trim(),
          sha256_cert_fingerprints: fingerprints
        }
      }
    ],
    ios: {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${environment.GOGYMGO_IOS_TEAM_ID.trim()}.${environment.GOGYMGO_IOS_BUNDLE_ID.trim()}`,
            paths: ['/scan']
          }
        ]
      }
    }
  };
}

export function parseExactPublicHttpsOrigin(value) {
  const normalized = value?.trim() ?? '';
  try {
    const url = new URL(normalized);
    if (
      normalized !== url.origin ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !isPublicHostname(url.hostname)
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function parseExactPublicHttpsUrl(value) {
  const normalized = value?.trim() ?? '';
  try {
    const url = new URL(normalized);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      !isPublicHostname(url.hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function parseAndroidFingerprints(value) {
  const fingerprints = (value ?? '')
    .split(',')
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter(Boolean);
  if (
    fingerprints.length === 0 ||
    new Set(fingerprints).size !== fingerprints.length ||
    fingerprints.some(
      (fingerprint) => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)
    )
  ) {
    return null;
  }
  return fingerprints;
}

export function isProductionAppId(value) {
  return (
    /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/i.test(value) &&
    !/(?:^|\.)(?:dev|development|example|local|placeholder|preview|sample|staging|test)(?:\.|$)/i.test(value)
  );
}

function isCanonicalAppStoreUrl(value) {
  const url = parseExactPublicHttpsUrl(value);
  return Boolean(
    url &&
      url.hostname === 'apps.apple.com' &&
      /^\/(?:[a-z]{2}\/)?app\/[A-Za-z0-9._~-]+\/id[1-9][0-9]*$/.test(url.pathname) &&
      !url.search
  );
}

function isCanonicalPlayStoreUrl(value, androidPackage) {
  const url = parseExactPublicHttpsUrl(value);
  return Boolean(
    url &&
      url.hostname === 'play.google.com' &&
      url.pathname === '/store/apps/details' &&
      [...url.searchParams.keys()].length === 1 &&
      url.searchParams.getAll('id').length === 1 &&
      url.searchParams.get('id') === androidPackage
  );
}

function isPublicHostname(hostname) {
  return (
    hostname.includes('.') &&
    !hostname.startsWith('[') &&
    !/^[0-9.]+$/.test(hostname) &&
    !/(?:^|\.)(?:localhost|local)$/.test(hostname) &&
    !/(?:^|\.)(?:example\.(?:com|net|org)|invalid|test)$/.test(hostname)
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const issues = validateMemberWebDeploymentEnvironment(process.env);
  if (issues.length > 0) {
    console.error('Member web release configuration failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Member web release configuration passed for ${process.env.GOGYMGO_RELEASE_MODE}.`
    );
  }
}

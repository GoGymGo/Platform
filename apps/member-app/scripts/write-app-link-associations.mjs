import fs from 'node:fs';
import path from 'node:path';

const outputRoot = path.resolve(process.cwd(), process.argv[2] ?? 'dist');
const environment = loadEnvironment(['.env', '.env.local']);
const values = {
  androidCertificateSha256: environment.GOGYMGO_ANDROID_CERT_SHA256?.trim() ?? '',
  androidPackage: environment.GOGYMGO_ANDROID_PACKAGE?.trim() ?? '',
  iosBundleId: environment.GOGYMGO_IOS_BUNDLE_ID?.trim() ?? '',
  iosTeamId: environment.GOGYMGO_IOS_TEAM_ID?.trim() ?? ''
};
const configuredValues = Object.values(values).filter(Boolean);
const wellKnownDirectory = path.join(outputRoot, '.well-known');

if (configuredValues.length === 0) {
  removeGeneratedAssociationFiles();
  console.log(
    'Native app-link association files skipped: native signing identifiers are not configured for this web build.'
  );
  process.exit(0);
}

const missingValues = Object.entries(values)
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missingValues.length > 0) {
  fail(`Native app-link configuration is incomplete: ${missingValues.join(', ')}`);
}
if (!/^[A-Z0-9]{10}$/.test(values.iosTeamId)) {
  fail('GOGYMGO_IOS_TEAM_ID must be the 10-character Apple Developer Team ID.');
}
if (!isProductionAppId(values.iosBundleId)) {
  fail('GOGYMGO_IOS_BUNDLE_ID must be a production reverse-domain identifier.');
}
if (!isProductionAppId(values.androidPackage)) {
  fail('GOGYMGO_ANDROID_PACKAGE must be a production reverse-domain identifier.');
}

const androidFingerprints = values.androidCertificateSha256
  .split(',')
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
if (
  androidFingerprints.length === 0 ||
  androidFingerprints.some(
    (value) => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value)
  )
) {
  fail(
    'GOGYMGO_ANDROID_CERT_SHA256 must contain one or more comma-separated, colon-delimited SHA-256 fingerprints.'
  );
}

fs.mkdirSync(wellKnownDirectory, { recursive: true });
writeJson(path.join(wellKnownDirectory, 'apple-app-site-association'), {
  applinks: {
    apps: [],
    details: [
      {
        appID: `${values.iosTeamId}.${values.iosBundleId}`,
        paths: ['/scan']
      }
    ]
  }
});
writeJson(path.join(wellKnownDirectory, 'assetlinks.json'), [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: values.androidPackage,
      sha256_cert_fingerprints: androidFingerprints
    }
  }
]);

console.log(`Native app-link association files written to ${wellKnownDirectory}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isProductionAppId(value) {
  return (
    /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/i.test(value) &&
    !/(?:^|\.)(?:dev|development|local|preview|staging|test)(?:\.|$)/i.test(value)
  );
}

function loadEnvironment(fileNames) {
  const environment = {};

  for (const fileName of fileNames) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) {
        continue;
      }
      environment[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }

  return { ...environment, ...process.env };
}

function removeGeneratedAssociationFiles() {
  for (const fileName of ['apple-app-site-association', 'assetlinks.json']) {
    const filePath = path.join(wellKnownDirectory, fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
  }
  if (
    fs.existsSync(wellKnownDirectory) &&
    fs.readdirSync(wellKnownDirectory).length === 0
  ) {
    fs.rmdirSync(wellKnownDirectory);
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

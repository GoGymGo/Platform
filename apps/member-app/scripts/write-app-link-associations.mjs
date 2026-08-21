import fs from 'node:fs';
import path from 'node:path';

import {
  buildAssociationDocuments,
  nativeReleaseEnvironmentNames,
  validateNativeReleaseValues
} from './member-release-policy.mjs';

const outputRoot = path.resolve(process.cwd(), process.argv[2] ?? 'dist');
const environment = loadEnvironment(['.env', '.env.local']);
const configuredValues = nativeReleaseEnvironmentNames
  .map((name) => environment[name])
  .filter((value) => value?.trim());
const wellKnownDirectory = path.join(outputRoot, '.well-known');

if (
  configuredValues.length === 0 &&
  ['', 'no'].includes(environment.GOGYMGO_NATIVE_LINKS_APPROVED?.trim() ?? '')
) {
  removeGeneratedAssociationFiles();
  console.log(
    'Native app-link association files skipped: native signing identifiers are not configured for this web build.'
  );
  process.exit(0);
}

const issues = validateNativeReleaseValues(environment);
if (issues.length > 0) {
  fail(`Native app-link configuration is not release-ready:\n- ${issues.join('\n- ')}`);
}

const associationDocuments = buildAssociationDocuments(environment);
fs.mkdirSync(wellKnownDirectory, { recursive: true });
writeJson(
  path.join(wellKnownDirectory, 'apple-app-site-association'),
  associationDocuments.ios
);
writeJson(
  path.join(wellKnownDirectory, 'assetlinks.json'),
  associationDocuments.android
);

console.log(`Native app-link association files written to ${wellKnownDirectory}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
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

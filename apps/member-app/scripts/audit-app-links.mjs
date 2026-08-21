import fs from 'node:fs';
import path from 'node:path';

const issues = [];
const appJson = readJson('app.json');
const firebaseJson = readJson('firebase.json');
const packageJson = readJson('package.json');
const expo = appJson.expo ?? {};

if (!(expo.ios?.associatedDomains ?? []).includes('applinks:app.gogymgo.com')) {
  issues.push('iOS associatedDomains is missing applinks:app.gogymgo.com');
}

const scanIntent = (expo.android?.intentFilters ?? []).find(
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
if (!scanIntent) {
  issues.push('Android exact verified App Link for https://app.gogymgo.com/scan is missing');
}

if (!packageJson.scripts?.build?.includes('write-app-link-associations.mjs')) {
  issues.push('the web build does not generate native domain association files');
}

const ignoredFiles = firebaseJson.hosting?.ignore ?? [];
if (ignoredFiles.includes('**/.*')) {
  issues.push('Firebase Hosting ignores .well-known and cannot publish app-link files');
}

for (const associationPath of [
  '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json'
]) {
  const header = (firebaseJson.hosting?.headers ?? []).find(
    (entry) => entry.source === associationPath
  );
  if (
    !header?.headers?.some(
      (entry) => entry.key === 'Content-Type' && entry.value === 'application/json'
    )
  ) {
    issues.push(`${associationPath} is not served as application/json`);
  }
}

if (issues.length > 0) {
  console.error('Native app-link audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    'Native app-link audit passed: iOS, Android, web generation, and hosting headers are configured.'
  );
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
  );
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAssociationDocuments,
  validateNativeReleaseValues
} from './member-release-policy.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportRoot = path.resolve(projectRoot, process.argv[2] ?? 'dist');
const environment = loadEnvironment(['.env', '.env.local']);
const issues = validateNativeReleaseValues(environment);

if (environment.GOGYMGO_BROWSER_ONLY_PILOT === 'true') {
  issues.push('GOGYMGO_BROWSER_ONLY_PILOT must not be true for a native-link release');
}
if (
  !fs.existsSync(exportRoot) ||
  fs.lstatSync(exportRoot).isSymbolicLink() ||
  !fs.lstatSync(exportRoot).isDirectory()
) {
  issues.push(`the native-link web export does not exist: ${exportRoot}`);
} else {
  auditAssociationFiles();
}

if (issues.length > 0) {
  console.error('Native-link release artifact audit failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  'Native-link release artifact audit passed: exact approved Apple and Android associations are present only for /scan.'
);

function auditAssociationFiles() {
  const wellKnownRoot = path.join(exportRoot, '.well-known');
  const expectedNames = [
    'apple-app-site-association',
    'assetlinks.json'
  ];
  if (
    !fs.existsSync(wellKnownRoot) ||
    fs.lstatSync(wellKnownRoot).isSymbolicLink() ||
    !fs.lstatSync(wellKnownRoot).isDirectory()
  ) {
    issues.push('the native-link web export is missing .well-known');
    return;
  }
  const actualNames = fs.readdirSync(wellKnownRoot).sort();
  if (
    actualNames.length !== expectedNames.length ||
    !actualNames.every((name, index) => name === expectedNames[index])
  ) {
    issues.push('.well-known must contain exactly the Apple and Android association files');
    return;
  }

  const applePath = path.join(wellKnownRoot, 'apple-app-site-association');
  const androidPath = path.join(wellKnownRoot, 'assetlinks.json');
  let regularFiles = true;
  for (const filePath of [applePath, androidPath]) {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      issues.push(`${path.basename(filePath)} must be a regular file`);
      regularFiles = false;
    }
  }
  if (!regularFiles) return;
  if (fs.lstatSync(applePath).size > 128 * 1024) {
    issues.push('apple-app-site-association must not exceed 128 KiB');
  }

  try {
    const expected = buildAssociationDocuments(environment);
    assert.deepEqual(readJson(applePath), expected.ios);
    assert.deepEqual(readJson(androidPath), expected.android);
  } catch (error) {
    issues.push(
      `association content does not exactly match the approved release values: ${error instanceof Error ? error.message : 'invalid JSON'}`
    );
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadEnvironment(fileNames) {
  const values = {};
  for (const fileName of fileNames) {
    const filePath = path.join(projectRoot, fileName);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }
  return { ...values, ...process.env };
}

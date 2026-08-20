import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = resolve(appRoot, '../..');
const memberPackage = readJson(resolve(appRoot, 'package.json'));
const requiredWorkflowPath = resolve(repositoryRoot, '.github/workflows/member-app-ci.yml');
const advisoryWorkflowPath = resolve(
  repositoryRoot,
  '.github/workflows/member-expo-compatibility-advisory.yml',
);

test('required CI uses installed Expo metadata and keeps the online feed out of PR/main checks', () => {
  assert.equal(
    memberPackage.scripts['check:expo-compatibility'],
    'cross-env EXPO_OFFLINE=1 expo install --check --json',
  );
  assert.equal(
    memberPackage.scripts['advisory:expo-compatibility'],
    'cross-env EXPO_OFFLINE=0 expo install --check --json',
  );

  const workflow = readFileSync(requiredWorkflowPath, 'utf8');
  assert.match(workflow, /run: npm run check:expo-compatibility/);
  assert.match(workflow, /member-expo-compatibility-advisory\.yml/);
  assert.doesNotMatch(workflow, /run: (?:npx )?expo install --check/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test('online compatibility is an explicit scheduled/manual advisory and never mutates dependencies', () => {
  const workflow = readFileSync(advisoryWorkflowPath, 'utf8');

  assert.match(workflow, /^on:\s*$/m);
  assert.match(workflow, /^  schedule:\s*$/m);
  assert.match(workflow, /^  workflow_dispatch:\s*$/m);
  assert.match(workflow, /run: npm run advisory:expo-compatibility/);
  assert.match(workflow, /^permissions:\s*\n  contents: read\s*$/m);
  assert.doesNotMatch(workflow, /^  (?:pull_request|push):/m);
  assert.doesNotMatch(workflow, /--fix|continue-on-error|npm install/);
});

test('installed Expo CLI sources keep offline checks local and mismatches fatal', () => {
  const cliSourceRoot = resolve(repositoryRoot, 'node_modules/@expo/cli/build/src');
  const nativeModulesSource = readFileSync(
    resolve(cliSourceRoot, 'start/doctor/dependencies/bundledNativeModules.js'),
    'utf8',
  );
  const sdkVersionsSource = readFileSync(
    resolve(cliSourceRoot, 'start/doctor/dependencies/getVersionedPackages.js'),
    'utf8',
  );
  const checkSource = readFileSync(resolve(cliSourceRoot, 'install/checkPackages.js'), 'utf8');

  assert.match(nativeModulesSource, /!_env\.env\.EXPO_OFFLINE/);
  assert.match(nativeModulesSource, /expo\/bundledNativeModules\.json/);
  assert.match(sdkVersionsSource, /if \(_env\.env\.EXPO_OFFLINE\)/);
  assert.match(checkSource, /getVersionedDependenciesAsync/);
  assert.match(checkSource, /Found outdated dependencies/);
  assert.match(checkSource, /\.exit\([^;]+, 1\)/s);
});

test('deterministic command passes the exact installed lock result', () => {
  const result = runExpoCheck(appRoot);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    dependencies: [],
    upToDate: true,
  });
});

test('deterministic Expo check rejects an incompatible installed dependency', (context) => {
  const fixtureRoot = mkdtempSync(join(appRoot, '.expo-compatibility-fixture-'));
  context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  writeFileSync(
    resolve(fixtureRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'expo-compatibility-tamper-fixture',
        private: true,
        dependencies: {
          expo: memberPackage.dependencies.expo,
          'expo-camera': memberPackage.dependencies['expo-camera'],
        },
      },
      null,
      2,
    )}\n`,
  );
  const tamperedPackageRoot = resolve(fixtureRoot, 'node_modules/expo-camera');
  mkdirSync(tamperedPackageRoot, { recursive: true });
  writeFileSync(
    resolve(tamperedPackageRoot, 'package.json'),
    '{"name":"expo-camera","version":"1.0.0"}\n',
  );

  const result = runExpoCheck(fixtureRoot);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.upToDate, false);
  assert.deepEqual(report.dependencies, [
    {
      packageName: 'expo-camera',
      packageType: 'dependencies',
      expectedVersionOrRange: '~57.0.4',
      actualVersion: '1.0.0',
    },
  ]);
});

function runExpoCheck(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [resolve(repositoryRoot, 'node_modules/expo/bin/cli'), 'install', '--check', '--json'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '1',
        EXPO_OFFLINE: '1',
        EXPO_NO_TELEMETRY: '1',
      },
    },
  );
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

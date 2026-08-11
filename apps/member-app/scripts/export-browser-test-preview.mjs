import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const result = spawnSync(
  process.execPath,
  [expoCli, 'export', '--platform', 'web', '--output-dir', 'dist', '--clear'],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW: 'true',
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=1024'
    },
    stdio: 'inherit'
  }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

fs.writeFileSync(
  path.join(projectRoot, 'dist', 'browser-test-preview-build.json'),
  `${JSON.stringify({
    cacheCleared: true,
    browserTestPreviewEnabled: true
  }, null, 2)}\n`
);

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const result = spawnSync(
  process.execPath,
  [expoCli, 'export', '--platform', 'web', '--output-dir', 'dist'],
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

process.exit(result.status ?? 1);

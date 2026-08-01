import { spawnSync } from 'node:child_process';
import path from 'node:path';

const projectRoot = process.cwd();
const expoCli = path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
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

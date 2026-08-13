import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(appRoot, 'src');
const testFilePattern = /\.test\.(?:[cm]?[jt]s|[jt]sx)$/;

const testFiles = (await discoverTestFiles(sourceRoot))
  .map((filePath) => relative(appRoot, filePath).split(sep).join('/'))
  .sort();

if (testFiles.length === 0) {
  throw new Error('No member app test files were discovered under src/.');
}

console.log(`Discovered ${testFiles.length} member app test files.`);

const result = spawnSync(
  process.execPath,
  ['--import=tsx', '--test', ...testFiles],
  {
    cwd: appRoot,
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

async function discoverTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const discovered = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) return discoverTestFiles(entryPath);
      return entry.isFile() && testFilePattern.test(entry.name)
        ? [entryPath]
        : [];
    }),
  );

  return discovered.flat();
}

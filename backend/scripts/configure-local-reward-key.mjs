import { randomBytes } from 'node:crypto';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const environmentPath = join(backendDirectory, '.env');
const temporaryPath = join(
  backendDirectory,
  `.env.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
);
const secretName = 'REWARD_CODE_ENCRYPTION_KEY';

const existing = await readFile(environmentPath, 'utf8');
const lineEnding = existing.includes('\r\n') ? '\r\n' : '\n';
const lines = existing
  .split(/\r?\n/)
  .filter((line) => !/^HYPERWALLET_[A-Z0-9_]*=/.test(line));

const existingSecret = lines
  .find((line) => line.startsWith(`${secretName}=`))
  ?.slice(secretName.length + 1)
  .trim();
const secret = isValidKey(existingSecret)
  ? existingSecret
  : randomBytes(32).toString('base64');
const secretLine = `${secretName}=${secret}`;
const secretIndex = lines.findIndex((line) =>
  line.startsWith(`${secretName}=`),
);

if (secretIndex >= 0) {
  lines[secretIndex] = secretLine;
} else {
  while (lines.at(-1) === '') lines.pop();
  lines.push(secretLine, '');
}

await writeFile(temporaryPath, lines.join(lineEnding), {
  encoding: 'utf8',
  mode: 0o600,
  flag: 'wx',
});
await rename(temporaryPath, environmentPath);
await chmod(environmentPath, 0o600);

console.log(
  `Local reward key ${existingSecret ? 'preserved' : 'generated'} in ignored backend/.env; secret value was not printed.`,
);

function isValidKey(value) {
  if (!value) return false;

  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === value;
}

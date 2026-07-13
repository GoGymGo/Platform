import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.terraform',
  'coverage',
  'dist',
  'node_modules',
]);
const prohibitedExtensions = new Set(['.jks', '.key', '.p12', '.pfx', '.pem']);
const prohibitedContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[opsu]_[A-Za-z0-9_]{20,}/,
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/,
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

const files = await listFiles(root);
const violations = [];

for (const file of files) {
  const relativePath = relative(root, file).replaceAll('\\', '/');
  if (prohibitedExtensions.has(extname(file).toLowerCase())) {
    violations.push(`${relativePath}: prohibited credential-file extension`);
    continue;
  }

  if (/^\.env(?:\.|$)/.test(relativePath) && relativePath !== '.env.example') {
    violations.push(
      `${relativePath}: populated environment file must not be committed`,
    );
    continue;
  }

  if (!/\.(?:c?js|json|md|mjs|tf|tfvars|ts|txt|ya?ml)$/.test(file)) {
    continue;
  }

  const content = await readFile(file, 'utf8');
  for (const pattern of prohibitedContent) {
    if (pattern.test(content)) {
      violations.push(
        `${relativePath}: content resembles a committed credential`,
      );
    }
  }
}

const packageJson = JSON.parse(
  await readFile(join(root, 'package.json'), 'utf8'),
);
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
for (const dependency of ['@supabase/supabase-js', 'plaid', 'stripe']) {
  if (dependency in dependencies) {
    violations.push(
      `package.json: ${dependency} adds an unapproved financial or data boundary`,
    );
  }
}

if (violations.length > 0) {
  console.error(
    `Backend source audit failed:\n${violations.map((value) => `- ${value}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Backend source audit passed: ${files.length} files inspected.`);
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');

const consumers = [
  {
    name: 'admin',
    path: path.join(repositoryRoot, 'apps/admin/app/globals.css'),
    required: [
      '@import "@gogymgo/brand/web.css"',
      '--bg: var(--gogymgo-background)',
      '--muted: var(--gogymgo-muted)',
      '--body: var(--gogymgo-font-body)'
    ]
  },
  {
    name: 'landing',
    path: path.join(repositoryRoot, 'apps/landing/app/globals.css'),
    required: [
      '@import "@gogymgo/brand/web.css"',
      '--background: var(--gogymgo-background)',
      '--muted: var(--gogymgo-muted)',
      '--body: var(--gogymgo-font-body)'
    ]
  }
];

const duplicatedCoreColor =
  /#(?:080b0e|0b1118|0f1720|e9f7f8|96aab0|34e5e8|9ff3f5|ff2d9b|4dff88|ffe066|ff0000)\b/i;

for (const consumer of consumers) {
  const source = fs.readFileSync(consumer.path, 'utf8');
  for (const token of consumer.required) {
    if (!source.includes(token)) {
      throw new Error(`${consumer.name} is missing canonical brand mapping: ${token}`);
    }
  }
  const duplicate = source.match(duplicatedCoreColor);
  if (duplicate) {
    throw new Error(
      `${consumer.name} duplicates canonical colour ${duplicate[0]}; use the shared web token instead.`
    );
  }
}

const memberFiles = collectSourceFiles(path.join(repositoryRoot, 'apps/member-app'));
for (const filePath of memberFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (/Rajdhani/i.test(source) && !filePath.endsWith('audit-source.mjs')) {
    throw new Error(`Member app retains a retired Rajdhani reference: ${filePath}`);
  }
}

const memberTheme = fs.readFileSync(
  path.join(repositoryRoot, 'apps/member-app/src/constants/theme.ts'),
  'utf8'
);
for (const marker of [
  "import { brandColors, brandFonts } from '@gogymgo/brand'",
  "android: 'sans-serif'",
  "ios: 'System'",
  'web: brandFonts.body'
]) {
  if (!memberTheme.includes(marker)) {
    throw new Error(`Member app is missing canonical typography mapping: ${marker}`);
  }
}

console.log('Brand consumer audit passed: landing, admin and member typography and core colours align.');

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', '.next', '.expo'].includes(entry.name)) return [];
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(?:ts|tsx|js|mjs|json)$/.test(entry.name) ? [entryPath] : [];
  });
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { brandAssets, brandColors } from '../src/index.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const missingAssets = Object.values(brandAssets).filter(
  (assetPath) => !fs.existsSync(path.join(packageRoot, assetPath))
);
const markPng = fs.readFileSync(path.join(packageRoot, brandAssets.mark));
const markSource = fs.readFileSync(path.join(packageRoot, brandAssets.markVector), 'utf8');
const wordmarkSource = fs.readFileSync(path.join(packageRoot, brandAssets.wordmark), 'utf8');

if (brandColors.cyan !== '#34E5E8' || brandColors.pink !== '#FF2D9B') {
  throw new Error('Canonical cyan or pink brand token changed unexpectedly.');
}

if (missingAssets.length > 0) {
  throw new Error(`Missing canonical brand assets: ${missingAssets.join(', ')}`);
}

if (
  !markPng.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
  markPng.readUInt32BE(16) !== 510 ||
  markPng.readUInt32BE(20) !== 510
) {
  throw new Error('Canonical compact mark PNG must be the approved 510x510 source asset.');
}

for (const requiredMarkFragment of [
  'id="brand-mark-frame"',
  'id="brand-mark-g"',
  'id="brand-mark-trace"',
  'stroke="#34E5E8"',
  'stroke="#FF2D9B"'
]) {
  if (!markSource.includes(requiredMarkFragment)) {
    throw new Error(`Canonical compact mark is missing ${requiredMarkFragment}.`);
  }
}

if (!wordmarkSource.includes('fill="#34E5E8"') || !wordmarkSource.includes('fill="#FF2D9B"')) {
  throw new Error('Canonical wordmark must retain the cyan GO / pink GYM / cyan GO treatment.');
}

console.log(`Brand package validated: ${Object.keys(brandColors).length} colours and ${Object.keys(brandAssets).length} assets.`);

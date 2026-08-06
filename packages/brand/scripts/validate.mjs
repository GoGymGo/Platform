import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { brandAssets, brandColors, brandFonts } from '../src/index.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const missingAssets = Object.values(brandAssets).filter(
  (assetPath) => !fs.existsSync(path.join(packageRoot, assetPath))
);

if (brandColors.cyan !== '#34E5E8' || brandColors.pink !== '#FF2D9B') {
  throw new Error('Canonical cyan or pink brand token changed unexpectedly.');
}

if (
  brandFonts.body !== 'Rajdhani-Medium' ||
  brandFonts.bodyStrong !== 'Rajdhani-SemiBold' ||
  brandFonts.display !== 'Orbitron-Bold' ||
  brandFonts.mono !== 'ShareTechMono-Regular'
) {
  throw new Error('Canonical brand font registrations changed unexpectedly.');
}

if (missingAssets.length > 0) {
  throw new Error(`Missing canonical brand assets: ${missingAssets.join(', ')}`);
}

console.log(
  `Brand package validated: ${Object.keys(brandColors).length} colours, ${Object.keys(brandFonts).length} fonts and ${Object.keys(brandAssets).length} assets.`
);

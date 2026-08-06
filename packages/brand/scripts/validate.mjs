import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { brandAssets, brandColors, brandFonts } from '../src/index.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const missingAssets = Object.values(brandAssets).filter(
  (assetPath) => !fs.existsSync(path.join(packageRoot, assetPath))
);
const markPng = fs.readFileSync(path.join(packageRoot, brandAssets.mark));
const markSource = fs.readFileSync(path.join(packageRoot, brandAssets.markVector), 'utf8');
const wordmarkSource = fs.readFileSync(path.join(packageRoot, brandAssets.wordmark), 'utf8');
const webTokens = fs.readFileSync(path.join(packageRoot, 'src/web.css'), 'utf8');

if (brandColors.cyan !== '#34E5E8' || brandColors.pink !== '#FF2D9B') {
  throw new Error('Canonical cyan or pink brand token changed unexpectedly.');
}

if (
  brandFonts.body !== '"Segoe UI", Arial, sans-serif' ||
  brandFonts.bodyStrong !== '"Segoe UI", Arial, sans-serif' ||
  brandFonts.display !== 'Orbitron-Bold' ||
  brandFonts.mono !== 'ShareTechMono-Regular'
) {
  throw new Error('Canonical brand font registrations changed unexpectedly.');
}

for (const token of [
  '--gogymgo-background: #080b0e',
  '--gogymgo-muted: #96aab0',
  '--gogymgo-cyan: #34e5e8',
  '--gogymgo-font-body: "Segoe UI", Arial, sans-serif',
  '--gogymgo-font-display: "GoGymGo Display"',
  '--gogymgo-font-mono: "GoGymGo Mono"'
]) {
  if (!webTokens.includes(token)) {
    throw new Error(`Canonical web token is missing: ${token}`);
  }
}

if (/Rajdhani/i.test(webTokens)) {
  throw new Error('Rajdhani must not be part of the canonical web typography.');
}

if (missingAssets.length > 0) {
  throw new Error(`Missing canonical brand assets: ${missingAssets.join(', ')}`);
}

console.log(
  `Brand package validated: ${Object.keys(brandColors).length} colours, ${Object.keys(brandFonts).length} fonts and ${Object.keys(brandAssets).length} assets.`
);

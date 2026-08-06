import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { copyFile, readFile } from "node:fs/promises";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const adminDirectory = resolve(scriptDirectory, "..");
const workspaceDirectory = resolve(adminDirectory, "..", "..");
const landingPublicDirectory = resolve(
  workspaceDirectory,
  "apps",
  "landing",
  "public",
);
const mobileImagesDirectory = resolve(
  workspaceDirectory,
  "apps",
  "member-app",
  "assets",
  "images",
);
const markSource = resolve(
  workspaceDirectory,
  "packages",
  "brand",
  "assets",
  "logos",
  "mark.png",
);
const markVectorSource = resolve(
  workspaceDirectory,
  "packages",
  "brand",
  "assets",
  "logos",
  "mark.svg",
);
const [markPng, markSvg] = await Promise.all([
  readFile(markSource),
  readFile(markVectorSource, "utf8"),
]);

async function renderMark(size) {
  return sharp(markPng).resize(size, size).png().toBuffer();
}

async function renderSquareIcon(output, background) {
  await sharp(markPng)
    .resize(1024, 1024)
    .flatten({ background })
    .removeAlpha()
    .png()
    .toFile(output);
}

async function renderTransparentMark(output, markSize) {
  const mark = await renderMark(markSize);
  const inset = Math.round((1024 - markSize) / 2);

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: inset, top: inset }])
    .png()
    .toFile(output);
}

async function renderNotificationIcon(output) {
  const notificationSvg = Buffer.from(
    markSvg
      .replace(/<rect id="brand-mark-background"[^>]*\/>/, "")
      .replaceAll("#34E5E8", "#FFFFFF")
      .replaceAll("#FF2D9B", "#FFFFFF")
      .replace(/\sfilter="url\(#[^)]+\)"/g, ""),
  );

  await sharp(notificationSvg).resize(96, 96).png().toFile(output);
}

await Promise.all([
  renderSquareIcon(resolve(adminDirectory, "public", "icon.png"), "#05090C"),
  renderSquareIcon(resolve(mobileImagesDirectory, "icon.png"), "#080B0E"),
  renderTransparentMark(
    resolve(mobileImagesDirectory, "adaptive-icon.png"),
    680,
  ),
  renderTransparentMark(
    resolve(mobileImagesDirectory, "splash-icon.png"),
    700,
  ),
  renderNotificationIcon(
    resolve(mobileImagesDirectory, "notification-icon.png"),
  ),
  copyFile(markSource, resolve(adminDirectory, "public", "brand-mark.png")),
  copyFile(markSource, resolve(landingPublicDirectory, "mark.png")),
]);

console.log("Generated GoGymGo application assets from the canonical compact mark.");

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const adminDirectory = resolve(scriptDirectory, "..");
const workspaceDirectory = resolve(adminDirectory, "..");
const mobileImagesDirectory = resolve(
  workspaceDirectory,
  "mobile-app",
  "assets",
  "images",
);
const markSource = resolve(adminDirectory, "public", "brand-mark.svg");
const markSvg = await readFile(markSource, "utf8");

async function renderMark(size) {
  return sharp(Buffer.from(markSvg)).resize(size, size).png().toBuffer();
}

async function renderSquareIcon(output, background) {
  const markSize = 860;
  const mark = await renderMark(markSize);
  const inset = Math.round((1024 - markSize) / 2);

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background,
    },
  })
    .composite([{ input: mark, left: inset, top: inset }])
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
    markSvg.replace("#34E5E8", "#FFFFFF"),
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
]);

console.log("Generated GoGymGo brand assets from public/brand-mark.svg.");

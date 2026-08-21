import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const artifactRoot = path.resolve(projectRoot, process.argv[2] ?? "dist");
const clientRoot = path.join(artifactRoot, "client");
const serverEntry = path.join(artifactRoot, "server", "index.js");
const issues = [];

if (!fs.existsSync(clientRoot) || !fs.statSync(clientRoot).isDirectory()) {
  issues.push(`client artifact is missing: ${clientRoot}`);
}
if (!fs.existsSync(serverEntry) || !fs.statSync(serverEntry).isFile()) {
  issues.push(`server artifact is missing: ${serverEntry}`);
}

const clientFiles = fs.existsSync(clientRoot) ? collectFiles(clientRoot) : [];
const publicText = Buffer.concat(
  clientFiles
    .filter(isPublicTextFile)
    .map((filePath) => fs.readFileSync(filePath)),
).toString("utf8");

for (const marker of [
  "browser-test-preview",
  "codex-preview",
  "gogymgo-admin-control.wilson-1212.chatgpt.site",
  "GOGYMGO_LANDING_FORWARDING_SECRET",
  "LANDING_D1_EXPORT_OWNER_USER_ID",
  "Northline Wellness",
  "preview.player@example.com",
  "trycloudflare.com",
  "winners-circle.webp",
  "active-workout.webp",
]) {
  if (publicText.includes(marker)) {
    issues.push(`public client artifact contains forbidden marker ${JSON.stringify(marker)}`);
  }
}

const publicNames = new Set(
  clientFiles.map((filePath) => path.relative(clientRoot, filePath).replaceAll("\\", "/")),
);
for (const required of [
  "app/join-selection.jpg",
  "app/public-demo.jpg",
  "og.png",
  "mark.svg",
]) {
  if (!publicNames.has(required)) {
    issues.push(`public client artifact is missing ${required}`);
  }
}
for (const removed of [
  "app/active-workout.webp",
  "app/winners-circle.webp",
]) {
  if (publicNames.has(removed)) {
    issues.push(`retired public asset remains in the artifact: ${removed}`);
  }
}

const siteLinkBundles = clientFiles.filter((filePath) =>
  path.basename(filePath).startsWith("site-links-"),
);
if (siteLinkBundles.length !== 1) {
  issues.push(`expected one compiled site-links bundle, found ${siteLinkBundles.length}`);
} else {
  const siteLinkSource = fs.readFileSync(siteLinkBundles[0], "utf8");
  for (const marker of ["localhost", "127.0.0.1", "chatgpt.site", "trycloudflare.com"]) {
    if (siteLinkSource.includes(marker)) {
      issues.push(`compiled public-link bundle contains ${JSON.stringify(marker)}`);
    }
  }
  for (const required of [
    "https://app.gogymgo.com",
    "/join",
    "/demo",
    "/official-rules",
    "/privacy-policy",
  ]) {
    if (!siteLinkSource.includes(required)) {
      issues.push(`compiled public-link bundle is missing ${JSON.stringify(required)}`);
    }
  }
}

if (fs.existsSync(serverEntry)) {
  const serverSource = fs.readFileSync(serverEntry, "utf8");
  for (const required of [
    "Content-Security-Policy",
    "GOGYMGO_LANDING_FORWARDING_SECRET",
    "Idempotency-Key",
    "LANDING_D1_EXPORT_CUTOFF_EXCLUSIVE",
    "LANDING_D1_EXPORT_OWNER_USER_ID",
    "Permissions-Policy",
    "PUBLIC_SITE_EVENT_RETENTION_DAYS",
    "PUBLIC_SITE_FEEDBACK_RETENTION_DAYS",
    "camera=(), geolocation=(), microphone=()",
    "public_site_operations_audit",
    "public_site_rate_buckets",
    "gogymgo.landing-interest-export-page",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
  ]) {
    if (!serverSource.includes(required)) {
      issues.push(`server artifact is missing security marker ${JSON.stringify(required)}`);
    }
  }
}

if (issues.length > 0) {
  console.error("Landing production artifact audit failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Landing production artifact audit passed across ${clientFiles.length} client files: canonical member routes are allowlisted, retired/preview/private markers are absent, and response security headers are compiled.`,
  );
}

function collectFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function isPublicTextFile(filePath) {
  return /\.(?:css|html|js|json|mjs|svg|txt|webmanifest|xml)$/i.test(filePath);
}

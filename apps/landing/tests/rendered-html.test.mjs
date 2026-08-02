import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the landing page contains the finished GoGymGo experience", async () => {
  const [page, layout, productScreens, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/components/ProductScreens.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(layout, /GoGymGo — Make consistency count/);
  assert.match(page, /Make consistency/);
  assert.match(page, /Complete verified workouts/i);
  assert.match(page, /TRY THE APP FLOW/);
  assert.match(page, /OPEN THE APP DEMO/);
  assert.match(layout, /href="https:\/\/app\.gogymgo\.com\/demo"/);
  assert.match(layout, /href="https:\/\/app\.gogymgo\.com\/join"/);
  assert.match(productScreens, /<GoalScreen \/>/);
  assert.match(productScreens, /<TimerScreen \/>/);
  assert.match(productScreens, /<RewardsLeaderboardScreen \/>/);
  assert.equal((productScreens.match(/<PhoneShell/g) ?? []).length, 3);
  assert.match(productScreens, /FOUR-WEEK BASE/);
  assert.match(productScreens, /Earn more through consistency, teamwork and competition/);
  assert.match(productScreens, /PACIFIC MOTION TRAINING KIT/);
  assert.doesNotMatch(page, /next\/image|\/app\/(?:home|rewards|active-workout|challenge)\.png/);
  assert.equal((layout.match(/wordmark-cyan">GO/g) ?? []).length, 4);
  assert.equal((layout.match(/wordmark-pink">GYM/g) ?? []).length, 2);
  assert.doesNotMatch(page + layout + packageJson, /codex-preview|react-loading-skeleton/i);
});

test("the retired landing demo redirects to the canonical member demo", async () => {
  const demoPage = await readFile(new URL("app/demo/page.tsx", root), "utf8");

  assert.match(demoPage, /redirect\("https:\/\/app\.gogymgo\.com\/demo"\)/);
  await assert.rejects(
    readFile(new URL("app/components/DemoCompetition.tsx", root), "utf8"),
  );
});

test("both audience pages expose their intended forms", async () => {
  const [gymPage, brandPage, forms] = await Promise.all([
    readFile(new URL("app/gym-goers/page.tsx", root), "utf8"),
    readFile(new URL("app/brands/page.tsx", root), "utf8"),
    readFile(new URL("app/components/InterestForms.tsx", root), "utf8"),
  ]);

  assert.match(gymPage, /Pre-register your interest/);
  assert.match(forms, /JOIN THE PRE-REGISTRATION LIST/);
  assert.match(brandPage, /Tell us about your brand/);
  assert.match(forms, /APPLY AS A FOUNDING PARTNER/);
  assert.match(forms, /fetch\("\/api\/interest"/);
});

test("interest forms use the GoGymGo API instead of D1", async () => {
  const route = await readFile(new URL("app/api/interest/route.ts", root), "utf8");

  assert.match(route, /GOGYMGO_API_URL/);
  assert.match(route, /\/v1\/interest-submissions/);
  assert.doesNotMatch(route, /env\.DB|interest_submissions|ensureInterestTable/);
});

test("the historical D1 export is disabled, owner-restricted and read-only", async () => {
  const route = await readFile(
    new URL("app/api/internal/export-interest-submissions/route.ts", root),
    "utf8",
  );

  assert.match(route, /LANDING_D1_EXPORT_ENABLED !== "yes"/);
  assert.match(route, /LANDING_D1_EXPORT_OWNER_EMAIL/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /user\.email\.trim\(\)\.toLowerCase\(\) !== ownerEmail/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /getDb\(\)/);
  assert.match(route, /\.select\(\)/);
  assert.doesNotMatch(route, /\.(?:insert|update|delete)\(/);
  assert.doesNotMatch(route, /ensureInterestTable/);
});

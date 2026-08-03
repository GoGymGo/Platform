import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the landing page contains real member-app screen captures", async () => {
  const [
    page,
    layout,
    productScreens,
    mobileNavigation,
    packageJson,
    weeklyGoal,
    train,
    competition,
  ] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/components/ProductScreens.tsx", root), "utf8"),
    readFile(new URL("app/components/MobileNavigation.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/app/weekly-goal.png", root)),
    readFile(new URL("public/app/train.png", root)),
    readFile(new URL("public/app/competition.png", root)),
  ]);

  assert.match(layout, /GoGymGo — Make consistency count/);
  assert.match(page, /Make consistency/);
  assert.match(page, /Complete verified workouts/i);
  assert.match(layout, /href="https:\/\/app\.gogymgo\.com\/demo"/);
  assert.match(layout, /href="https:\/\/app\.gogymgo\.com\/"/);
  assert.match(
    layout,
    /href="https:\/\/admin\.gogymgo\.com">ADMIN<\/[^>]+>/,
  );
  assert.match(layout, /className="header-cta button-primary"/);
  assert.match(layout, /<MobileNavigation \/>/);
  assert.match(mobileNavigation, /aria-expanded=\{isOpen\}/);
  assert.match(mobileNavigation, /Mobile navigation/);
  assert.match(mobileNavigation, /https:\/\/app\.gogymgo\.com\/demo/);
  assert.match(mobileNavigation, /https:\/\/admin\.gogymgo\.com/);
  assert.match(
    page,
    /className="button button-primary"\s+href="https:\/\/app\.gogymgo\.com\/"/,
  );
  assert.match(
    page,
    /Join our beta to participate in the \$100 September Vancouver/,
  );
  assert.match(page, /Island Challenge\./);
  assert.equal(
    (page.match(/href="https:\/\/app\.gogymgo\.com\/"/g) ?? []).length,
    2,
  );
  assert.equal(
    (layout.match(/href="https:\/\/app\.gogymgo\.com\/demo"/g) ?? []).length,
    1,
  );
  assert.match(page, /\/app\/weekly-goal\.png/);
  assert.match(page, /member app Weekly Goal selection screen/);
  assert.doesNotMatch(page, /join-selection/);
  assert.match(productScreens, /\/app\/weekly-goal\.png/);
  assert.match(productScreens, /\/app\/train\.png/);
  assert.match(productScreens, /\/app\/competition\.png/);
  assert.equal((productScreens.match(/src: "\/app\//g) ?? []).length, 3);
  assert.match(productScreens, /product-phone--capture/);
  assert.match(productScreens, /REAL MEMBER APP SCREENS/);
  assert.match(productScreens, /live captures from the member app/);

  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (const capture of [weeklyGoal, train, competition]) {
    assert.deepEqual([...capture.subarray(0, 8)], pngSignature);
    assert.ok(capture.length > 10_000);
  }

  assert.doesNotMatch(
    page + layout + productScreens,
    /TRY THE APP FLOW|OPEN THE APP DEMO|WALK THROUGH THE REAL FLOW/,
  );
  assert.doesNotMatch(page + layout, /app\.gogymgo\.com\/join/);
  assert.doesNotMatch(page + productScreens, /next\/image/);
  assert.equal((layout.match(/wordmark-cyan">GO/g) ?? []).length, 4);
  assert.equal((layout.match(/wordmark-pink">GYM/g) ?? []).length, 2);
  assert.doesNotMatch(
    page + layout + packageJson,
    /codex-preview|react-loading-skeleton/i,
  );
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
  const route = await readFile(
    new URL("app/api/interest/route.ts", root),
    "utf8",
  );

  assert.match(route, /GOGYMGO_API_URL/);
  assert.match(route, /\/v1\/interest-submissions/);
  assert.doesNotMatch(
    route,
    /env\.DB|interest_submissions|ensureInterestTable/,
  );
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

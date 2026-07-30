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
  assert.match(layout, /href="\/demo"/);
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

test("the demo page mirrors the real app flow without backend side effects", async () => {
  const [demoPage, demoCompetition] = await Promise.all([
    readFile(new URL("app/demo/page.tsx", root), "utf8"),
    readFile(new URL("app/components/DemoCompetition.tsx", root), "utf8"),
  ]);

  assert.match(demoPage, /<DemoCompetition \/>/);
  assert.match(demoCompetition, /INTERACTIVE APP WALKTHROUGH/);
  assert.match(demoCompetition, /Use the <span>real flow\.<\/span>/);
  assert.doesNotMatch(demoCompetition, /Try the loop/i);
  assert.match(demoCompetition, /gogymgo-app-flow-demo-v2/);
  assert.match(demoCompetition, /REGION \+ AGREEMENTS/);
  assert.match(demoCompetition, /CHOOSE YOUR WEEKLY GOAL/);
  assert.match(demoCompetition, /START WORKOUT/);
  assert.match(demoCompetition, /COMPLETE DEMO SESSION/);
  assert.match(demoCompetition, /WINNERS CIRCLE/);
  assert.equal((demoCompetition.match(/id: "/g) ?? []).length, 8);
  assert.match(
    demoCompetition,
    /no real account,\s+competition standing, Prize Draw Entry, or reward/i,
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

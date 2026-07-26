import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the landing page contains the finished GoGymGo experience", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(layout, /GoGymGo — Make consistency count/);
  assert.match(page, /Consistency/);
  assert.match(page, /verified gym attendance/i);
  assert.match(page, /PRE-REGISTER/);
  assert.match(page, /PARTNER WITH US/);
  assert.doesNotMatch(page + layout + packageJson, /codex-preview|react-loading-skeleton/i);
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

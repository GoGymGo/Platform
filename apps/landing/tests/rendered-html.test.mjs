import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the landing page separates beta registration from regional updates", async () => {
  const [page, layout, productScreens] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/components/ProductScreens.tsx"),
  ]);

  assert.match(page, /SEPTEMBER 2026 BETA \/\/ REGISTRATION OPEN/);
  assert.match(page, /Vancouver Island \+ Gulf Islands/);
  assert.match(page, /age 19\+/);
  assert.match(page, /one \$100 CAD reward/);
  assert.match(page, /sponsored by GoGymGo/i);
  assert.match(page, /JOIN THE SEPTEMBER BETA/);
  assert.match(page, /GET REGIONAL UPDATES/);
  assert.match(page, /does not register you for the beta/i);
  assert.doesNotMatch(page, /PRE-REGISTRATION OPEN/);
  assert.doesNotMatch(page, /FUNDED BY SPONSORS/);
  assert.doesNotMatch(page, /desktop experience now|improved app/i);
  assert.doesNotMatch(productScreens, /PRODUCTION MEMBER APP SCREENS/);
  assert.doesNotMatch(productScreens, /weekly-goal/);
  assert.match(productScreens, /active-workout\.webp/);
  assert.match(productScreens, /winners-circle\.webp/);
  assert.equal((productScreens.match(/src: "\/app\//g) ?? []).length, 2);
  assert.match(layout, /JOIN SEPTEMBER BETA/);
  assert.doesNotMatch(layout, /Administrator sign-in|admin-control/);
});

test("shared navigation exposes current state, trust links and keyboard-safe mobile behavior", async () => {
  const [layout, desktopNavigation, mobileNavigation, links] = await Promise.all([
    read("app/layout.tsx"),
    read("app/components/DesktopNavigation.tsx"),
    read("app/components/MobileNavigation.tsx"),
    read("app/site-links.ts"),
  ]);

  assert.match(desktopNavigation, /usePathname/);
  assert.match(desktopNavigation, /aria-current/);
  assert.match(mobileNavigation, /aria-current/);
  assert.match(mobileNavigation, /event\.key === "Escape"/);
  assert.match(mobileNavigation, /event\.key === "Tab"/);
  assert.match(mobileNavigation, /document\.body\.style\.overflow = "hidden"/);
  assert.match(layout, /tabIndex=\{-1\}/);
  assert.match(layout, /Privacy Policy/);
  assert.match(layout, /Terms of Service/);
  assert.match(layout, /Official Contest Rules/);
  assert.match(layout, /Accessibility/);
  assert.match(layout, /Contact/);
  assert.match(links, /app\.gogymgo\.com\/privacy-policy/);
  assert.match(links, /app\.gogymgo\.com\/terms-of-service/);
  assert.match(links, /app\.gogymgo\.com\/official-rules/);
});

test("audience pages put the form before supporting detail and explain each outcome", async () => {
  const [gymPage, brandPage, forms] = await Promise.all([
    read("app/gym-goers/page.tsx"),
    read("app/brands/page.tsx"),
    read("app/components/InterestForms.tsx"),
  ]);

  assert.ok(gymPage.indexOf('id="gym-form"') < gymPage.indexOf("audience-details"));
  assert.ok(brandPage.indexOf('id="brand-form"') < brandPage.indexOf("audience-details"));
  assert.match(gymPage, /does not create an app account/);
  assert.match(gymPage, /age 19\+/);
  assert.match(
    brandPage,
    /current\s+September pilot reward is sponsored by GoGymGo/,
  );
  assert.match(brandPage, /aim to respond within\s+five business days/);
  assert.match(brandPage, /03 \/\/ REVIEW AND PUBLISH/);
  assert.match(forms, /\[1, 2, 3, 4, 5, 6, 7\]/);
  assert.doesNotMatch(forms, /defaultChecked/);
  assert.match(forms, /name="partnershipInterest"/);
  assert.doesNotMatch(forms, /name="interest"/);
  assert.match(forms, /value\.trim\(\)\.length > 0/);
  assert.match(forms, /try \{\s*body = \(await response\.json\(\)\)/);
  assert.match(forms, /aria-busy=\{state === "submitting"\}/);
  assert.match(forms, /successRef\.current\?\.focus\(\)/);
  assert.match(forms, /Privacy Policy/);
  assert.match(forms, /\(OPTIONAL\)/);
});

test("the public site includes recovery, FAQ, contact, accessibility and discovery metadata", async () => {
  const [notFound, faq, contact, accessibility, robots, sitemap, manifest] =
    await Promise.all([
      read("app/not-found.tsx"),
      read("app/faq/page.tsx"),
      read("app/contact/page.tsx"),
      read("app/accessibility/page.tsx"),
      read("app/robots.ts"),
      read("app/sitemap.ts"),
      read("app/manifest.ts"),
    ]);

  assert.match(notFound, /404 \/\/ ROUTE NOT FOUND/);
  assert.match(notFound, /RETURN HOME/);
  assert.match(faq, /Does joining the update list register me for the beta\?/);
  assert.match(faq, /same poster again/);
  assert.match(contact, /Gym-goer updates/);
  assert.match(contact, /Fitness brand partnerships/);
  assert.match(contact, /Existing member support/);
  assert.match(accessibility, /keyboards, screen readers, browser zoom, reduced motion/);
  assert.match(robots, /sitemap: "https:\/\/gogymgo\.com\/sitemap\.xml"/);
  assert.match(sitemap, /"\/accessibility"/);
  assert.match(manifest, /theme_color: "#080b0e"/);
});

test("the public styles contain only landing surfaces and address responsive readability", async () => {
  const [globals, experience] = await Promise.all([
    read("app/globals.css"),
    read("app/experience.css"),
  ]);
  const styles = globals + experience;

  assert.doesNotMatch(styles, /\.demo-/);
  assert.doesNotMatch(globals, /@import "tailwindcss"/);
  assert.doesNotMatch(globals, /Rajdhani/);
  assert.match(globals, /\.field label,[\s\S]*?font-size: 12px;/);
  assert.match(globals, /input::placeholder,[\s\S]*?color: #8fa0a8;/);
  assert.match(globals, /@media \(max-width: 960px\)[\s\S]*?"copy" auto[\s\S]*?"form" auto[\s\S]*?"details" auto/);
  assert.match(globals, /\.audience-hero \{[\s\S]*?"copy form"[\s\S]*?"details form"/);
  assert.match(experience, /\.product-screen-grid \{[\s\S]*?repeat\(2/);
});

test("optimized product images and the social preview are valid assets", async () => {
  const [activeWorkout, winnersCircle, socialImage, mark] = await Promise.all([
    readFile(new URL("public/app/active-workout.webp", root)),
    readFile(new URL("public/app/winners-circle.webp", root)),
    readFile(new URL("public/og.png", root)),
    read("public/mark.svg"),
  ]);

  for (const image of [activeWorkout, winnersCircle]) {
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
    assert.ok(image.length > 10_000);
    assert.ok(image.length < 100_000);
  }

  assert.deepEqual([...socialImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(mark, /viewBox="0 0 100 100"/);
});

test("the retired landing demo redirects to the canonical member demo", async () => {
  const demoPage = await read("app/demo/page.tsx");

  assert.match(demoPage, /redirect\("https:\/\/app\.gogymgo\.com\/demo"\)/);
});

test("interest forms use the GoGymGo API instead of D1", async () => {
  const route = await read("app/api/interest/route.ts");

  assert.match(route, /GOGYMGO_API_URL/);
  assert.match(route, /\/v1\/interest-submissions/);
  assert.doesNotMatch(route, /env\.DB|interest_submissions|ensureInterestTable/);
});

test("the historical D1 export remains disabled, owner-restricted and read-only", async () => {
  const route = await read(
    "app/api/internal/export-interest-submissions/route.ts",
  );

  assert.match(route, /LANDING_D1_EXPORT_ENABLED !== "yes"/);
  assert.match(route, /LANDING_D1_EXPORT_OWNER_EMAIL/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /getDb\(\)/);
  assert.match(route, /\.select\(\)/);
  assert.doesNotMatch(route, /\.(?:insert|update|delete)\(/);
});

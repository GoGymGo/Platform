import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("campaign facts have one landing-owned source of truth", async () => {
  const [campaign, page, gymPage, faq] = await Promise.all([
    read("app/campaign.ts"),
    read("app/page.tsx"),
    read("app/gym-goers/page.tsx"),
    read("app/faq/page.tsx"),
  ]);

  assert.match(campaign, /September 1, 2026 at 12:00 a\.m\. PDT/);
  assert.match(campaign, /October 1, 2026 at 12:00 a\.m\. PDT/);
  assert.match(campaign, /REGISTRATION OPEN/);
  assert.match(campaign, /can close when the competition ends, reaches an entrant cap, or is cancelled/);
  assert.match(campaign, /Denman/);
  assert.match(campaign, /South Pender/);
  assert.match(campaign, /Thetis/);
  assert.match(campaign, /competitionStartAt: "2026-09-01T07:00:00\.000Z"/);
  assert.match(campaign, /competitionEndAt: "2026-10-01T07:00:00\.000Z"/);
  assert.match(campaign, /currentTime >= endTime/);
  assert.match(campaign, /currentTime >= startTime/);
  assert.match(campaign, /primaryLabel: "CHECK CURRENT AVAILABILITY"/);
  assert.match(campaign, /primaryLabel: "GET REGIONAL UPDATES"/);
  assert.match(page, /getSeptemberCampaignState\(\)/);
  assert.match(gymPage, /getSeptemberCampaignState\(\)/);
  assert.match(faq, /septemberCampaign\.competitionWindow/);
  assert.match(faq, /Bowen Island/);
  assert.match(faq, /Gambier Island Local Trust Area/);
  assert.match(faq, /audited draw determines the\s+reward winner/);
});

test("home offers direct next steps without repeating long feature sections", async () => {
  const [page, layout, productScreens, links] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/components/ProductScreens.tsx"),
    read("app/site-links.ts"),
  ]);

  assert.match(page, /with one \{septemberCampaign\.reward\} reward sponsored by/);
  assert.match(page, /\{campaignState\.primaryLabel\}/);
  assert.match(page, /campaignState\.phase === "ended"/);
  assert.match(page, /siteLinks\.regionalUpdates/);
  assert.match(page, /siteLinks\.officialRules/);
  assert.match(page, /className="eyebrow campaign-status"/);
  assert.match(page, /Registration and final eligibility checks happen in the member app/);
  assert.match(page, /Regional updates do not create an account or competition entry/);
  assert.match(page, /aria-label="September beta essentials" className="hero-qualifiers"/);
  assert.match(page, /OUTSIDE THE PILOT REGION\? GET UPDATES/);
  assert.match(page, /<details className="campaign-details">/);
  assert.match(page, /\{septemberCampaign\.minimumSessionMinutes\}\+ MIN/);
  assert.doesNotMatch(page, />30:00</);
  assert.doesNotMatch(page, /BUILT FOR CLARITY/);
  assert.doesNotMatch(page, /brand-console|landing-feature-grid/);
  assert.match(productScreens, /active-workout\.webp/);
  assert.match(productScreens, /winners-circle\.webp/);
  assert.match(productScreens, /SWIPE TO PREVIEW BOTH APP SCREENS/);
  assert.match(productScreens, /SWIPE TO PREVIEW BOTH APP SCREENS →/);
  assert.doesNotMatch(productScreens, /â†’/);
  assert.match(productScreens, /tabIndex=\{0\}/);
  assert.equal((productScreens.match(/src: "\/app\//g) ?? []).length, 2);
  assert.match(links, /regionalUpdates: "\/gym-goers#gym-form"/);
  assert.match(layout, /href=\{siteLinks\.regionalUpdates\}[\s\S]*?Regional launch updates/);
  assert.match(layout, /width: 1200/);
  assert.match(layout, /height: 630/);
  assert.doesNotMatch(layout, /Administrator sign-in|admin-control/);
});

test("local preview and hosted deployment use compatible runtime settings", async () => {
  const [viteConfig, sitesPlugin] = await Promise.all([
    read("vite.config.ts"),
    read("build/sites-vite-plugin.ts"),
  ]);

  assert.match(viteConfig, /compatibility_date: "2026-05-22"/);
  assert.match(viteConfig, /compatibility_flags: \["nodejs_compat"\]/);
  assert.match(sitesPlugin, /config\.compatibility_date = "2026-08-04"/);
  assert.match(sitesPlugin, /flag !== "nodejs_compat"/);
  assert.match(sitesPlugin, /delete config\.compatibility_flags/);
});

test("mobile navigation uses native modal semantics and current-page state", async () => {
  const [layout, desktopNavigation, mobileNavigation, globals, links] = await Promise.all([
    read("app/layout.tsx"),
    read("app/components/DesktopNavigation.tsx"),
    read("app/components/MobileNavigation.tsx"),
    read("app/globals.css"),
    read("app/site-links.ts"),
  ]);
  const primaryNavigation = links.slice(links.indexOf("export const primaryNavigationItems"));

  assert.match(desktopNavigation, /usePathname/);
  assert.match(desktopNavigation, /aria-current/);
  assert.match(mobileNavigation, /<dialog/);
  assert.match(mobileNavigation, /showModal\(\)/);
  assert.match(mobileNavigation, /onCancel/);
  assert.match(mobileNavigation, /aria-labelledby="mobile-navigation-label"/);
  assert.match(mobileNavigation, /toggleRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(mobileNavigation, /document\.body\.style|event\.key === "Tab"/);
  assert.match(globals, /\.mobile-navigation__panel\[open\][\s\S]*?display: block/);
  assert.match(globals, /\.mobile-navigation__panel::backdrop/);
  assert.match(globals, /\.desktop-navigation a \{[\s\S]*?padding: 8px 6px/);
  assert.match(globals, /@media \(max-width: 980px\)[\s\S]*?\.desktop-navigation \{[\s\S]*?display: none/);
  assert.doesNotMatch(globals, /@media \(max-width: 1080px\)/);
  assert.equal((primaryNavigation.match(/label:/g) ?? []).length, 4);
  assert.match(primaryNavigation, /href: "\/#how-it-works",\s+label: "HOW IT WORKS"/);
  assert.doesNotMatch(
    primaryNavigation,
    /currentPath: "\/",\s+href: "\/#how-it-works"/,
  );
  assert.doesNotMatch(primaryNavigation, /siteLinks\.demo|label: "DEMO"/);
  assert.match(layout, /<AppLink analyticsEvent="demo_click" href=\{siteLinks\.demo\}>/);
  assert.match(layout, /href=\{siteLinks\.demo\}/);
  assert.match(layout, /App demo\s+<\/AppLink>/);
  assert.match(layout, /tabIndex=\{-1\}/);
});

test("the retired eligibility checker stays local-only and the homepage sends decisions to the app", async () => {
  const [page, checker, appLink] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/EligibilityCheck.tsx"),
    read("app/components/AppLink.tsx"),
  ]);

  assert.doesNotMatch(page, /<EligibilityCheck \/>/);
  assert.match(page, /Registration and final eligibility checks happen in the member app/);
  assert.match(checker, /private on-page check is not saved/);
  assert.match(checker, /has not published a public partner-gym directory/);
  assert.match(checker, /name="age"/);
  assert.match(checker, /name="region"/);
  assert.match(checker, /name="partnerGym"/);
  assert.match(checker, /recordPublicSiteEvent\("eligibility_check_completed"\)/);
  assert.doesNotMatch(checker, /fetch\(|localStorage|sessionStorage|document\.cookie/);
  assert.match(appLink, /opens the GoGymGo app/);
  assert.match(appLink, /aria-hidden="true" className="app-link-cue">\s+↗/);
});

test("landing conversion measurement is anonymous, allowlisted, empty by default, and owner-exportable", async () => {
  const [events, analytics, route, exportRoute, schema, migration, accessibilityPage] =
    await Promise.all([
      read("app/public-site-events.ts"),
      read("app/components/PublicSiteAnalytics.tsx"),
      read("app/api/public-site-events/route.ts"),
      read("app/api/internal/export-public-site-events/route.ts"),
      read("db/schema.ts"),
      read("drizzle/0002_funny_expediter.sql"),
      read("app/accessibility/page.tsx"),
    ]);

  assert.equal((events.match(/^  "[a-z_]+",$/gm) ?? []).length, 9);
  assert.match(events, /JSON\.stringify\(\{ eventName, path: window\.location\.pathname \}\)/);
  assert.doesNotMatch(events + analytics, /localStorage|sessionStorage|document\.cookie|userAgent|email/);
  assert.match(analytics, /new WeakSet<HTMLFormElement>/);
  assert.match(analytics, /faq_open/);
  assert.match(route, /publicSiteEventNames\.includes\(eventName\)/);
  assert.match(route, /Invalid public path/);
  assert.match(route, /\.insert\(publicSiteEvents\)/);
  assert.match(schema, /public_site_events/);
  assert.match(schema, /idx_public_site_events_created/);
  assert.match(migration, /CREATE TABLE `public_site_events`/);
  assert.doesNotMatch(migration, /\bINSERT\b/i);
  assert.match(exportRoute, /LANDING_D1_EXPORT_ENABLED !== "yes"/);
  assert.match(exportRoute, /LANDING_D1_EXPORT_OWNER_EMAIL/);
  assert.match(exportRoute, /getChatGPTUser/);
  assert.match(exportRoute, /\.select\(\)/);
  assert.doesNotMatch(exportRoute, /\.(?:insert|update|delete)\(/);
  assert.match(accessibilityPage, /fixed list/);
  assert.match(accessibilityPage, /do not store cookies/);
});

test("regional updates are intentionally short and separate from registration", async () => {
  const [gymPage, forms, regionalRoute, interestRoute] = await Promise.all([
    read("app/gym-goers/page.tsx"),
    read("app/components/InterestForms.tsx"),
    read("app/api/regional-updates/route.ts"),
    read("app/api/interest/route.ts"),
  ]);
  const gymForm = forms.slice(
    forms.indexOf("export function GymGoerForm"),
    forms.indexOf("export function BrandForm"),
  );

  assert.ok(gymPage.indexOf('id="gym-form"') < gymPage.indexOf("audience-details"));
  assert.match(gymPage, /does not create an app account/);
  assert.match(gymPage, /The app confirms current availability/);
  assert.match(forms, /fetch\("\/api\/regional-updates"/);
  assert.match(gymForm, /name="email"/);
  assert.match(gymForm, /name="region"/);
  assert.doesNotMatch(gymForm, /name="fullName"|name="workoutStyle"|name="goalDays"|name="discoverySource"/);
  assert.match(forms, /regional availability emails/);
  assert.match(regionalRoute, /\/v1\/region-waitlist/);
  assert.doesNotMatch(regionalRoute, /getDb|env\.DB/);
  assert.match(interestRoute, /\/v1\/interest-submissions/);
  assert.doesNotMatch(interestRoute, /env\.DB|ensureInterestTable/);
});

test("brand inquiry remains detailed and isolated from the regional list", async () => {
  const [brandPage, forms] = await Promise.all([
    read("app/brands/page.tsx"),
    read("app/components/InterestForms.tsx"),
  ]);

  assert.ok(brandPage.indexOf('id="brand-form"') < brandPage.indexOf("audience-details"));
  assert.match(brandPage, /current\s+September pilot reward is sponsored by GoGymGo/);
  assert.match(forms, /fetch\("\/api\/interest"/);
  assert.match(forms, /name="partnershipInterest"/);
  assert.match(forms, /name="companyName"/);
  assert.equal((forms.match(/<fieldset className="form-section/g) ?? []).length, 3);
  assert.match(forms, /<span>01<\/span> CONTACT &amp; COMPANY/);
  assert.match(forms, /<span>02<\/span> CAMPAIGN FIT/);
  assert.match(forms, /<span>03<\/span> CONSENT &amp; NEXT STEP/);
  assert.match(forms, /written approval/);
  assert.match(forms, /aria-busy=\{state === "submitting"\}/);
  assert.match(forms, /successRef\.current\?\.focus\(\)/);
});

test("public-site feedback is accessible, validated, stored and owner-exportable", async () => {
  const [contact, accessibilityPage, form, route, exportRoute, schema, migration] =
    await Promise.all([
      read("app/contact/page.tsx"),
      read("app/accessibility/page.tsx"),
      read("app/components/PublicSiteFeedbackForm.tsx"),
      read("app/api/public-site-feedback/route.ts"),
      read("app/api/internal/export-public-site-feedback/route.ts"),
      read("db/schema.ts"),
      read("drizzle/0001_brown_pestilence.sql"),
    ]);

  assert.match(contact, /id="public-site-help"/);
  assert.match(contact, /PublicSiteFeedbackForm/);
  assert.match(accessibilityPage, /REPORT AN ACCESSIBILITY BARRIER/);
  assert.match(form, /Accessibility barrier/);
  assert.match(form, /minLength=\{20\}/);
  assert.match(form, /Do not include passwords/);
  assert.match(form, /role="alert"/);
  assert.match(route, /publicSiteFeedback/);
  assert.match(route, /contactFax/);
  assert.match(route, /\.insert\(publicSiteFeedback\)/);
  assert.match(schema, /public_site_feedback/);
  assert.match(schema, /idx_public_site_feedback_status_created/);
  assert.match(migration, /CREATE TABLE `public_site_feedback`/);
  assert.match(exportRoute, /LANDING_D1_EXPORT_ENABLED !== "yes"/);
  assert.match(exportRoute, /LANDING_D1_EXPORT_OWNER_EMAIL/);
  assert.match(exportRoute, /getChatGPTUser/);
  assert.match(exportRoute, /\.select\(\)/);
  assert.doesNotMatch(exportRoute, /\.(?:insert|update|delete)\(/);
});

test("FAQ, contact and public information pages are scannable and discoverable", async () => {
  const [notFound, faq, contact, accessibilityPage, robots, sitemap, manifest] =
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
  assert.match(faq, /<details className="faq-item"/);
  assert.match(faq, /<summary>/);
  assert.match(faq, /const faqGroups = \[/);
  assert.match(faq, /JOINING & ELIGIBILITY/);
  assert.match(faq, /WORKOUTS & WEEKLY GOALS/);
  assert.match(faq, /REWARDS & PARTNERSHIPS/);
  assert.match(faq, /className="faq-group-title"/);
  assert.match(faq, /<nav aria-label="FAQ sections" className="faq-jump-nav">/);
  assert.match(faq, /href=\{`#faq-\$\{group\.id\}`\}/);
  assert.match(faq, /Which gyms count as approved partner gyms\?/);
  assert.match(faq, /Does joining the update list register me for the beta\?/);
  assert.match(contact, /Gym-goer updates/);
  assert.match(contact, /Fitness brand partnerships/);
  assert.match(contact, /Existing member support/);
  assert.match(contact, /Public-site feedback/);
  assert.match(accessibilityPage, /keyboards, screen readers, browser zoom, reduced motion/);
  assert.match(robots, /sitemap: "https:\/\/gogymgo\.com\/sitemap\.xml"/);
  assert.match(sitemap, /"\/accessibility"/);
  assert.match(manifest, /theme_color: "#080b0e"/);
});

test("responsive styles prevent short-viewport trapping and mobile overflow", async () => {
  const [globals, experience] = await Promise.all([
    read("app/globals.css"),
    read("app/experience.css"),
  ]);
  const styles = globals + experience;

  assert.doesNotMatch(styles, /\.demo-/);
  assert.doesNotMatch(globals, /@import "tailwindcss"|Rajdhani/);
  assert.doesNotMatch(globals, /radio-grid|radio-card|fieldset-label/);
  assert.match(globals, /\.form-card \{[\s\S]*?position: static/);
  assert.match(globals, /@media \(min-width: 961px\) and \(min-height: 1050px\)[\s\S]*?position: sticky/);
  assert.match(globals, /\.info-page__header h1 \{[\s\S]*?overflow-wrap: anywhere/);
  assert.match(globals, /\.site-header \.wordmark \{[\s\S]*?min-height: 44px/);
  assert.match(globals, /\.campaign-status \{/);
  assert.match(globals, /\.faq-group-title \{/);
  assert.match(globals, /\.faq-group-title \{[\s\S]*?scroll-margin-top: 106px/);
  assert.match(globals, /\.contact-card \{[\s\S]*?min-height: 220px/);
  assert.match(globals, /@media \(max-width: 600px\)[\s\S]*?\.section \{[\s\S]*?padding-block: 64px/);
  assert.match(globals, /@media \(max-width: 600px\)[\s\S]*?\.info-page__header h1 \{[\s\S]*?font-size: clamp\(34px, 10vw, 40px\)[\s\S]*?overflow-wrap: normal[\s\S]*?word-break: normal/);
  assert.match(globals, /@media \(max-width: 600px\)[\s\S]*?\.footer-grid a \{[\s\S]*?min-height: 44px/);
  assert.match(globals, /@media \(max-width: 340px\)[\s\S]*?\.site-header \.wordmark \{[\s\S]*?font-size: 18px/);
  assert.match(globals, /@media \(max-width: 340px\)[\s\S]*?\.header-inner \{[\s\S]*?gap: 6px/);
  assert.match(globals, /@media \(max-width: 340px\)[\s\S]*?\.header-cta \{[\s\S]*?padding-inline: 10px/);
  assert.match(globals, /\.text-link \{[\s\S]*?min-height: 44px/);
  assert.match(globals, /\.contact-grid \{[\s\S]*?repeat\(2/);
  assert.match(globals, /\.faq-item summary \{/);
  assert.match(experience, /scroll-snap-type: x mandatory/);
  assert.match(experience, /\.hero-qualifiers \{/);
  assert.match(experience, /\.hero-qualifiers li \{/);
  assert.match(experience, /\.hero-fallback-link \{[\s\S]*?min-height: 54px/);
  assert.match(experience, /\.campaign-details summary \{[\s\S]*?min-height: 72px/);
  assert.match(experience, /grid-template-columns: repeat\(2, minmax\(min\(82vw, 360px\), 1fr\)\)/);
});

test("campaign metadata describes the public September experience precisely", async () => {
  const [page, layout, manifest] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/manifest.ts"),
  ]);

  for (const source of [page, layout, manifest]) {
    assert.match(source, /September/);
    assert.doesNotMatch(source, /social challenges/i);
  }

  assert.match(layout, /Free September beta/);
  assert.match(layout, /septemberCampaign\.minimumAge/);
  assert.match(layout, /septemberCampaign\.regionName/);
  assert.match(manifest, /Free September 2026 beta/);
  assert.match(manifest, /septemberCampaign\.minimumAge/);
  assert.match(manifest, /septemberCampaign\.regionName/);
});

test("optimized product images and wide social preview are valid assets", async () => {
  const [activeWorkout, winnersCircle, socialImage, socialStat, mark] =
    await Promise.all([
      readFile(new URL("public/app/active-workout.webp", root)),
      readFile(new URL("public/app/winners-circle.webp", root)),
      readFile(new URL("public/og.png", root)),
      stat(new URL("public/og.png", root)),
      read("public/mark.svg"),
    ]);

  for (const image of [activeWorkout, winnersCircle]) {
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
    assert.ok(image.length > 10_000);
    assert.ok(image.length < 100_000);
  }

  assert.deepEqual([...socialImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
  assert.ok(socialStat.size < 600_000);
  assert.match(mark, /viewBox="0 0 100 100"/);

  for (const removed of [
    "public/fonts/Rajdhani-Medium.ttf",
    "public/fonts/Rajdhani-SemiBold.ttf",
    "public/app/active-workout.png",
    "public/app/winners-circle.png",
  ]) {
    await assert.rejects(access(new URL(removed, root)));
  }
});

test("the retired landing demo still redirects to the canonical member demo", async () => {
  const demoPage = await read("app/demo/page.tsx");

  assert.match(demoPage, /redirect\("https:\/\/app\.gogymgo\.com\/demo"\)/);
});

test("historical interest export remains disabled, owner-restricted and read-only", async () => {
  const route = await read("app/api/internal/export-interest-submissions/route.ts");

  assert.match(route, /LANDING_D1_EXPORT_ENABLED !== "yes"/);
  assert.match(route, /LANDING_D1_EXPORT_OWNER_EMAIL/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /\.select\(\)/);
  assert.doesNotMatch(route, /\.(?:insert|update|delete)\(/);
});

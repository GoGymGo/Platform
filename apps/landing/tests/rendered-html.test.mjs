import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function readJpegDimensions(image) {
  assert.deepEqual([...image.subarray(0, 2)], [255, 216]);
  let offset = 2;

  while (offset + 9 < image.length) {
    assert.equal(image[offset], 255);
    const marker = image[offset + 1];
    const length = image.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: image.readUInt16BE(offset + 5),
        width: image.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }

  assert.fail("JPEG dimensions were not found");
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
  assert.match(campaign, /can close when the Contest ends, reaches an entrant cap, or is cancelled/);
  assert.match(campaign, /Denman/);
  assert.match(campaign, /South Pender/);
  assert.match(campaign, /Thetis/);
  assert.match(campaign, /competitionStartAt: "2026-09-01T07:00:00\.000Z"/);
  assert.match(campaign, /competitionEndAt: "2026-10-01T07:00:00\.000Z"/);
  assert.match(campaign, /currentTime >= endTime/);
  assert.match(campaign, /currentTime >= startTime/);
  assert.match(campaign, /NEXT_PUBLIC_SEPTEMBER_PILOT_PUBLISHED/);
  assert.match(campaign, /value === "yes"/);
  assert.match(campaign, /phase: "unpublished"/);
  assert.match(campaign, /statusLabel: "PILOT NOT YET PUBLISHED"/);
  assert.match(campaign, /primaryLabel: "CHECK CURRENT AVAILABILITY"/);
  assert.match(campaign, /primaryLabel: "GET REGIONAL UPDATES"/);
  assert.match(page, /getSeptemberCampaignState\(\)/);
  assert.match(gymPage, /getSeptemberCampaignState\(\)/);
  assert.match(faq, /septemberCampaign\.competitionWindow/);
  assert.match(faq, /Bowen Island/);
  assert.match(faq, /Gambier Island Local Trust Area/);
  assert.match(faq, /audited draw determines the winner after results settle/);
  assert.match(faq, /If the approved September Contest is published/);
  assert.match(faq, /already-completed in-person cash handoff/);
  assert.match(
    faq,
    /does\s+not initiate a bank, card, wallet, or provider transfer/,
  );
  assert.match(page, /PLANNED REWARD — NOT YET PUBLISHED/);
  assert.match(page, /registration and its reward[\s\S]*?remain unavailable until/);
  assert.doesNotMatch(page, /ONE PUBLISHED REWARD/);
});

test("home offers direct next steps without repeating long feature sections", async () => {
  const [page, layout, productScreens, links] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/components/ProductScreens.tsx"),
    read("app/site-links.ts"),
  ]);

  assert.match(page, /<strong>\{septemberCampaign\.reward\}<\/strong>/);
  assert.match(page, /Sponsored by \{septemberCampaign\.rewardSponsor\}/);
  assert.match(page, /\{campaignState\.primaryLabel\}/);
  assert.match(page, /campaignState\.phase === "ended"/);
  assert.match(page, /siteLinks\.regionalUpdates/);
  assert.match(page, /siteLinks\.officialRules/);
  assert.match(page, /className="eyebrow campaign-status"/);
  assert.match(page, /Set a Weekly Goal, verify workouts at a Partner gym/);
  assert.doesNotMatch(page, /hero-campaign-note|hero-action-note|hero-qualifiers/);
  assert.equal(
    (page.match(/OUTSIDE THE PILOT REGION\? GET REGIONAL UPDATES/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(page, /hero-trust-signal/);
  assert.doesNotMatch(page, /Verified workouts at Partner gyms count only after review/);
  assert.match(page, /Live availability, eligibility, and Partner gym status are confirmed/);
  assert.match(page, /className="section conversion-section"/);
  assert.doesNotMatch(page, /proof-strip|proof-grid|brand-teaser-section|final-cta/);
  assert.match(page, /<details className="campaign-details">/);
  assert.match(page, /\{septemberCampaign\.minimumSessionMinutes\}\+ minutes/);
  assert.doesNotMatch(page, />30:00</);
  assert.doesNotMatch(page, /BUILT FOR CLARITY/);
  assert.doesNotMatch(page, /brand-console|landing-feature-grid/);
  assert.match(productScreens, /join-selection\.jpg/);
  assert.match(productScreens, /public-demo\.jpg/);
  assert.equal((productScreens.match(/height: 899/g) ?? []).length, 2);
  assert.equal((productScreens.match(/width: 430/g) ?? []).length, 2);
  assert.match(productScreens, /CANONICAL JOIN/);
  assert.match(productScreens, /FAKE DATA ONLY/);
  assert.match(productScreens, /product-screen-callout/);
  assert.match(productScreens, /SWIPE TO PREVIEW BOTH ROUTES/);
  assert.match(productScreens, /DEMO MODE \/\/ ISOLATED SAMPLE DATA/);
  assert.match(productScreens, /analyticsEvent="demo_click"/);
  assert.match(productScreens, /href=\{siteLinks\.demo\}/);
  assert.match(productScreens, /SWIPE TO PREVIEW BOTH ROUTES →/);
  assert.doesNotMatch(productScreens, /â†’/);
  assert.match(productScreens, /tabIndex=\{0\}/);
  assert.equal((productScreens.match(/src: "\/app\//g) ?? []).length, 2);
  assert.match(links, /regionalUpdates: "\/gym-goers#gym-form"/);
  assert.match(links, /NEXT_PUBLIC_MEMBER_APP_ORIGIN/);
  assert.match(links, /approvedMemberAppOrigins/);
  assert.match(links, /memberApp: memberAppPath\("\/join"\)/);
  assert.match(links, /return null/);
  assert.doesNotMatch(links, /ADMIN_DASHBOARD|chatgpt\.site/);
  assert.match(layout, /href=\{siteLinks\.regionalUpdates\}[\s\S]*?Regional launch updates/);
  assert.match(layout, /href=\{siteLinks\.partners\}>Gym and brand partnerships/);
  assert.doesNotMatch(layout, /Admin dashboard|siteLinks\.adminDashboard/);
  assert.match(layout, /width: 1200/);
  assert.match(layout, /height: 630/);
  assert.doesNotMatch(layout, /Administrator sign-in/);
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
  assert.match(primaryNavigation, /siteLinks\.partners[\s\S]*?label: "PARTNERS"/);
  assert.doesNotMatch(primaryNavigation, /siteLinks\.demo|label: "DEMO"|FITNESS BRANDS/);
  assert.match(layout, /<AppLink analyticsEvent="demo_click" href=\{siteLinks\.demo\}>/);
  assert.match(layout, /href=\{siteLinks\.demo\}/);
  assert.match(layout, /App demo\s+<\/AppLink>/);
  assert.match(layout, /tabIndex=\{-1\}/);
});

test("the homepage sends eligibility decisions to the app", async () => {
  const [page, appLink] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/AppLink.tsx"),
  ]);

  assert.doesNotMatch(page, /<EligibilityCheck \/>/);
  assert.match(page, /analyticsEvent="member_app_click"/);
  assert.match(page, /href=\{siteLinks\.memberApp\}/);
  assert.match(appLink, /opens the GoGymGo app/);
  assert.match(appLink, /data-destination-unavailable="member-app"/);
  assert.match(appLink, /rel="external noopener noreferrer"/);
  assert.match(appLink, /aria-hidden="true" className="app-link-cue">\s+↗/);
});

test("landing conversion measurement is anonymous, allowlisted, empty by default, and owner-exportable", async () => {
  const [events, analytics, handler, route, storage, exportRoute, schema, migration, accessibilityPage] =
    await Promise.all([
      read("app/public-site-events.ts"),
      read("app/components/PublicSiteAnalytics.tsx"),
      read("app/api/public-site-events/handler.ts"),
      read("app/api/public-site-events/route.ts"),
      read("app/api/public-site-storage.ts"),
      read("app/api/internal/export-public-site-events/route.ts"),
      read("db/schema.ts"),
      read("drizzle/0003_spooky_whiplash.sql"),
      read("app/accessibility/page.tsx"),
    ]);

  assert.equal((events.match(/^  [a-z_]+: \{ canonicalPath:/gm) ?? []).length, 8);
  assert.match(events, /JSON\.stringify\(\{ eventName \}\)/);
  assert.match(events, /credentials: "omit"/);
  assert.match(events, /referrerPolicy: "no-referrer"/);
  assert.doesNotMatch(events, /window\.location|pathname|properties|query|userAgent/);
  assert.doesNotMatch(events + analytics, /localStorage|sessionStorage|document\.cookie|email/);
  assert.match(analytics, /new WeakSet<HTMLFormElement>/);
  assert.match(analytics, /faq_open/);
  assert.match(handler, /Object\.hasOwn\(publicSiteEventDefinitions, eventName\)/);
  assert.match(handler, /readSameOriginJsonObject/);
  assert.match(handler, /hasExactKeys/);
  assert.match(route, /readPublicSiteRetentionPolicy/);
  assert.match(storage, /publicSiteEventDefinitions\[eventName\]\.canonicalPath/);
  assert.match(storage, /INSERT INTO public_site_events/);
  assert.match(storage, /\.bind\(/);
  assert.doesNotMatch(storage, /cf-connecting-ip|user-agent|referer|cookie/i);
  assert.match(schema, /public_site_events/);
  assert.match(schema, /idx_public_site_events_created/);
  assert.match(migration, /CREATE TABLE `public_site_rate_buckets`/);
  assert.match(migration, /CREATE TABLE `public_site_operations_audit`/);
  assert.doesNotMatch(migration, /\bINSERT\b/i);
  assert.match(exportRoute, /LANDING_D1_EXPORT_ENABLED/);
  assert.match(exportRoute, /getChatGPTUser/);
  assert.match(exportRoute, /readEventExportPage/);
  assert.match(exportRoute, /exportPublicSiteEvents/);
  assert.match(accessibilityPage, /fixed list/);
  assert.match(accessibilityPage, /do not store cookies/);
  assert.match(accessibilityPage, /never kept longer than[\s\S]*90 days/);
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
  assert.match(forms, /regional-updates-2026-08-13-v1/);
  assert.match(forms, /consent: formData\.get\("consent"\) === "on"/);
  assert.match(regionalRoute, /\/v1\/region-waitlist/);
  assert.match(regionalRoute, /payload\.consent !== true/);
  assert.match(regionalRoute, /consentNoticeVersion: regionalUpdatesConsentNoticeVersion/);
  assert.doesNotMatch(regionalRoute, /getDb|env\.DB/);
  assert.match(interestRoute, /\/v1\/interest-submissions/);
  assert.match(interestRoute, /Partnership requests are temporarily unavailable/);
  assert.match(interestRoute, /partnershipInterests\.has/);
  assert.doesNotMatch(interestRoute, /return new Response\(body/);
  assert.doesNotMatch(regionalRoute, /return new Response\(body/);
  assert.doesNotMatch(interestRoute, /env\.DB|ensureInterestTable/);
});

test("brand inquiry remains detailed and isolated from the regional list", async () => {
  const [brandPage, forms] = await Promise.all([
    read("app/brands/page.tsx"),
    read("app/components/InterestForms.tsx"),
  ]);

  assert.ok(
    brandPage.indexOf('id="brand-form"') <
      brandPage.indexOf("audience-details"),
  );
  assert.match(
    brandPage,
    /September pilot Contest is approved and published,[\s\S]*sole planned[\s\S]*cash reward is sponsored by GoGymGo/,
  );
  assert.match(brandPage, /PARTNERSHIP REVIEW \/\/ SUBJECT TO AVAILABILITY/);
  assert.match(brandPage, /not approval or a response-time promise/);
  assert.doesNotMatch(brandPage, /five business days|INTAKE \/\/ OPEN/);
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
  const [contact, accessibilityPage, form, handler, route, storage, exportRoute, schema, migration] =
    await Promise.all([
      read("app/contact/page.tsx"),
      read("app/accessibility/page.tsx"),
      read("app/components/PublicSiteFeedbackForm.tsx"),
      read("app/api/public-site-feedback/handler.ts"),
      read("app/api/public-site-feedback/route.ts"),
      read("app/api/public-site-storage.ts"),
      read("app/api/internal/export-public-site-feedback/route.ts"),
      read("db/schema.ts"),
      read("drizzle/0003_spooky_whiplash.sql"),
    ]);

  assert.match(contact, /id="public-site-help"/);
  assert.match(contact, /PublicSiteFeedbackForm/);
  assert.match(accessibilityPage, /REPORT AN ACCESSIBILITY BARRIER/);
  assert.match(form, /Accessibility barrier/);
  assert.match(form, /minLength=\{20\}/);
  assert.match(form, /YOUR EMAIL \(OPTIONAL\)/);
  assert.match(form, /submissionIdRef/);
  assert.match(form, /TRY AGAIN/);
  assert.match(form, /never kept longer than 180 days/);
  assert.match(form, /Do not include passwords/);
  assert.match(form, /role="alert"/);
  assert.match(handler, /contactFax/);
  assert.match(handler, /hasExactKeys/);
  assert.match(handler, /submissionIdPattern/);
  assert.match(route, /readPublicSiteRetentionPolicy/);
  assert.match(storage, /INSERT OR IGNORE INTO public_site_feedback/);
  assert.match(storage, /public_site_rate_buckets/);
  assert.match(schema, /public_site_feedback/);
  assert.match(schema, /idx_public_site_feedback_created/);
  assert.match(schema, /idx_public_site_feedback_status_created/);
  assert.match(migration, /idx_public_site_feedback_created/);
  assert.match(exportRoute, /LANDING_D1_EXPORT_ENABLED/);
  assert.match(exportRoute, /getChatGPTUser/);
  assert.match(exportRoute, /readFeedbackExportPage/);
  assert.match(exportRoute, /exportPublicSiteFeedback/);
});

test("FAQ, contact and public information pages are scannable and discoverable", async () => {
  const [notFound, faq, contact, accessibilityPage, deletionPage, layout, robots, sitemap, manifest] =
    await Promise.all([
      read("app/not-found.tsx"),
      read("app/faq/page.tsx"),
      read("app/contact/page.tsx"),
      read("app/accessibility/page.tsx"),
      read("app/account-deletion/page.tsx"),
      read("app/layout.tsx"),
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
  assert.match(faq, /Which gyms count as approved Partner gyms\?/);
  assert.match(faq, /Does joining the update list register me for the beta\?/);
  assert.match(contact, /Gym-goer updates/);
  assert.match(contact, /Fitness brand partnerships/);
  assert.match(contact, /Existing member support/);
  assert.match(contact, /Public-site feedback/);
  assert.match(accessibilityPage, /keyboards, screen readers, browser zoom, reduced motion/);
  assert.match(deletionPage, /Request account deletion from any browser/);
  assert.match(deletionPage, /href=\{siteLinks\.accountData\}/);
  assert.match(deletionPage, /href=\{siteLinks\.forgotPassword\}/);
  assert.match(deletionPage, /Limited pseudonymous records/);
  assert.match(deletionPage, /explicitly confirm/);
  assert.match(deletionPage, /DELETE_MY_ACCOUNT/);
  assert.match(deletionPage, /Local reset is not account deletion/);
  assert.match(deletionPage, /It does not submit a deletion request/);
  assert.match(deletionPage, /no request has been submitted/);
  assert.match(layout, /href=\{siteLinks\.accountDeletion\}>Account deletion/);
  assert.match(robots, /sitemap: `\$\{publicSiteOrigin\}\/sitemap\.xml`/);
  assert.match(sitemap, /"\/accessibility"/);
  assert.match(sitemap, /"\/account-deletion"/);
  assert.match(sitemap, /"\/partners"/);
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
  assert.doesNotMatch(experience, /hero-campaign-note|hero-action-note|hero-qualifiers/);
  assert.match(experience, /\.hero-fallback-link \{[\s\S]*?min-height: 54px/);
  assert.doesNotMatch(experience, /\.hero-trust-signal/);
  assert.match(experience, /min-height: min\(760px, calc\(100svh - 76px\)\)/);
  assert.match(experience, /\.landing-hero h1 \{[\s\S]*?font-size: clamp\(48px, 4\.5vw, 64px\)/);
  assert.match(experience, /\.pilot-console__facts > div \{[\s\S]*?min-height: 82px/);
  assert.match(experience, /@media \(max-width: 980px\)[\s\S]*?\.landing-hero \{[\s\S]*?min-height: 0/);
  assert.match(experience, /aspect-ratio: 3 \/ 5/);
  assert.match(experience, /image-rendering: auto/);
  assert.match(experience, /\.campaign-details summary \{[\s\S]*?min-height: 72px/);
  assert.match(globals, /\.landing-page > \.section \{[\s\S]*?padding-block: 72px/);
  assert.match(globals, /\.conversion-grid \{/);
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

  assert.match(layout, /Planned September pilot/);
  assert.match(layout, /remain unavailable until publication/);
  assert.match(layout, /septemberCampaign\.minimumAge/);
  assert.match(layout, /septemberCampaign\.regionName/);
  assert.match(manifest, /Planned September 2026 pilot details/);
  assert.match(manifest, /septemberCampaign\.minimumAge/);
  assert.match(manifest, /septemberCampaign\.regionName/);
});

test("current route captures and wide social preview are valid, documented assets", async () => {
  const [joinSelection, publicDemo, socialImage, socialStat, mark, provenance] =
    await Promise.all([
      readFile(new URL("public/app/join-selection.jpg", root)),
      readFile(new URL("public/app/public-demo.jpg", root)),
      readFile(new URL("public/og.png", root)),
      stat(new URL("public/og.png", root)),
      read("public/mark.svg"),
      read("docs/asset-provenance.md"),
    ]);

  for (const image of [joinSelection, publicDemo]) {
    assert.deepEqual(readJpegDimensions(image), { height: 899, width: 430 });
    assert.ok(image.length > 20_000);
    assert.ok(image.length < 150_000);
  }

  assert.deepEqual([...socialImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
  assert.ok(socialStat.size < 600_000);
  assert.match(mark, /viewBox="0 0 100 100"/);
  assert.match(provenance, /August 21, 2026/);
  assert.match(provenance, /contain no user data/);
  assert.match(provenance, /illustrate navigation and demo isolation only/);

  for (const removed of [
    "public/fonts/Rajdhani-Medium.ttf",
    "public/fonts/Rajdhani-SemiBold.ttf",
    "public/app/active-workout.png",
    "public/app/winners-circle.png",
    "public/app/active-workout.webp",
    "public/app/winners-circle.webp",
  ]) {
    await assert.rejects(access(new URL(removed, root)));
  }
});

test("the retired landing demo redirects only when the canonical member demo is configured", async () => {
  const demoPage = await read("app/demo/page.tsx");

  assert.match(demoPage, /if \(siteLinks\.demo\)[\s\S]*?redirect\(siteLinks\.demo\)/);
  assert.match(demoPage, /will not guess or open a preview destination/);
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

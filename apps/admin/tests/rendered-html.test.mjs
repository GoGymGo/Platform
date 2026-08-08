import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the role-aware GoGymGo operator entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>GoGymGo Admin<\/title>/i);
  assert.match(html, /GoGymGo/);
  assert.match(html, /OPERATOR PORTAL/);
  assert.match(html, /INVITATION-ONLY OPERATOR ACCESS/);
  assert.match(html, /Role-based workspaces/);
  assert.match(html, /Sign in to continue/);
  assert.match(html, /Firebase sign-in has not been configured/);
  assert.doesNotMatch(html, /CONTROL DECK ONLINE|SYSTEM OVERVIEW/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
  assert.doesNotMatch(
    html,
    /Iron District|Volt Performance Club|Northline Fitness/i,
  );
});

test("keeps authorization and mutation safeguards in the implementation", async () => {
  const [
    dashboard,
    dashboardUtils,
    pilot,
    posterJpeg,
    proxy,
    layout,
    packageJson,
    environmentExample,
    authorization,
    styles,
  ] = await Promise.all([
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin-dashboard-utils.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/pilot-operations.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/poster-jpeg.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/gogymgo/[...path]/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../../services/api/src/modules/operator/admin-authorization.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboardUtils, /getIdToken\(\)/);
  assert.match(dashboardUtils, /authorization:\s*`Bearer \$\{token\}`/);
  assert.match(dashboard, /Role-based workspaces/);
  assert.match(dashboard, /GOGYMGO TEAM EMAIL/);
  assert.match(dashboard, /PARTNER EMAIL/);
  assert.match(dashboard, /browserSessionPersistence/);
  assert.match(dashboard, /Keep me signed in on this device/);
  assert.match(dashboard, /CHECKING YOUR SESSION/);
  assert.match(dashboard, /operator\/access/);
  assert.match(dashboard, /operator\/partner-dashboard/);
  assert.match(dashboard, /adminRequestStatus\(error\) !== 404/);
  assert.match(dashboard, /portal: "gogymgo"/);
  assert.match(dashboard, /Your gyms, without the platform-wide controls/);
  assert.match(dashboard, /AWAITING GOGYMGO REVIEW/);
  assert.doesNotMatch(
    dashboard,
    /GoogleAuthProvider|OAuthProvider|signInWithPopup|CONNECTED ACCOUNT/,
  );
  assert.match(dashboard, /name="reason"/);
  assert.match(dashboard, /ADMINISTRATIVE ACTION/);
  assert.match(
    dashboard,
    /Publish the approved contest after operator confirmation/,
  );
  assert.match(dashboard, /recorded automatically in the audit history/);
  assert.match(dashboard, /action\.auditReason \?\?/);
  assert.match(dashboardUtils, /idempotency-key/);
  assert.match(dashboardUtils, /expectedStatuses\?\.includes\(response\.status\)/);
  assert.match(dashboard, /aria-current=\{section === item\.id \? "page"/);
  assert.match(dashboard, /className="page-context"/);
  assert.match(dashboard, /aria-labelledby=\{titleId\}/);
  assert.match(dashboard, /<dialog/);
  assert.match(dashboard, /showModal\(\)/);
  assert.match(dashboard, /onCancel=/);
  assert.match(dashboard, /PUBLISH BLOCKED/);
  assert.match(dashboard, /Filter contests/);
  assert.match(dashboard, /Filter rewards/);
  assert.match(dashboard, /Filter work queue/);
  assert.match(dashboard, /Filter audit history/);
  assert.match(dashboard, /useStoredPreference/);
  assert.match(dashboard, /Saved on this device/);
  assert.match(dashboard, /className="nav-count"/);
  assert.match(dashboard, /getQueueUrgency/);
  assert.match(dashboard, /NEXT DEADLINE/);
  assert.match(dashboard, /RESOLVE IN REWARDS/);
  assert.match(dashboard, /RELATED AUDIT EVIDENCE/);
  assert.match(dashboard, /Table density/);
  assert.match(dashboard, /className="column-menu"/);
  assert.match(dashboard, /className="pagination"/);
  assert.match(dashboard, /className="audit-diff"/);
  assert.match(dashboardUtils, /event\.before \|\| event\.after/);
  assert.match(dashboard, /No regional policies configured/);
  assert.match(dashboard, /No legal documents published/);
  assert.match(dashboard, /No audit events recorded/);
  assert.match(dashboard, /operator\/gym-locations/);
  assert.match(dashboard, /operator\/gym-sessions/);
  assert.match(dashboard, /operator\/region-waitlist/);
  assert.match(dashboard, /operator\/interest-submissions/);
  assert.match(dashboard, /operator\/partner-applications/);
  assert.match(dashboard, /operator\/cash-fulfillments/);
  assert.match(pilot, /STATIC QR PILOT/);
  assert.match(pilot, /Compass coordinates/);
  assert.match(pilot, /USE MY CURRENT LOCATION/);
  assert.match(pilot, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(pilot, /Location access was not allowed/);
  assert.match(pilot, /available in the assignment form below/);
  assert.match(pilot, /formErrorMessage/);
  assert.match(pilot, /DOWNLOAD JPEG FOR PRINTING/);
  assert.match(pilot, /\.jpg`/);
  assert.match(pilot, /sessionStorage\.setItem\(posterStorageKey/);
  assert.match(pilot, /sessionStorage\.getItem\(posterStorageKey/);
  assert.match(
    pilot,
    /gym\.activeCredentialVersion !== stored\.credentialVersion/,
  );
  assert.match(pilot, /forgetStoredPoster\(gym\.id\)/);
  assert.match(dashboard, /downloadPosterJpeg/);
  assert.match(posterJpeg, /canvas\.toBlob/);
  assert.match(posterJpeg, /"image\/jpeg"/);
  assert.match(posterJpeg, /new Path2D/);
  assert.match(posterJpeg, /#34E5E8/);
  assert.match(posterJpeg, /#FF2D9B/);
  assert.doesNotMatch(pilot, /DOWNLOAD SVG FOR PRINTING/);
  assert.match(pilot, /Sessions \+ incomplete visits/);
  assert.match(pilot, /owner|cash handoff/i);
  assert.match(pilot, /scope="col"/);
  assert.match(pilot, /scroll horizontally for more columns/);
  assert.doesNotMatch(pilot, /dangerouslySetInnerHTML/);

  assert.match(proxy, /path\[0\]\s*!==\s*"operator"/);
  assert.match(proxy, /This administrative route is not available/);
  assert.match(proxy, /GOGYMGO_API_URL/);
  assert.match(
    proxy,
    /buildUpstreamUrl\(baseUrl, path, request\.nextUrl\.search\)/,
  );
  assert.doesNotMatch(proxy, /firebase.*private|serviceAccount/i);

  assert.match(environmentExample, /GOGYMGO_API_URL=/);
  assert.match(environmentExample, /NEXT_PUBLIC_FIREBASE_API_KEY=/);
  assert.match(environmentExample, /NEXT_PUBLIC_FIREBASE_PROJECT_ID=/);
  assert.match(environmentExample, /SITE_URL=https:\/\/admin\.gogymgo\.com/);
  assert.doesNotMatch(environmentExample, /private_key|service_account/i);

  assert.match(authorization, /signInProvider\s*!==\s*'password'/);
  assert.match(authorization, /OPERATOR_PASSWORD_SIGN_IN_REQUIRED/);
  assert.match(authorization, /PARTNER_GYM_ASSIGNMENT_REQUIRED/);
  assert.match(authorization, /GYM_SCOPE_FORBIDDEN/);
  assert.match(
    styles,
    /\.sign-in-panel \.stacked-form input,[\s\S]*min-height: 48px/,
  );
  assert.match(styles, /\.sign-in-panel \{[\s\S]*order: -1/);
  assert.match(styles, /@gogymgo\/brand\/web\.css/);
  assert.match(styles, /--body: var\(--gogymgo-font-body\)/);
  assert.match(styles, /--muted: var\(--gogymgo-muted\)/);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.table-wrap th:last-child,[\s\S]*?position: sticky/);
  assert.match(styles, /\.urgency-tag\.urgent/);
  assert.match(styles, /\.filter-chips/);
  assert.match(styles, /\.data-view-controls/);
  assert.match(styles, /\.sticky-action-column/);
  assert.match(styles, /\.audit-diff/);
  assert.match(styles, /\.primary-button,[\s\S]*?min-height: 44px/);
  assert.match(styles, /\.table-wrap:focus-visible/);

  assert.match(layout, /GoGymGo Admin/);
  assert.match(layout, /new URL\("\/og\.png", origin\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(
    await readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    /dynamic = "force-dynamic"/,
  );
  await access(new URL("../public/icon.png", import.meta.url));
  await access(new URL("../public/brand-mark.png", import.meta.url));
  await access(new URL("../public/fonts/Orbitron-Bold.ttf", import.meta.url));
  await access(
    new URL("../public/fonts/ShareTechMono-Regular.ttf", import.meta.url),
  );
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../.openai/hosting.json", import.meta.url));
});

test("uses the canonical traced mark for compact admin branding", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /src="\/brand-mark\.png"/);
  assert.match(dashboard, /unoptimized/);
  assert.doesNotMatch(dashboard, /brand-mark-letter/);
  assert.match(styles, /\.brand-mark img/);
});

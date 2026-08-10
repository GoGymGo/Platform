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
  assert.match(html, /Sign-in is temporarily unavailable/);
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
    contestLaunchFlow,
    pilot,
    posterJpeg,
    proxy,
    layout,
    packageJson,
    environmentExample,
    authorization,
    styles,
    formValidation,
  ] = await Promise.all([
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin-dashboard-utils.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/contest-launch-flow.js", import.meta.url), "utf8"),
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
    readFile(new URL("../app/form-validation.ts", import.meta.url), "utf8"),
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
  assert.match(dashboardUtils, /"DELETE" \| "POST" \| "PUT"/);
  assert.match(
    dashboardUtils,
    /expectedStatuses\?\.includes\(response\.status\)/,
  );
  assert.match(
    dashboardUtils,
    /adminRequestErrorMessage\(response\.status, apiError\)/,
  );
  assert.match(dashboardUtils, /apiError\?\.message\?\.trim\(\)/);
  assert.match(dashboard, /adminRequestStatus\(error\) === 409/);
  assert.match(dashboard, /REFRESH \+ REVIEW/);
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
  assert.match(dashboard, /GUIDED CONTEST LAUNCH/);
  assert.match(dashboard, /CREATE NEW CONTEST/);
  assert.doesNotMatch(dashboard, /\+ NEW CONTEST/);
  assert.match(dashboard, /1\. Contest/);
  assert.match(dashboard, /2\. Reward/);
  assert.match(dashboard, /3\. Region/);
  assert.match(dashboard, /4\. Gym \+ QR/);
  assert.match(dashboard, /disabled=\{Boolean\(navigationLocks\[item\.id\]\)\}/);
  assert.match(dashboard, /gogymgo\.admin\.setup\.competition-id/);
  assert.match(dashboard, /getQueueUrgency/);
  assert.match(dashboard, /NEXT DEADLINE/);
  assert.match(dashboard, /CONTINUE SETUP/);
  assert.match(dashboard, /RELATED AUDIT EVIDENCE/);
  assert.match(dashboard, /Table density/);
  assert.match(dashboard, /className="column-menu"/);
  assert.match(dashboard, /className="pagination"/);
  assert.match(dashboard, /className="audit-diff"/);
  assert.match(dashboardUtils, /event\.before \|\| event\.after/);
  assert.match(dashboard, /No regions added/);
  assert.match(dashboard, /No legal documents published/);
  assert.match(dashboard, /No audit events recorded/);
  assert.match(dashboard, /Delete contest/);
  assert.match(dashboard, /Delete reward/);
  assert.match(dashboard, /Delete region/);
  assert.match(dashboard, /Delete legal version/);
  assert.match(dashboard, /Delete workout/);
  assert.doesNotMatch(dashboard, /remain preserved/);
  assert.match(dashboard, /operator\/gym-locations/);
  assert.match(dashboard, /operator\/gym-sessions/);
  assert.match(dashboard, /operator\/region-waitlist/);
  assert.match(dashboard, /operator\/interest-submissions/);
  assert.match(dashboard, /operator\/partner-applications/);
  assert.match(dashboard, /operator\/cash-fulfillments/);
  assert.match(pilot, /STATIC QR PILOT/);
  assert.match(pilot, /Compass coordinates/);
  assert.match(pilot, /USE MY PHONE LOCATION/);
  assert.match(pilot, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(pilot, /Location access was not allowed/);
  assert.match(pilot, /available in the assignment form below/);
  assert.match(pilot, /formErrorMessage/);
  assert.match(pilot, /DOWNLOAD JPEG FOR PRINTING/);
  assert.match(pilot, /aria-expanded=\{!collapsed\}/);
  assert.match(pilot, /\{collapsed \? "Expand" : "Collapse"\}/);
  assert.match(pilot, /poster-collapse-button/);
  assert.doesNotMatch(pilot, />\s*Close\s*</);
  assert.match(pilot, /pilotAuditHiddenStorageKey/);
  assert.match(pilot, /CLEAR FROM VIEW/);
  assert.match(pilot, /RESTORE AUDIT HISTORY/);
  assert.match(pilot, /pilot-collapsible-panel/);
  assert.match(pilot, /DELETE GYM/);
  assert.match(pilot, /\.jpg`/);
  assert.match(pilot, /onLoadActiveQr/);
  assert.match(pilot, /VIEW ACTIVE POSTER/);
  assert.doesNotMatch(pilot, /server recovery was available|future visit/);
  assert.doesNotMatch(pilot, /posterStorageKey/);
  assert.match(dashboard, /qr-credentials\/active/);
  assert.match(pilot, /selectedCompetition\.assignedGymIds/);
  assert.match(pilot, /const assignmentComplete/);
  assert.match(pilot, /pilot-assignment-complete/);
  assert.match(
    pilot,
    /CONTINUE TO \{props\.selectedCompetition\.name\.toUpperCase\(\)\} QR/,
  );
  assert.doesNotMatch(
    pilot,
    /Every active Partner gym in this region is already assigned to this contest/,
  );
  assert.match(
    pilot,
    /credential\.competitionId !== props\.selectedCompetition\.id/,
  );
  assert.match(pilot, /credential\.gymLocationId !== gym\.id/);
  assert.match(pilot, /The generated poster did not match/);
  assert.match(
    pilot,
    /ISSUE \/ REISSUE \{selectedContestName\.toUpperCase\(\)\} POSTER/,
  );
  assert.match(styles, /\.pilot-assignment-complete/);
  assert.match(styles, /\.pilot-qr-action-message/);
  assert.doesNotMatch(pilot, /can also be assigned independently to another/);
  assert.doesNotMatch(pilot, /Every contest receives a different poster/);
  assert.doesNotMatch(pilot, /reusable across every contest assigned to that/);
  assert.match(pilot, /activeQrCredentials/);
  assert.match(dashboard, /EXISTING CONTEST HOMES/);
  assert.match(dashboard, /CREATE ANOTHER CONTEST/);
  assert.match(dashboard, /ReasonPresetChips/);
  assert.match(styles, /\.mobile-admin-navigation \{[\s\S]*display: none !important/);
  assert.doesNotMatch(pilot, /\.filter\(isOperationalCompetition\)/);
  assert.match(contestLaunchFlow, /competition\.assignedGymIds \?\? \[\]/);
  assert.match(contestLaunchFlow, /competition\.status === "cancelled"/);
  assert.match(contestLaunchFlow, /Publish a reward for the selected contest/);
  assert.match(dashboard, /isRewardConfigurableCompetition\(competition\)/);
  assert.match(dashboard, /downloadPosterJpeg/);
  assert.match(dashboard, /ADVANCED OPTIONS/);
  assert.match(dashboard, /rewardType !== "coupon"/);
  assert.match(dashboard, /type="hidden"[\s\S]*value=\{/);
  assert.match(dashboard, /<details className="queue-review-history">/);
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
  assert.match(proxy, /export function DELETE/);
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

  assert.match(dashboard, /title="Add a region"/);
  assert.match(dashboard, /<Field label="REGION NAME"/);
  assert.match(dashboard, /<Field label="REGION BOUNDARY FILE"/);
  assert.match(dashboard, /GoGymGo uses it to decide whether a phone is inside/);
  assert.doesNotMatch(
    dashboard,
    /<Field label="(?:REGION CODE|DISPLAY NAME|POLICY VERSION|BOUNDARY VERSION|GEOJSON)/,
  );
  assert.doesNotMatch(
    dashboard,
    /Each contest stays separate|time-bounded regional policy|REGION POLICY|server-assigned account role|backend verifies/,
  );
  assert.doesNotMatch(
    pilot,
    /SERVER-AUTHORITATIVE|APPEND-ONLY PILOT LEDGER|authoritative ledger/,
  );
  assert.doesNotMatch(
    dashboard,
    /SERVER-AUTHORITATIVE LEGAL TEXT|APPEND-ONLY LEDGER|AUTHORITATIVE STATE|audit ledger/,
  );

  const dashboardForms = dashboard.match(/<form\b[\s\S]*?>/g) ?? [];
  const pilotForms = pilot.match(/<form\b[\s\S]*?>/g) ?? [];
  assert.equal(dashboardForms.length, 7);
  assert.equal(pilotForms.length, 4);
  dashboardForms.forEach((form) => assert.match(form, /noValidate/));
  pilotForms.forEach((form) => assert.match(form, /noValidate/));
  assert.equal(
    dashboard.match(/formValidationError\(/g)?.length,
    dashboardForms.length,
  );
  assert.equal(
    pilot.match(/formValidationError\(/g)?.length,
    pilotForms.length,
  );
  assert.match(formValidation, /Please fix the following/);
  assert.match(formValidation, /control\.validity\.valueMissing/);
  assert.match(formValidation, /aria-invalid/);
  assert.match(formValidation, /invalidControls\[0\]\?\.focus\(\)/);
  assert.match(styles, /\.form-error \{[\s\S]*border:/);
  assert.match(styles, /input\[aria-invalid="true"\]/);

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

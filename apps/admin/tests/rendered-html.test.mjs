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
  if (!/CHECKING YOUR SESSION/.test(html)) {
    assert.match(html, /Role-based workspaces/);
    assert.match(html, /Sign in to continue/);
    assert.match(html, /Sign-in is temporarily unavailable/);
  }
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
    authRequest,
    contestLaunchFlow,
    pilot,
    posterJpeg,
    proxy,
    layout,
    packageJson,
    environmentExample,
    upstreamUrl,
    styles,
    formValidation,
    contestSetupWorkspace,
  ] = await Promise.all([
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin-dashboard-utils.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/admin-auth-request.mjs", import.meta.url), "utf8"),
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
      new URL("../app/api/gogymgo/[...path]/upstream-url.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/form-validation.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/contest-setup-workspace.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(authRequest, /getIdToken\(forceRefresh\)/);
  assert.match(authRequest, /response\.status !== 401/);
  assert.match(authRequest, /getToken\(activeUser, true\)/);
  assert.match(dashboardUtils, /authorization:\s*`Bearer \$\{token\}`/);
  assert.match(dashboard, /Role-based workspaces/);
  assert.match(dashboard, /OPERATOR EMAIL/);
  assert.match(dashboard, /SIGN IN SECURELY/);
  assert.match(dashboard, /SIGNING IN…/);
  assert.match(dashboard, /browserSessionPersistence/);
  assert.match(dashboard, /Keep me signed in on this device/);
  assert.match(dashboard, /CHECKING YOUR SESSION/);
  assert.match(dashboard, /authStateTimeout/);
  assert.match(dashboard, /8_000/);
  assert.match(dashboard, /session could not be restored/);
  assert.match(dashboard, /operator\/access/);
  assert.match(dashboard, /operator\/partner-dashboard/);
  assert.doesNotMatch(dashboard, /expectedStatuses:\s*\[404\]/);
  assert.doesNotMatch(dashboard, /portal: "gogymgo"/);
  assert.match(dashboard, /RETRY ACCESS CHECK/);
  assert.match(dashboard, /Your session expired/);
  assert.match(dashboard, /authEpoch\.current/);
  assert.match(dashboard, /clearAdminRequestSession\(\)/);
  assert.match(dashboard, /clearLegacyDrawRecovery\(/);
  assert.match(dashboard, /nextUser\.uid/);
  assert.match(dashboard, /window\.location\.origin/);
  assert.match(dashboard, /AUTOMATIC PUBLICATION PENDING/);
  assert.match(dashboard, /No admin action is required/);
  assert.doesNotMatch(dashboard, /operator\/draws\/lock/);
  assert.doesNotMatch(dashboard, /REVEAL \+ PUBLISH RESULTS/);
  assert.doesNotMatch(dashboard, /LOCK AUDITED DRAW SNAPSHOT/);
  const signOutImplementation = dashboard.match(
    /async function handleSignOut\(\) \{[\s\S]*?\n  \}/,
  )?.[0];
  assert.ok(signOutImplementation);
  assert.doesNotMatch(signOutImplementation, /savePendingDrawFinalization/);
  assert.match(dashboard, /SIGNING OUT/);
  assert.match(dashboard, /error \|\|/);
  assert.match(dashboard, /Your gyms, without the platform-wide controls/);
  assert.match(dashboard, /SUBMIT FOR GOGYMGO REVIEW/);
  assert.match(dashboard, /operator\/partner-proposals/);
  assert.match(dashboard, /operator\/partner-competitions\?limit=25/);
  assert.match(dashboard, /operator\/partner-visits\?limit=25/);
  assert.match(dashboard, /VIEW SECRET-FREE HISTORY/);
  assert.match(dashboard, /expectedCredentialVersion/);
  assert.match(dashboard, /disabled=\{submitting \|\| !canManagePoster\}/);
  assert.match(
    dashboard,
    /proposal is submitted, published by GoGymGo, and the\s+Contest is open/,
  );
  assert.doesNotMatch(dashboard, /snapshot\.sessions/);
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
  assert.match(
    dashboardUtils,
    /pendingAdminMutationKey\(mutationFingerprint\)/,
  );
  assert.match(dashboardUtils, /gogymgo\.admin\.pending-idempotency-keys\.v1/);
  assert.match(dashboardUtils, /sessionStorage\.setItem/);
  assert.match(dashboardUtils, /response\.status < 500/);
  assert.match(dashboardUtils, /IDEMPOTENCY_REQUEST_IN_PROGRESS/);
  assert.match(
    dashboardUtils,
    /clearPendingAdminMutationKey\(mutationFingerprint\)/,
  );
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
  assert.match(
    dashboard,
    /Load and inspect the current private media action before approval/,
  );
  assert.match(dashboard, /action\.reviewVersion !== item\.reviewVersion/);
  assert.match(dashboard, /SHA-256/);
  assert.match(dashboard, /aria-current=\{section === item\.id \? "page"/);
  assert.match(dashboard, /className="page-context"/);
  assert.match(dashboard, /aria-labelledby=\{titleId\}/);
  assert.match(dashboard, /<dialog/);
  assert.match(dashboard, /showModal\(\)/);
  assert.match(dashboard, /onCancel=/);
  assert.match(dashboard, /Filter rewards/);
  assert.match(dashboard, /snapshot\.rewardAwards/);
  assert.match(
    dashboard,
    /operator\/reward-awards\/\$\{award\.id\}\/status-action/,
  );
  assert.match(dashboard, /expectedVersion: award\.version/);
  assert.match(dashboard, /reward\.couponCodeCount >= reward\.inventoryTotal/);
  assert.match(dashboard, /AWARDS &amp; FULFILLMENT/);
  assert.match(dashboard, /Filter work queue/);
  assert.match(dashboard, /Filter audit history/);
  assert.match(dashboard, /useStoredPreference/);
  assert.match(dashboard, /Saved on this device/);
  assert.match(dashboard, /className="nav-count"/);
  assert.match(dashboard, /label: "Regions"/);
  assert.match(dashboard, /label: "Rewards"/);
  assert.match(dashboard, /label: "Partner gyms"/);
  assert.doesNotMatch(dashboard, /GUIDED CONTEST LAUNCH/);
  assert.doesNotMatch(dashboard, /TESTING SHORTCUT|SET 30-MINUTE TEST WINDOW/);
  assert.doesNotMatch(dashboard, /Opens registration now/);
  assert.match(dashboard, /minimumEntrants: 1/);
  assert.doesNotMatch(dashboard, /name="minimumEntrants"/);
  assert.doesNotMatch(dashboard, /\+ NEW CONTEST/);
  assert.doesNotMatch(dashboard, /navigationLocks|ContestLaunchGuide/);
  assert.match(dashboard, /<ContestSetupWorkspace/);
  assert.match(dashboard, /gogymgo\.admin\.setup\.competition-id/);
  assert.match(dashboard, /publishCompleteContestSetup/);
  assert.match(dashboard, /publication-preflight/);
  assert.match(dashboard, /preflight\.version !== expectedVersion/);
  assert.match(dashboard, /The authoritative publication prerequisites/);
  assert.match(dashboard, /setContestHomeId\(competitionId\)/);
  assert.match(contestSetupWorkspace, /ONE-PAGE CONTEST SETUP/);
  assert.match(contestSetupWorkspace, /USE MY LOCATION/);
  assert.match(contestSetupWorkspace, /CREATE A DIFFERENT REGION/);
  assert.match(contestSetupWorkspace, /ADD AN APPROVED PARTNER GYM/);
  assert.match(contestSetupWorkspace, /PUBLISH CONTEST/);
  assert.doesNotMatch(
    contestSetupWorkspace,
    /Add an approved HTTPS image and terms link before publishing/,
  );
  assert.match(contestSetupWorkspace, /resolveRewardTermsUrl/);
  assert.match(contestSetupWorkspace, /IMAGE URL \(OPTIONAL\)/);
  assert.match(contestSetupWorkspace, /TERMS URL \(OPTIONAL OVERRIDE\)/);
  assert.match(contestSetupWorkspace, /Location detection timed out/);
  assert.doesNotMatch(contestSetupWorkspace, /location-message error/);
  assert.match(
    contestSetupWorkspace,
    /Boolean\(claimUrl\) === Boolean\(fulfillment\)/,
  );
  assert.match(contestSetupWorkspace, /setup-section-error/);
  assert.match(contestSetupWorkspace, /minimumEntrants: 1/);
  assert.match(contestSetupWorkspace, /AT LEAST 30 MINUTES/);
  assert.match(contestSetupWorkspace, /Workouts must start before/);
  assert.match(contestSetupWorkspace, /IN-PROGRESS WORKOUTS FINISH/);
  assert.match(contestSetupWorkspace, /region&apos;s timezone/);
  assert.match(dashboard, /WORKOUTS START/);
  assert.match(dashboard, /15-minute completion/);
  assert.doesNotMatch(contestSetupWorkspace, /name="minimumEntrants"/);
  assert.doesNotMatch(
    contestSetupWorkspace,
    /TESTING SHORTCUT|SET 30-MINUTE TEST WINDOW/,
  );
  assert.match(contestSetupWorkspace, /ADVANCED CONTEST SETTINGS/);
  assert.match(contestSetupWorkspace, /ASSIGNED GYM/);
  assert.match(contestSetupWorkspace, /Only active partner gyms approved/);
  assert.match(contestSetupWorkspace, /added by GoGymGo/);
  assert.match(
    contestSetupWorkspace,
    /contest QR poster is created automatically/,
  );
  assert.match(
    styles,
    /\.setup-anchor-rail \{[\s\S]*grid-template-columns: repeat\(4, minmax\(150px, 1fr\)\)/,
  );
  assert.doesNotMatch(
    contestSetupWorkspace,
    /Create a new gym here|newGymName|newGymLatitude|newGymLongitude/,
  );
  assert.match(dashboard, /gym\.accessLevel === "admin"/);
  assert.doesNotMatch(
    dashboard,
    /snapshot\.gyms\.filter\(\s*\(gym\) => gym\.active/,
  );
  assert.doesNotMatch(contestSetupWorkspace, /onNavigate/);
  assert.match(dashboard, /getQueueUrgency/);
  assert.match(dashboard, /RELATED AUDIT EVIDENCE/);
  assert.match(dashboard, /Table density/);
  assert.match(dashboard, /className="column-menu"/);
  assert.match(dashboard, /className="pagination"/);
  assert.match(dashboard, /className="audit-diff"/);
  assert.match(dashboardUtils, /summarizeAuditState\(event\.after\)/);
  assert.match(dashboardUtils, /No resulting state recorded by server/);
  assert.doesNotMatch(dashboardUtils, /scheduled or open|existing record/);
  assert.match(dashboard, /No regions added/);
  assert.match(dashboard, /No legal documents published/);
  assert.match(dashboard, /No audit events recorded/);
  assert.match(dashboard, /Delete contest/);
  assert.match(dashboard, /Delete reward/);
  assert.match(dashboard, /Delete region/);
  assert.match(dashboard, /region-policies\/\$\{region\.id\}\/status-action/);
  assert.match(dashboard, /expectedVersion: region\.version/);
  assert.doesNotMatch(dashboard, /Delete legal version/);
  assert.match(dashboard, /History retained/);
  assert.match(dashboard, /Delete workout/);
  assert.doesNotMatch(dashboard, /remain preserved/);
  assert.match(dashboard, /operator\/gym-locations/);
  assert.match(dashboard, /expectedVersion: gym\.version/);
  assert.match(pilot, /expectedVersion: gym\.version/);
  assert.match(dashboard, /operator\/gym-sessions/);
  assert.match(dashboard, /operator\/region-waitlist/);
  assert.match(
    dashboard,
    /operator\/region-verifications\/\$\{item\.id\}\/decision/,
  );
  assert.match(dashboard, /Review decision recorded/);
  assert.match(dashboard, /item\.allowedDecisions\.map/);
  assert.match(dashboard, /LOAD MORE AUTHORITATIVE ITEMS/);
  assert.match(dashboard, /SEARCH SERVER/);
  assert.match(dashboardUtils, /decodeWorkQueueDetail/);
  assert.match(dashboardUtils, /allowedReviewFactLabels/);
  assert.doesNotMatch(dashboardUtils, /ageHours >=/);
  assert.doesNotMatch(dashboard, /defaultChecked name="competitionEnabled"/);
  assert.match(dashboard, /operator\/interest-submissions/);
  assert.match(dashboard, /operator\/partner-applications/);
  assert.match(dashboard, /operator\/cash-fulfillments/);
  assert.match(
    dashboard,
    /snapshot\.capabilities\.creatorConfigurationEnabled/,
  );
  assert.match(dashboard, /snapshot\.capabilities\.legalPublicationOwner/);
  assert.match(dashboard, /expectedVersion: document\.lifecycleVersion/);
  assert.match(pilot, /STATIC QR PILOT/);
  assert.match(pilot, /onUpdateWaitlist/);
  assert.match(pilot, /legacy \/ not recorded/);
  assert.match(pilot, /entry\.source/);
  assert.match(pilot, /entry\.retentionExpiresAt/);
  assert.match(pilot, /Account-linked \/ no public expiry/);
  assert.match(pilot, /Legacy \/ no scheduled expiry/);
  assert.doesNotMatch(pilot, /source_record_sha256|artifact_sha256|forwarding-secret/i);
  assert.match(pilot, /Compass coordinates/);
  assert.match(pilot, /USE MY PHONE LOCATION/);
  assert.match(pilot, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(pilot, /Location access was not allowed/);
  assert.match(pilot, /available in the assignment form below/);
  assert.match(pilot, /formErrorMessage/);
  assert.match(pilot, /DOWNLOAD JPEG FOR PRINTING/);
  assert.match(pilot, /credential\.expiresAt/);
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
  assert.match(pilot, /export function assertGymQrCredentialScope/);
  assert.match(pilot, /credential\.competitionId !== competitionId/);
  assert.match(pilot, /credential\.gymLocationId !== gymId/);
  assert.match(pilot, /The loaded poster did not match/);
  assert.match(
    pilot,
    /props\.onIssueQr\([\s\S]*props\.selectedCompetition\.id,[\s\S]*gym\.id/,
  );
  assert.match(
    pilot,
    /props\.onRevokeQr\([\s\S]*props\.selectedCompetition\.id,[\s\S]*gym\.id/,
  );
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
  assert.match(dashboard, /CONTEST-SPECIFIC QR POSTERS/);
  assert.match(dashboard, /These controls are locked to \{competition\.name\}/);
  assert.match(
    dashboard,
    /VIEW \$\{competition\.name\.toUpperCase\(\)\} POSTER/,
  );
  assert.match(
    dashboard,
    /onIssueQr\(competition\.id, gym\.id,[\s\S]*assertGymQrCredentialScope/,
  );
  assert.match(
    dashboard,
    /operator\/competitions\/\$\{competitionId\}\/gym-locations\/\$\{gymId\}\/qr-credentials/,
  );
  assert.match(styles, /\.contest-home-poster-controls/);
  assert.match(styles, /\.contest-home-poster-row/);
  assert.match(dashboard, /ReasonPresetChips/);
  assert.match(
    styles,
    /\.mobile-admin-navigation \{[\s\S]*display: none !important/,
  );
  assert.match(styles, /\.panel \{[\s\S]*?min-width: 0;/);
  assert.match(
    styles,
    /\.table-wrap \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/,
  );
  assert.doesNotMatch(pilot, /\.filter\(isOperationalCompetition\)/);
  assert.match(contestLaunchFlow, /competition\.assignedGymIds \?\? \[\]/);
  assert.match(contestLaunchFlow, /competition\.status !== "draft"/);
  assert.match(
    contestLaunchFlow,
    /\["draft", "registration", "active"\]\.includes\(status\)/,
  );
  assert.match(
    contestLaunchFlow,
    /\["draft", "cancelled", "settled"\]\.includes\(status\)/,
  );
  assert.match(dashboard, /canCancelContest\(competition\.status\)/);
  assert.match(
    dashboard,
    /canDeleteContestFromDashboard\(competition\.status\)/,
  );
  assert.match(
    dashboard,
    /Active workouts, rankings, and prize eligibility will close/,
  );
  assert.doesNotMatch(contestLaunchFlow, /completedSteps|blockedReason/);
  assert.match(
    contestSetupWorkspace,
    /publishes the reward, creates the QR poster and opens the contest/,
  );
  assert.match(contestSetupWorkspace, /minimumEntrants: 1/);
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
  assert.match(
    pilot,
    /Record only an already-completed in-person \$100 CAD handoff/,
  );
  assert.match(pilot, /does not send money or initiate a transfer/);
  assert.match(pilot, /expectedVersion: award\.version/);
  assert.match(pilot, /award\.cashAmountCents === 10000/);
  assert.match(pilot, /award\.cashCurrency === "CAD"/);
  assert.match(
    pilot,
    /No authoritative settled September cash Award is available/,
  );
  assert.match(
    pilot,
    /fulfilled with no cashFulfillmentId|!award\.cashFulfillmentId/,
  );
  for (const privatePaymentField of [
    "bank",
    "payee",
    "card",
    "wallet",
    "tax",
    "balance",
    "transfer",
    "provider",
  ]) {
    assert.doesNotMatch(
      pilot,
      new RegExp(`(?:^|\\s)name="${privatePaymentField}`, "i"),
    );
  }
  assert.match(pilot, /scope="col"/);
  assert.match(pilot, /scroll horizontally for more columns/);
  assert.doesNotMatch(pilot, /dangerouslySetInnerHTML/);

  assert.match(proxy, /isAllowedAdminProxyPath\(path\)/);
  assert.match(proxy, /This administrative route is not available/);
  assert.match(proxy, /GOGYMGO_API_URL/);
  assert.match(
    proxy,
    /buildUpstreamUrl\(baseUrl, path, request\.nextUrl\.search\)/,
  );
  assert.match(proxy, /export function DELETE/);
  assert.match(proxy, /maximumBodyBytes = 1_048_576/);
  assert.match(proxy, /A valid operator session is required/);
  assert.match(proxy, /redirect: "manual"/);
  assert.match(proxy, /invalid redirect/);
  assert.match(proxy, /could not be reached/);
  assert.match(proxy, /isEmptySuccessfulAdminResponse/);
  assert.match(proxy, /NextResponse\.json\(null/);
  assert.doesNotMatch(proxy, /firebase.*private|serviceAccount/i);
  assert.match(upstreamUrl, /path\[0\] === "operator"/);
  assert.match(upstreamUrl, /parsed\.username \|\| parsed\.password/);
  assert.match(upstreamUrl, /sensitiveQueryNames/);
  assert.match(upstreamUrl, /parsed\.protocol !== "https:"/);

  assert.match(environmentExample, /GOGYMGO_API_URL=/);
  assert.match(environmentExample, /NEXT_PUBLIC_FIREBASE_API_KEY=/);
  assert.match(environmentExample, /NEXT_PUBLIC_FIREBASE_PROJECT_ID=/);
  assert.match(environmentExample, /SITE_URL=https:\/\/admin\.gogymgo\.com/);
  assert.doesNotMatch(environmentExample, /private_key|service_account/i);

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
  assert.match(
    dashboard,
    /GoGymGo uses it to decide whether a phone is inside/,
  );
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
  assert.equal(dashboardForms.length, 10);
  assert.equal(pilotForms.length, 5);
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
  assert.match(dashboard, /RECORD DECISION/);
  assert.match(dashboard, /expectedVersion: item\.reviewVersion/);
  assert.match(
    dashboard,
    /The server controls the permitted transitions shown below/,
  );
  assert.match(
    dashboard,
    /Starting deletion authorizes the worker to revoke access/,
  );

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

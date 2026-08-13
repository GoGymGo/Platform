# GoGymGo feature delivery ledger

This is the durable coordinator record for product discovery, feature ownership,
verification, publication, and residual risk. A feature is not `COMPLETE` merely
because a screen or endpoint exists. Historical implementation is recorded as
evidence, but the coordinator re-verifies each non-terminal feature in a bounded
feature task before promoting it to `COMPLETE`.

Allowed statuses: `DISCOVERED`, `AUDITED`, `READY`, `IN_PROGRESS`, `CI_PENDING`,
`COMPLETE`, `BLOCKED`, and `DEFERRED`.

## Coordinator state

- Inventory baseline: `origin/main` at `4155f806085ee09d743fa211656ae96e67fbfcb4`
  on 2026-08-13.
- Repository: `GoGymGo/Platform`; no open product issues were returned by the
  GitHub issue inventory. Open pull requests 57-66 are Dependabot updates.
- Coordinator task: permanent Goal-mode task in the local GoGymGo project.
- Coordinator branch: `agent/feature-delivery-coordinator`.
- Latest completed delivery: `origin/main` at
  `ed0ef8a940ab65f01c312be9cfbd75d94002a61d` after PR #74 on 2026-08-13.
- Active feature task: `GoGymGo Feature GGG-003 — Region eligibility and regional
  waitlist` on `agent/ggg-003-region-eligibility`.
- Active feature limit: one implementation task at a time unless ownership and
  files are demonstrably disjoint.
- Cloud boundary: repository and GitHub work are authorized. No AWS, Firebase,
  Cloudflare, staging, or production inspection, mutation, or deployment is
  authorized here. The eventual AWS task is read-only and must be created only
  after staging-required product code is terminal.
- Discovery inputs: product, architecture, compliance, and operations documents;
  49 member routes; admin and landing surfaces; API controllers and services;
  worker behavior; 30 forward migrations; generated OpenAPI/contracts; feature
  capabilities; environment examples; source markers; tests; Git history; open
  GitHub issues and pull requests; and the existing worktree inventory.

## Ordered queue

1. `GGG-001` through `GGG-005` — re-verify identity, legal, region, enrollment,
   and gym selection foundations.
2. `GGG-007` through `GGG-011` — scoring, streak, friends, Weekly Challenge,
   and social Challenge duties.
3. `GGG-014` through `GGG-024` — partner, reward, result, profile, reminder,
   privacy, admin, moderation, partner-portal, and pilot-cash duties.
4. `GGG-025` through `GGG-030` — public conversion, feedback, data migration,
   release, governance, and infrastructure readiness.
5. Re-evaluate `GGG-012`, `GGG-013`, and `GGG-900` through `GGG-904` only when
   their documented release or product gates change.

## Feature records

### GGG-001 — Account authentication and verified identity

- Intended user / duty / owning runtime: member; create or resume one Firebase
  account, verify email, and let the API derive a stable account from the bearer
  principal; member app and API/auth.
- Surfaces: member sign-up, sign-in, forgot-password, verify-email, Apple and
  Google controls; admin uses a separate password-only operator login; landing
  sends acquisition to `/join`.
- API and worker support / persistence: Firebase token guard and profile
  synchronization; `users` and `profiles`; no worker duty.
- Authentication and authorization: Firebase bearer token, verified-email gates
  for enrollment/value-bearing actions, API-derived user ID. Admin additionally
  requires active database roles and password provider.
- External providers / feature flag: Firebase; Apple and Google are separately
  disabled until provider configuration and platform tests exist.
- Current implementation / missing behavior: email/password account actions await
  authoritative Firebase results, including initial verification delivery.
  Verification and restored-session gates reload identity and force-refresh the
  token; API requests retry one unauthorized response with a forced refresh and
  then fail closed. The API verifies revocation, derives identity and default
  authorization from authoritative sources, and transactionally converges
  concurrent first use on one stable user/profile. Social providers remain
  fail-closed unless flag, platform, Firebase, and native-client prerequisites
  are all present. No known repository behavior remains missing for this duty.
- Required tests / operations / cloud dependency: form normalization, email
  verification, token refresh, stable profile, bearer enforcement, revoked and
  disabled identities, native provider smoke tests; Firebase project and runtime
  credentials are cloud dependencies.
- Delivery: priority `P0`; assigned task `GoGymGo Feature GGG-001 — Account
  authentication and verified identity`; branch
  `agent/ggg-001-account-authentication` (deleted after merge); PR `#71`; merge
  `35dbf8095c423a4ea28261952230135a42649402`; status `COMPLETE`.
- Residual risks / blocker: hosted Firebase values, provider enablement, and
  physical provider/device smoke tests remain release-environment UAT requiring
  separate credentials and deployment authority. Controls remain unavailable
  meanwhile. No cloud access or deployment occurred for this delivery.

### GGG-002 — Versioned legal documents and consent receipts

- Intended user / duty / owning runtime: member and owner-operator; show the exact
  applicable Privacy Policy, Terms, and Contest rules and persist immutable
  acceptance receipts; member app, API/legal, admin.
- Surfaces: Region + Agreements, legal modals, Profile, admin Content + Legal,
  public privacy/rules links.
- API and worker support / persistence: current-document, receipt-status, receipt,
  and owner publication/withdrawal endpoints; `legal_documents`, events, receipt
  bundles, immutable acceptance context, and receipts; no routine worker duty.
- Authentication and authorization: current documents are public; receipts are
  member-authenticated; publication is admin- and configured-owner-restricted.
- External providers / feature flag: Firebase identity; no product flag.
- Current implementation / missing behavior: member and public routes render the
  authoritative current jurisdiction/locale publication or fail unavailable with
  retry; preview copy is explicitly non-authoritative. Account agreement lists
  every current receipt-required document with exact action/version and submits
  only that displayed bundle. The API validates current IDs/actions/hashes and
  immutable acceptance context transactionally, tolerates concurrent retries and
  reset re-acceptance, and keeps status/enrollment fail-closed. Publication and
  withdrawal require the configured owner; impossible destructive deletion was
  removed. The pilot configurator requires an exact approved content SHA-256. No
  known repository behavior remains missing for this technical duty.
- Required tests / operations / cloud dependency: document identity, owner gate,
  stale/superseded bundle, durable receipts, enrollment fail-closed, browser
  rendering; database, Firebase owner identity, and deployed public URLs.
- Delivery: priority `P0`; assigned task `GoGymGo Feature GGG-002 — Versioned
  legal documents and consent receipts`; branch
  `agent/ggg-002-versioned-legal-documents` (deleted after merge); PR `#74`;
  merge `ed0ef8a940ab65f01c312be9cfbd75d94002a61d`; status `COMPLETE`.
- Residual risks / blocker: final owner/counsel approval of substantive text,
  verified public contacts/URLs, supplying the exact approval digest, and staging
  publication/receipt/withdrawal/reset rehearsal remain external release gates.
  Missing approval/configuration remains fail-closed. No cloud access or
  deployment occurred for this delivery.

### GGG-003 — Region eligibility and regional waitlist

- Intended user / duty / owning runtime: prospective member and operator; prove
  current regional eligibility from a fresh minimized location check or record a
  non-registration update request; member app, API/regions and gyms, admin.
- Surfaces: onboarding Region, regional-status profile state, landing regional
  updates, admin region policy and waitlist views.
- API and worker support / persistence: regions, current/create verification,
  waitlist, and operator decision endpoints; `region_policies`,
  `region_verifications`, and `region_waitlist_entries`; no raw coordinates in
  public reads.
- Authentication and authorization: region catalogs and waitlist intake are
  public as designed; verification is member-authenticated; decisions/config are
  admin-only and audited.
- External providers / feature flag: browser/native geolocation and PostGIS; no
  flag, but competition enablement is policy data.
- Current implementation / missing behavior: Vancouver Island + Gulf Islands
  geometry and pending/approved/rejected states exist. Missing real-device
  permission/accuracy UAT and deployed-policy reconciliation.
- Required tests / operations / cloud dependency: boundary points, minimized
  evidence, pending fail-closed, age/jurisdiction matching, waitlist validation,
  reviewer audit; PostgreSQL/PostGIS and physical-device location.
- Delivery: priority `P0`; assigned task `GoGymGo Feature GGG-003 — Region
  eligibility and regional waitlist`; branch `agent/ggg-003-region-eligibility`;
  PR/merge `pending`; status `IN_PROGRESS`.
- Residual risks / blocker: legal approval of enabled geography and on-device
  location behavior remain external gates.

### GGG-004 — Competition discovery, enrollment, Weekly Goal, and withdrawal

- Intended user / duty / owning runtime: eligible member; discover the current
  Contest, select a locked 1-7 day Weekly Goal, enroll against current evidence,
  or irreversibly withdraw; member app and API/competitions.
- Surfaces: onboarding Weekly Goal, Home, Profile withdrawal, admin Contest setup;
  landing explains eligibility and sends users to `/join`.
- API and worker support / persistence: current competition/enrollment/count,
  enrollment and withdrawal; worker activates/cancels by schedule;
  `competitions`, goal brackets, rule acceptances, enrollments.
- Authentication and authorization: verified email, current legal receipt,
  approved region, age attestation, contest/gym constraints; admin publication is
  role/version/reason/idempotency protected.
- External providers / feature flag: Firebase and database; competition status is
  server configuration, not a client flag.
- Current implementation / missing behavior: connected late enrollment, entrant
  cap, single-entrant launch, immutable goal, and withdrawal cleanup. Missing
  staging lifecycle and real-pilot configuration evidence.
- Required tests / operations / cloud dependency: registration timing, cap,
  idempotency, immutable goal, one enrollment, withdrawal closing workouts and
  challenge eligibility, worker activation/cancellation; database and deployed
  worker.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-004 — Competition enrollment
  and withdrawal`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: published Contest requires approved legal, reward,
  region, and assigned-gym prerequisites.

### GGG-005 — Partner gym selection and contest QR enrollment

- Intended user / duty / owning runtime: member and gym/admin operator; use one
  contest-specific static QR to bind enrollment to an approved Partner gym;
  member app, API/gyms and competitions, admin/partner portal.
- Surfaces: QR scanner during enrollment, Contest setup gym assignment, printable
  poster issuance/revocation, partner My gyms.
- API and worker support / persistence: QR resolution, scan, credential issue,
  active lookup/revocation, competition-gym assignment; `gym_locations`,
  credentials, assignments, scan events, enrollment partner-gym reference.
- Authentication and authorization: member scan is authenticated for enrollment;
  admin or assigned partner roles manage only authorized gyms; credentials are
  contest-scoped, location-bound, replay-safe, and audited.
- External providers / feature flag: camera, geolocation, Firebase; `partnerGymQr`
  is enabled for the pilot while legacy methods are disabled.
- Current implementation / missing behavior: persistent contest posters and
  enrollment pinning are connected. Missing real gym/coordinates, physical
  poster issuance, camera UAT, and native app-link identifiers.
- Required tests / operations / cloud dependency: QR tamper/replay/expiry,
  contest and gym mismatch, scoped partner authorization, poster render, camera
  permissions, exact enrollment gym persistence; real gym and devices.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-005 — Partner gym QR
  enrollment`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: production QR must never use sample gym data or
  placeholder native identifiers.

### GGG-006 — Verified workout lifecycle, cancellation, and recovery

- Intended user / duty / owning runtime: enrolled member and reviewer; start with
  a fresh gym-location check, survive timer/background/retry paths, finish after
  30 minutes, reconcile pending/verified/rejected state, or explicitly cancel
  without leaving an active server session; member app, API/sessions and gyms,
  worker/review operations.
- Surfaces: Start Workout, QR/location modal, active workout, completion/retry,
  admin review queue and gym visits; landing explains the two-location-check
  pilot.
- API and worker support / persistence: gym scan, session create/events/complete/
  cancel, progress, reviewer verify/reject; `workout_sessions`, `session_events`,
  `gym_scan_events`, ledger/progress rows; worker supports review/operations.
- Authentication and authorization: member owns the session; reviewer actions
  require operator authorization; retryable writes are idempotent; server time
  and evidence are authoritative.
- External providers / feature flag: device location and Firebase; QR enabled;
  device presence, heart rate, and mid-session presence disabled.
- Current implementation / missing behavior: start, finish, review, and recovery
  now include explicit confirmed cancellation. Successful cancellation uses the
  authoritative session ID, including a fresh-result fallback; calls the
  authenticated, idempotent, owned-session cancel endpoint; clears only local
  active-session recovery while preserving the Partner gym; invalidates progress;
  and permits another start. Failure remains recoverable and App Tour remains
  API-isolated. No known repository behavior remains missing for this duty.
- Required tests / operations / cloud dependency: start/too-early/finish,
  evidence rejection, pending review, idempotent completion, failed-submit retry,
  explicit cancellation confirmation, local-session cleanup, active-slot reuse,
  browser/mobile backgrounding, physical two-device gym UAT; database and real
  gym/device staging.
- Delivery: priority `P0`; assigned task `GoGymGo Feature GGG-006 — Cancel and
  recover active QR workout`; branch `agent/cancel-active-qr-workout` (deleted
  after merge); PR `#68`; merge `f9df8ab3f8f9387adeaa964d60a1bd04327647b8`;
  status `COMPLETE`.
- Residual risks / blocker: there is no dedicated rendered component interaction
  harness; source-audit, repository/storage, journey, and database coverage
  enforce the repaired boundaries. Physical staging UAT remains a program-level
  release gate and requires separate deployment authority. No cloud access or
  deployment occurred for this delivery.

### GGG-007 — Competition scoring, progress, rankings, and settlement inputs

- Intended user / duty / owning runtime: member and operator; calculate server-
  authoritative verified days, Weekly Goal results, Bonus Days, Perfect Month,
  category score, entries, and standings; API/competitions, ledger,
  leaderboards, worker; member and admin clients.
- Surfaces: Home progress, Regional Ranks/standings, admin Contest home.
- API and worker support / persistence: leaderboard/current, me/progress,
  lifecycle/scoring services; sessions, entry ledger, progress, matches, draws.
- Authentication and authorization: personal progress is authenticated; public
  leaderboard exposes permitted identity only; settlement is admin-only,
  versioned, reasoned, and audited.
- External providers / feature flag: PostgreSQL and worker; published competition
  rules are the capability boundary.
- Current implementation / missing behavior: four scoring weeks, late enrollment,
  score reconciliation, tie inputs, Bonus Days, and single-entrant rules have
  direct tests. Missing full-month staging rehearsal and bounded feature audit.
- Required tests / operations / cloud dependency: timezone/calendar edges,
  duplicate verified days, weekly multipliers, bonus/perfect month, goal category
  tie order, reconciliation migration, lifecycle transitions; database/worker.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-007 — Competition scoring and
  rankings`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: equal-chance tie-break and final draw publication must
  remain auditable and cannot be inferred client-side.

### GGG-008 — Streak calculation and visible Alias badges

- Intended user / duty / owning runtime: member and social/result viewers; derive
  daily, weekly, monthly, and yearly streaks from verified dates and render at
  most two compact badges beside an Alias; API/streaks and member app.
- Surfaces: Home streak panel, Profile, rankings, friends, Weekly Challenges,
  Challenges, Winners Circle; no independent admin workflow.
- API and worker support / persistence: `GET /v1/streaks/me` and public streak
  projections reuse verified `workout_sessions`; partial streak query index.
- Authentication and authorization: own streak endpoint is authenticated;
  shared rows expose only permitted public streak fields.
- External providers / feature flag: PostgreSQL; no flag.
- Current implementation / missing behavior: documented end-to-end implementation
  with timezone, gap, duplicate-period, and display tests. Still requires a
  bounded cross-surface audit proving every Alias row follows the two-badge rule.
- Required tests / operations / cloud dependency: verified-only source, period
  boundaries, grace periods, timezone fallback, zero state, compact
  decomposition, all Alias surfaces; database.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-008 — Streaks and Alias
  badges`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: historical UI may omit badges on a less-visible Alias
  row until the surface audit is complete.

### GGG-009 — Friends, Alias discovery, requests, and private invitations

- Intended user / duty / owning runtime: member; manage one public Alias, search
  without exposing contact data, request/accept/decline friendships, and invite
  contacts through masked expiring links; member app and API/social.
- Surfaces: Profile and Squad Social; no direct admin workflow beyond privacy and
  audit; public landing has no friend directory.
- API and worker support / persistence: user search, friends, friend requests,
  challenge contact invitations/redemption; profiles, requests, friendships,
  hashed invitation destinations/tokens.
- Authentication and authorization: all social routes require Firebase; block and
  ownership rules override discovery and invitations; raw destinations are not
  returned.
- External providers / feature flag: future email/SMS delivery provider is not
  identified; no UI flag.
- Current implementation / missing behavior: repository/UI/API contracts and
  privacy rules exist. Verify whether contact invitations are actually delivered
  rather than only returning a link; delivery-provider operations are not
  documented.
- Required tests / operations / cloud dependency: Alias uniqueness/search bounds,
  request state, block enforcement, masked destinations, hashed/single-use token,
  expiry, delivery failure/retry; database plus any approved email/SMS provider.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-009 — Friends and private
  invitations`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: product copy must not imply an email or text was sent
  unless an authoritative delivery provider accepted it.

### GGG-010 — Direct Weekly Challenges

- Intended user / duty / owning runtime: enrolled friends; request and explicitly
  accept one eligible same-goal partner per scoring week and show allowed partner
  progress; member app, API/competitions, worker settlement.
- Surfaces: Squad Weekly Challenge and detail; admin Contest rules and settlement.
- API and worker support / persistence: eligible partners, request list/create/
  response, match reads and scoring; weekly requests and competition matches.
- Authentication and authorization: same competition, region, week, Weekly Goal,
  accepted friendship, ownership, and conflicting-request rules are server-side.
- External providers / feature flag: database/worker; no flag.
- Current implementation / missing behavior: direct pairing and recent timing/
  workout-access fixes are merged. Missing complete four-week two-account staging
  rehearsal and independent feature audit.
- Required tests / operations / cloud dependency: eligibility, explicit response,
  conflict cancellation, solo/searching state, 1x/2x/3x settlement, permitted
  partner stats, withdrawal; database/worker.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-010 — Direct Weekly
  Challenges`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: pre-settlement projections must never be labeled as
  banked entries.

### GGG-011 — Friend and regional activity Challenges

- Intended user / duty / owning runtime: member; create, invite, discover, join,
  and record progress for structured social activity goals without granting
  Contest credit; member app and API/social.
- Surfaces: Squad Social My/Discover/Create; operator sees relevant privacy/audit
  records only.
- API and worker support / persistence: challenge list/discovery/create/join/
  check-in/invitations; challenge, member, check-in, and contact-invitation tables.
- Authentication and authorization: member ownership, accepted-friend, region,
  membership, capacity, block, and one-check-in-per-day rules; idempotent writes.
- External providers / feature flag: optional contact-delivery provider; no flag.
- Current implementation / missing behavior: structured UI/API/data model and
  integration workflow exist. Missing authoritative delivery evidence and a
  bounded browser accessibility/failure-state audit.
- Required tests / operations / cloud dependency: validation bounds, discovery,
  capacity, invitation states, block/privacy, verified-gym derivation, manual
  non-gym check-in, no Contest credit, exports; database.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-011 — Social activity
  Challenges`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: large combined client component raises regression
  risk; refactoring is not required unless the feature task needs it.

### GGG-012 — Creator workout catalog and calendar planning

- Intended user / duty / owning runtime: member; browse approved hosted creator
  workouts and add private dated plans without implying verified credit; member
  app, API/creator-workouts, admin content.
- Surfaces: Home, Workouts catalog/detail, Calendar, admin Content + Legal;
  landing describes future creator participation only where approved.
- API and worker support / persistence: catalog and plan create/list;
  `creator_workouts` and `creator_workout_plans`; no worker requirement.
- Authentication and authorization: member catalog/plans use authenticated API;
  admin publication is role/version/reason protected.
- External providers / feature flag: approved external HTTPS video hosts;
  `EXPO_PUBLIC_ENABLE_CREATOR_FEATURES` and
  `NEXT_PUBLIC_ENABLE_CREATOR_FEATURES`, both false by default.
- Current implementation / missing behavior: client, API, persistence, and admin
  controls exist, but all creator release surfaces are deliberately paused.
- Required tests / operations / cloud dependency: flag parity/fail-closed build,
  approved-only catalog, ownership/private note, date validation, no Contest
  credit, unavailable video; approved media/rights and deliberate release config.
- Delivery: priority `P3`; task `GoGymGo Feature GGG-012 — Creator catalog and
  planning`; branch/PR/merge `unassigned`; status `DEFERRED`.
- Residual risks / blocker: deferred because the creator program is paused in the
  shared release capability; do not silently enable it.

### GGG-013 — Creator applications, rights-attested submissions, and moderation

- Intended user / duty / owning runtime: prospective/approved creator and admin;
  apply, submit hosted media with immutable rights/AI disclosures, and receive an
  audited moderation decision; member app, API/partners and creator-workouts,
  admin.
- Surfaces: public creator application, creator submit/status, Profile partner
  intake, admin operations/content; landing partner funnel.
- API and worker support / persistence: creator application, submission, own
  submissions, operator decision, catalog configuration; partner applications,
  creator video submissions, rights receipts/catalog.
- Authentication and authorization: submissions are authenticated/owned; admin
  moderation is role/reason/idempotency protected.
- External providers / feature flag: hosted video and rights approvals; shared
  creator flags default false.
- Current implementation / missing behavior: code and contracts exist but the
  release capability rejects creator actions while paused; takedown/withdrawal
  remains operator-controlled.
- Required tests / operations / cloud dependency: validation, rights version,
  AI/sponsor disclosure, moderation states, ownership, publication/removal,
  flag parity, external media safety; approved creator program and hosted media.
- Delivery: priority `P3`; task `GoGymGo Feature GGG-013 — Creator submissions
  and moderation`; branch/PR/merge `unassigned`; status `DEFERRED`.
- Residual risks / blocker: product/business/rights approval is absent; enablement
  would materially change the release.

### GGG-014 — Sponsor, gym, and creator partner intake

- Intended user / duty / owning runtime: prospective partner and operator;
  submit a validated application and let authorized staff review it without
  treating an inquiry as approval; landing, member app, API/partners, admin.
- Surfaces: landing Brands/Partners forms, member sponsor/gym/creator application
  routes and Profile links, admin Operations queue.
- API and worker support / persistence: creator/sponsor/gym application routes,
  interest submissions, operator list/decision; `partner_applications` and
  `interest_submissions`.
- Authentication and authorization: member-app partner applications are
  authenticated where required; landing intake is public, validated and rate
  limited; decisions are admin-only and audited.
- External providers / feature flag: no provider is required for persistence;
  creator intake follows creator release flag on creator-specific surfaces.
- Current implementation / missing behavior: authoritative API forwarding and
  explicit outcomes exist. Verify duplicate/rate-limit handling and that no
  form claims activation or outbound follow-up.
- Required tests / operations / cloud dependency: validation, spam field, rate
  limits, deduplication/idempotency, role decision, privacy retention/export,
  landing-to-API failure; deployed API/database.
- Delivery: priority `P2`; task `GoGymGo Feature GGG-014 — Partner intake and
  review`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: contractual onboarding remains a human process, not
  an application success state.

### GGG-015 — Brand Rewards catalog, inventory, awards, and claims

- Intended user / duty / owning runtime: member winner and admin; publish exact
  physical/coupon inventory, display honest availability, assign bounded awards,
  and let only the winner claim idempotently; member app, API/rewards and draws,
  admin.
- Surfaces: Regional Ranks Rewards, My Rewards, claim states, Contest setup and
  reward administration; landing explains sponsor-funded rewards.
- API and worker support / persistence: catalog, awards/me, claim; reward CRUD,
  coupon upload/status, award status; catalog, awards, encrypted codes, draws.
- Authentication and authorization: public catalog is read-only; claims are
  authenticated and ownership-checked; admin writes require exact role,
  idempotency, reason, and optimistic version.
- External providers / feature flag: AES-256-GCM key from secret manager and
  sponsor URLs/codes; no UI flag.
- Current implementation / missing behavior: inventory triggers, unique slots,
  cipher, claim reconstruction, and admin workflow exist. Missing production
  encryption key, real approved inventory/terms, and staging secrecy/claim UAT.
- Required tests / operations / cloud dependency: insufficient/duplicate codes,
  over-allocation, draw slot bounds, concurrent/idempotent claims, ownership,
  plaintext log/export exclusion, fulfillment transitions; secret manager,
  database, sponsor assets.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-015 — Brand Rewards and
  claims`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: never publish placeholder inventory or expose coupon
  plaintext; business/legal approval is external.

### GGG-016 — Audited draw settlement and Winners Circle

- Intended user / duty / owning runtime: operator, participant, and public result
  viewer; lock an exact entrant snapshot, commit/reveal a secure seed, settle once,
  and publish category champions and reward winners only after audit; API/draws
  and results, admin, member app.
- Surfaces: admin Finalize + publish results, member Winners Circle and latest
  result, landing only makes general contest claims.
- API and worker support / persistence: draw lock/settle, settled and reward-winner
  results; competition draws, entries, progress, awards, audit events.
- Authentication and authorization: settlement is admin-only/reasoned/idempotent;
  member result is participant-scoped until public settlement; public identity is
  permission-limited.
- External providers / feature flag: secure browser randomness and database; no
  flag.
- Current implementation / missing behavior: commitment/reveal resume and result
  paths are implemented. Missing full-month staging settlement rehearsal and an
  independently retained seed/audit recovery exercise.
- Required tests / operations / cloud dependency: exact snapshot, one user/rank,
  deterministic reveal, interrupted resume, duplicate settle, pending visibility,
  Alias/badge privacy, reward linkage; database and operator browser storage.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-016 — Draw settlement and
  Winners Circle`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: clearing the signed-in browser between lock/reveal is
  an operational hazard documented in the admin runbook.

### GGG-017 — Profile Alias, moderated avatar, and account controls

- Intended user / duty / owning runtime: member and moderator; maintain permitted
  public identity, private account state, avatar upload/moderation/removal, links,
  sign-out, and honest local reset/withdrawal controls; member app, API/profiles,
  storage, admin review.
- Surfaces: Profile, Identity, Account Data, admin media review; landing has no
  public member directory.
- API and worker support / persistence: profile get/update, signed avatar upload/
  complete/read/delete, moderation action/decision; profiles and profile media;
  worker cleans expired/deleted objects.
- Authentication and authorization: member owns writes/reads; signed actions are
  short-lived and private; moderation is admin-only; Alias uniqueness and public
  fields are server-enforced.
- External providers / feature flag: private Amazon S3; `PROFILE_MEDIA_ENABLED`
  defaults false.
- Current implementation / missing behavior: Alias and lifecycle code exist;
  avatar duty needs storage enablement, CORS, moderation, cleanup, and real upload
  UAT before it performs in a release.
- Required tests / operations / cloud dependency: Alias validation/uniqueness,
  upload size/type/signature, pending/approve/reject/remove, ownership, cleanup,
  privacy deletion, local reset semantics; S3/CORS and worker.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-017 — Profile and moderated
  avatar`; branch/PR/merge `unassigned`; status `READY`.
- Residual risks / blocker: cloud storage is disabled by default and may not be
  inspected or enabled without separate authority.

### GGG-018 — Competition reminders and push-device lifecycle

- Intended user / duty / owning runtime: member; opt into Weekly Goal, Weekly
  Challenge, and Bonus Day reminders with local schedules plus an authenticated
  Expo push registration, and disable both together; member app, API/notifications,
  worker.
- Surfaces: Profile reminder controls; admin health/queue visibility.
- API and worker support / persistence: push device register/disable, notification
  lease/delivery; push devices and notification deliveries.
- Authentication and authorization: device registration belongs to the member;
  tokens are not public; worker leases retries durably.
- External providers / feature flag: Expo Push; `PUSH_NOTIFICATIONS_ENABLED`
  defaults false and an access token may be required.
- Current implementation / missing behavior: local/native services, server client,
  templates, leases, and disable path exist. Missing release EAS project, physical
  permission/token tests, provider credentials, delivery/retry staging evidence.
- Required tests / operations / cloud dependency: permission states, register/
  disable coupling, token rotation, duplicate delivery, lease recovery, provider
  failure, background notifications; Expo/Firebase project and worker.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-018 — Competition reminders
  and push`; branch/PR/merge `unassigned`; status `READY`.
- Residual risks / blocker: no UI may claim push delivery while the provider is
  disabled or unavailable.

### GGG-019 — Privacy export, deletion, and local-device reset

- Intended user / duty / owning runtime: member, privacy operator, and worker;
  request/inspect/download a portable export, request confirmed account deletion,
  process it durably with approved pseudonymous integrity retention, and separately
  clear only local state; member app, API/privacy, worker, admin.
- Surfaces: Account Data, Profile reset, admin privacy review queue, landing
  account-deletion instructions.
- API and worker support / persistence: privacy request create/list/download action,
  operator decision; privacy requests/events and all affected records; worker
  export/deletion with leases and object cleanup.
- Authentication and authorization: member ownership and explicit confirmation;
  admin decision; short-lived private download; pseudonymization key is secret.
- External providers / feature flag: private S3; `PRIVACY_OPERATIONS_ENABLED`
  defaults false.
- Current implementation / missing behavior: service, worker, pseudonymization,
  event history, download action, and local reset exist. Missing production keys/
  bucket lifecycle, deployed end-to-end export/deletion, restore/incident rehearsal.
- Required tests / operations / cloud dependency: ownership, confirmation,
  retry/lease recovery, export completeness and minimization, deletion graph,
  retained integrity, object purge, short-lived URL, local-only reset; S3,
  database, worker, secrets.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-019 — Privacy operations and
  local reset`; branch/PR/merge `unassigned`; status `READY`.
- Residual risks / blocker: privacy operations cannot be marked complete while
  disabled in the release environment.

### GGG-020 — Admin authentication and role-scoped platform access

- Intended user / duty / owning runtime: GoGymGo admin and gym partner operator;
  sign into the correct invitation-only workspace and enforce every role/scope at
  the API rather than navigation; admin app and API/operator/auth.
- Surfaces: admin login, full console, partner workspace; member and landing only
  link to the dedicated admin origin where appropriate.
- API and worker support / persistence: operator access, dashboard/partner dashboard,
  admin authorization; users/roles, gym assignments, audit events.
- Authentication and authorization: verified Firebase password identities;
  database roles authoritative; admin global, partner admin scoped mutation,
  partner staff read-only, normal member denied.
- External providers / feature flag: Firebase and Cloudflare Access in production;
  no public registration or social-provider flag.
- Current implementation / missing behavior: role-aware API and UI, same-origin
  allowlisted proxy, and CI safeguards exist. First owner/partner assignments use
  audited trusted scripts; dual-approval delegation is not implemented.
- Required tests / operations / cloud dependency: provider restriction, member
  denial, role/scope matrix, cross-gym denial, proxy allowlist, bootstrap/
  assignment audit, revocation; Firebase, database, Cloudflare Access.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-020 — Role-scoped admin
  access`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: adding administrators beyond the owner requires the
  separately designed dual-approval security workflow or documented deferral.

### GGG-021 — Contest, region, reward, legal, creator, and gym administration

- Intended user / duty / owning runtime: authorized admin; create valid drafts,
  satisfy prerequisites, publish/cancel/archive/delete only allowed records, and
  retain reasoned idempotent audit history; admin app and API/operator modules.
- Surfaces: Contest home/setup, Rewards and Regions drill-ins, Content + Legal,
  Pilot gym/poster controls.
- API and worker support / persistence: configuration endpoints across region,
  competition, reward, legal, creator, and gym modules; all authoritative tables;
  worker performs timed lifecycle.
- Authentication and authorization: exact admin role, owner gate for legal,
  optimistic version, idempotency key, reason, deletion policy, append-only audit.
- External providers / feature flag: creator controls follow shared creator flag;
  database/PostGIS required.
- Current implementation / missing behavior: one-page Contest publication journey
  and supporting panels are implemented with direct tests. Missing real
  configuration/UAT and a full mutation-by-mutation feature audit.
- Required tests / operations / cloud dependency: validation, publish
  prerequisites, DST schedule, version conflict, idempotency, deletion state,
  role denial, audit before/after, worker transition; database/worker.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-021 — Administrative
  configuration`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: broad surface can hide unreachable drill-ins; browser
  testing must prove every advertised action is reachable and authoritative.

### GGG-022 — Human review queues, audit history, and operational health

- Intended user / duty / owning runtime: operator/support; inspect pending session,
  region, partner, privacy, and media work, take authorized decisions, trace audit
  events, and detect worker/database degradation; admin app, API/operator and
  operations worker.
- Surfaces: Operations, Audit history, Contest home alerts; no member write path
  beyond seeing authoritative pending/error state.
- API and worker support / persistence: work queue, system health, review detail/
  decisions, partner/privacy/media decisions, audit history, health endpoints;
  worker heartbeats, domain tables, audit events.
- Authentication and authorization: admin only; decisions require reason and
  idempotency; sensitive review data is not public.
- External providers / feature flag: optional OTLP, database, worker; feature-
  specific providers may be disabled.
- Current implementation / missing behavior: queue, heartbeat, observability,
  decision endpoints, and UI exist. Missing deployed alerting/SLO ownership,
  stuck-job rehearsal, and feature-specific review browser tests.
- Required tests / operations / cloud dependency: stale/degraded worker, queue
  counts, lease recovery, every decision authorization/state conflict, audit
  search/redaction, OTLP failure safety; deployed worker/monitoring.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-022 — Review queues and
  operational health`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: observability is measurable in code but production
  alerts cannot be verified without authorized environment access.

### GGG-023 — Gym partner portal and QR poster operations

- Intended user / duty / owning runtime: assigned gym admin/staff; view only
  assigned gyms/visits, manage posters at allowed level, and create gym-owned
  Contest drafts for GoGymGo publication; admin app and API/operator portal.
- Surfaces: partner Overview, My gyms, Contests, Gym visits; GoGymGo admin retains
  publication and global controls.
- API and worker support / persistence: partner dashboard, scoped gym/QR actions,
  proposal CRUD; gym partner assignments, proposals, gyms, sessions, credentials.
- Authentication and authorization: password-only verified operator, active
  assignment, per-gym scope; partner admin write, staff read-only; admin publishes.
- External providers / feature flag: Firebase; no public flag.
- Current implementation / missing behavior: portal, migrations, assignment CLI,
  and database integration tests exist. Missing real partner login/revocation and
  cross-gym browser UAT.
- Required tests / operations / cloud dependency: access-level matrix, assignment
  revoke, cross-gym denial, draft ownership/state, poster issue/revoke, visit
  privacy, admin publication; Firebase/database/Cloudflare Access.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-023 — Gym partner portal`;
  branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: operator credential issuance remains a controlled
  human process and must not become public signup.

### GGG-024 — September pilot cash reward and manual fulfillment

- Intended user / duty / owning runtime: eligible pilot member and admin; publish
  exactly one GoGymGo-sponsored $100 CAD reward, settle it fairly, and record
  manual fulfillment without payment rails; member results, API, admin pilot.
- Surfaces: enrollment reward summary, Winners Circle, admin cash fulfillment;
  landing states GoGymGo is the pilot sponsor.
- API and worker support / persistence: pilot configuration, draw/results, cash
  fulfillment operator route; competition/reward/draw and `cash_fulfillments`.
- Authentication and authorization: no purchase; winner/result ownership;
  admin-only audited manual fulfillment.
- External providers / feature flag: no payment provider; pilot configuration is
  explicit and idempotent.
- Current implementation / missing behavior: sole-reward publication guard and
  manual record exist. Documentation also describes the broader marketplace as
  having no cash prizes; final pilot/legal copy must reconcile this explicit
  exception and the UI empty state `Rewards coming soon` must remain honest.
- Required tests / operations / cloud dependency: exactly-one reward, no wallet/
  payout schema, fair settlement, duplicate fulfillment, public copy consistency,
  manual receipt/audit; real approved reward and staging database.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-024 — September pilot cash
  reward`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: legal/financial authority for the cash reward and
  winner fulfillment is outside repository authority.

### GGG-025 — Public marketing, product demo, and join conversion

- Intended user / duty / owning runtime: prospective member/partner; understand
  the exact September offer and reach the canonical isolated demo, live `/join`,
  rules, or partner path without a duplicate account/demo system; landing and
  member web.
- Surfaces: landing Home, Gym-goers, Brands, Partners, FAQ, Contact, demo redirect,
  canonical member demo/join.
- API and worker support / persistence: no persistence for navigation; conversion
  events are handled under `GGG-026`; member routes use the authoritative API.
- Authentication and authorization: public; demo isolates Firebase/API/camera/
  location and never creates authoritative value.
- External providers / feature flag: configured member-app origin; browser test
  preview is separate and forbidden in production.
- Current implementation / missing behavior: responsive copy/navigation and real
  app screenshots are directly tested. Missing production-domain crawl, link,
  analytics, and accessibility UAT after final legal/reward copy.
- Required tests / operations / cloud dependency: canonical links, demo isolation,
  no misleading registration/reward claims, SEO/robots/sitemap, responsive and
  keyboard behavior, production artifact audit; Sites/Firebase hosting domains.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-025 — Public conversion
  journeys`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: landing claims must track release capability and the
  approved pilot reward exactly.

### GGG-026 — Public-site feedback and privacy-safe conversion measurement

- Intended user / duty / owning runtime: public visitor and site owner; submit
  accessible feedback and record only allowlisted anonymous funnel events with
  owner-restricted export; landing.
- Surfaces: Contact/feedback form and measured join/demo/updates/partner actions;
  no member/admin product surface except owner export.
- API and worker support / persistence: landing route handlers and owner export;
  historical D1 tables `public_site_feedback` and `public_site_events`.
- Authentication and authorization: public writes are validated/minimized;
  export is disabled by default and owner-restricted.
- External providers / feature flag: Cloudflare D1 binding; export enable variables
  default off.
- Current implementation / missing behavior: tests cover allowlists, validation,
  accessibility, empty defaults, and export gate. Missing production retention,
  owner export rehearsal, and decision whether data migrates to PostgreSQL.
- Required tests / operations / cloud dependency: event allowlist/no PII,
  validation/spam/rate limits, owner denial, disabled export, retention/deletion,
  analytics failure isolation; Cloudflare D1/Sites.
- Delivery: priority `P2`; task `GoGymGo Feature GGG-026 — Public feedback and
  measurement`; branch/PR/merge `unassigned`; status `AUDITED`.
- Residual risks / blocker: no cloud inspection or export is authorized in this
  program task.

### GGG-027 — Landing submission migration and authoritative intake cutover

- Intended user / duty / owning runtime: operator/data owner; keep new regional
  and partnership submissions authoritative in PostgreSQL, export historical D1
  rows read-only once, import idempotently, verify counts, then remove legacy
  binding; landing, API, operations.
- Surfaces: invisible to members except reliable forms; owner-restricted export
  and API/admin intake views.
- API and worker support / persistence: landing forwards to API waitlist/interest
  routes; D1 export and PostgreSQL import/configuration path; D1 and API tables.
- Authentication and authorization: public intake validated/rate-limited; legacy
  export disabled and owner-only; import is an operator procedure.
- External providers / feature flag: Cloudflare D1 and PostgreSQL;
  `LANDING_D1_EXPORT_ENABLED=no` by default.
- Current implementation / missing behavior: cutover code and runbook exist;
  historical export/import/count verification and D1 removal are not evidenced.
- Required tests / operations / cloud dependency: read-only export, owner gate,
  idempotent import, duplicate mapping, count/hash verification, rollback, export
  disablement; Cloudflare and database access.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-027 — Landing data cutover`;
  branch/PR/merge `unassigned`; status `READY`.
- Residual risks / blocker: requires unavailable/unauthorized cloud access and must
  not be attempted from a normal feature task.

### GGG-028 — Browser pilot release and native QR-link handoff

- Intended user / duty / owning runtime: release owner and member; publish an
  honest HTTPS browser pilot now and later make `app.gogymgo.com/scan` open signed
  native apps only with real identifiers; member app and release workflows.
- Surfaces: member web, native app links, QR poster; admin/landing link to canonical
  origins.
- API and worker support / persistence: API connectivity only; release audits and
  hosting workflows own artifacts, not product data.
- Authentication and authorization: release source must be an exact merged main
  PR; protected environments and Firebase rules apply.
- External providers / feature flag: Firebase Hosting, EAS/Apple/Google app links;
  browser pilot audit requires native association files omitted and preview off.
- Current implementation / missing behavior: browser-only protected workflow and
  audits are merged. Native release lacks final bundle/package/team/signing IDs,
  EAS project, store URLs, and physical app-link validation.
- Required tests / operations / cloud dependency: source authorization, exact
  export audit, demo exclusion, association generation, signed iOS/Android link
  test, rollback; Firebase/EAS/Apple/Google and domains.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-028 — Member release and
  native links`; branch/PR/merge `unassigned`; status `READY`.
- Residual risks / blocker: deployment is not authorized and placeholder native
  identifiers are forbidden.

### GGG-029 — Contracts, critical journeys, architecture, and dependency governance

- Intended user / duty / owning runtime: engineering/operator; prevent contract
  drift, cross-runtime leakage, unplanned broad changes, vulnerable dependencies,
  and regressions in connected launch journeys; all repository runtimes and CI.
- Surfaces: no product UI; governs member, admin, landing, API, contracts, and
  deployment artifacts.
- API and worker support / persistence: generated OpenAPI/TypeScript contract,
  source and production audits, database-backed journeys; no product table.
- Authentication and authorization: CI/branch protection and deployment-source
  policy; not an app auth feature.
- External providers / feature flag: GitHub Actions, npm advisories, Docker for
  integration; no feature flag.
- Current implementation / missing behavior: PRs #54, #55, and #56 merged as
  `b47a8e4`, `c18aeb9`, and `4155f80`; required main checks are green. Continue
  maintaining exact dated security exceptions and adding journeys with features.
- Required tests / operations / cloud dependency: governance, dependency audit,
  contracts check/generation, root check/build, journeys and integration,
  CodeQL/artifact audits; GitHub and local Docker only.
- Delivery: priority `P0`; historical tasks/branches merged through PRs #54-#56;
  latest merge `4155f806085ee09d743fa211656ae96e67fbfcb4`; status `COMPLETE`.
- Residual risks / blocker: this capability is continuous; each new feature must
  update its contract and regression coverage rather than relying on this record.

### GGG-030 — AWS platform foundation and deployable runtime operations

- Intended user / duty / owning runtime: platform operator; provision isolated
  Canadian API/worker/database/storage/secret/monitoring foundations and deploy
  migrations, worker, then API from exact approved source; infrastructure, API,
  GitHub workflows.
- Surfaces: no member surface beyond service availability; admin health reflects
  runtime; landing/member use configured API origins.
- API and worker support / persistence: ECS API/worker, RDS/PostGIS, S3, secret
  manager, health/telemetry, backups and migration job.
- Authentication and authorization: isolated AWS accounts, GitHub OIDC/protected
  environments, least privilege, manual production approval.
- External providers / feature flag: AWS, Firebase, GitHub; Terraform remote
  backend must be disabled for local validation.
- Current implementation / missing behavior: infrastructure and runbooks exist and
  prior PR #14 prepared the foundation. Deployed-resource truth, drift, costs,
  backups, alarms, and staging UAT are intentionally uninspected here.
- Required tests / operations / cloud dependency: offline Terraform validation/
  tests, image/security audit, migration idempotency, rollout/rollback, backup/
  restore, health/alerts; AWS cloud dependency is total.
- Delivery: priority `P0` after product code; task `GoGymGo — AWS Staging Read-Only
  Reconciliation` must be created only at the prescribed gate; branch/PR/merge
  `unassigned`; status `READY`.
- Residual risks / blocker: cloud deployment is not authorized. Read-only AWS
  reconciliation also requires available credentials and its separate task.

### GGG-900 — Wearable, heart-rate, biometric, and random-presence verification

- Intended user / duty / owning runtime: future member/fraud reviewer; provide
  signed additional workout evidence after legal, privacy, platform, and device
  approval; member app and API/session research paths.
- Surfaces: legacy verification/checkpoint routes remain isolated and must not
  appear in pilot navigation, permissions, App Tour, or production choices.
- API and worker support / persistence: legacy event types may remain for forward
  compatibility; fresh pilot schema creates no demo-verification tables.
- Authentication and authorization: would require member ownership, versioned
  consent, signed evidence, and reviewer authorization.
- External providers / feature flag: HealthKit/Health Connect, device attestation,
  local biometrics; all `devicePresence`, `heartRate`, and `midSessionPresence`
  capabilities are false.
- Current implementation / missing behavior: intentionally disabled historical/
  future code; no approved real evidence integration.
- Required tests / operations / cloud dependency: only isolation/release audits
  now; future task needs real device, evidence, privacy, threat-model, consent,
  spoof/replay, and retention tests.
- Delivery: priority `P4`; task/branch/PR/merge `not created`; status `DEFERRED`.
- Residual risks / blocker: deferred by the pilot PRD pending signed integrations
  and legal/privacy approval; do not restore casually.

### GGG-901 — Consumer payments, wallets, shipping, and automated cash payout

- Intended user / duty / owning runtime: future member/business operations;
  collect value or automate fulfillment only after a separately authorized
  product/legal/financial program; no current owning runtime.
- Surfaces: none; current UI must not expose entry fees, wallet, bank, payee,
  transfer, tax-form, or GoGymGo shipping-address flows.
- API and worker support / persistence: retired payment/payout schema and routes
  are absent and asserted absent by integration tests.
- Authentication and authorization: undefined until a future approved design.
- External providers / feature flag: no payment provider is configured; no flag.
- Current implementation / missing behavior: deliberately out of scope and
  removed from the production baseline.
- Required tests / operations / cloud dependency: current regression requires
  route/schema absence and no misleading copy; any future feature needs a full
  financial/security/compliance design.
- Delivery: priority `P5`; task/branch/PR/merge `not created`; status `DEFERRED`.
- Residual risks / blocker: explicit PRD deferral and missing financial/legal
  authority.

### GGG-902 — Sponsor creative delivery and campaign analytics

- Intended user / duty / owning runtime: future sponsor/operator; configure and
  report approved placements, impressions, clicks, reach, verified participation,
  claims, and supplied redemption signals without sensitive data; not assigned.
- Surfaces: landing promises only future approved campaigns; no live sponsor
  console or in-workout ad surface is allowed.
- API and worker support / persistence: partner intake and reward outcomes exist;
  no authoritative campaign creative/measurement module.
- Authentication and authorization: future sponsor scope and aggregate privacy
  thresholds are not designed.
- External providers / feature flag: future ad/analytics providers; none enabled.
- Current implementation / missing behavior: campaign projections/copy exist, but
  creative delivery, playback, ingestion, and reporting are explicitly deferred.
- Required tests / operations / cloud dependency: future consent, aggregation,
  k-anonymity/privacy, attribution, fraud, advertiser scope, retention, and
  disclosure tests.
- Delivery: priority `P4`; task/branch/PR/merge `not created`; status `DEFERRED`.
- Residual risks / blocker: deferred until a production contract and approval
  gate exist; landing must continue to say “future”.

### GGG-903 — GoGymGo-hosted creator and live video

- Intended user / duty / owning runtime: future creator/member; host creator-owned
  media or live sessions; no current owning runtime.
- Surfaces: none; current creator feature accepts only approved hosted-video URLs.
- API and worker support / persistence: metadata/submission records only; no media
  ingestion/transcoding/live pipeline.
- Authentication and authorization: future rights, moderation, takedown, access,
  and abuse controls are undefined.
- External providers / feature flag: future media/transcoding/CDN provider; creator
  feature is already paused.
- Current implementation / missing behavior: explicitly deferred by PRD.
- Required tests / operations / cloud dependency: future upload security,
  transcoding, moderation, captions, rights, takedown, streaming, cost, and CDN
  isolation.
- Delivery: priority `P5`; task/branch/PR/merge `not created`; status `DEFERRED`.
- Residual risks / blocker: missing product, rights, safety, provider, cost, and
  deployment authority.

### GGG-904 — Global multi-region launch

- Intended user / duty / owning runtime: future members/operators outside the
  approved pilot geography; launch only region by region with applicable legal,
  reward, gym, support, and operational approvals; all runtimes.
- Surfaces: current landing offers regional updates outside the pilot; member
  onboarding fails closed and offers waitlist rather than false eligibility.
- API and worker support / persistence: versioned region policies can support
  multiple regions, but only the Island pilot configuration is approved.
- Authentication and authorization: region evidence and policy gates remain
  authoritative.
- External providers / feature flag: local laws, sponsors, gyms, domains, cloud
  capacity; enabled policy data is the gate.
- Current implementation / missing behavior: multi-region primitives exist;
  global launch is explicitly deferred.
- Required tests / operations / cloud dependency: each future region needs
  boundary, timezone/DST, age/legal bundle, reward, gym, fraud, support,
  accessibility, cost, and full lifecycle UAT.
- Delivery: priority `P5`; task/branch/PR/merge `not created`; status `DEFERRED`.
- Residual risks / blocker: deferred pending region-specific legal and operational
  approval; never infer eligibility from marketing location text.

## Change history

- 2026-08-13 — Assigned `GGG-003` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-002 completion ledger merged through PR #75 as
  `b54f1a52844960b018155a1806033d2cd22ba401` with green main-push checks.
- 2026-08-13 — Completed `GGG-002` through PR #74. Exact tested head
  `40ddf4c462b42487e76300b6cbc80ca3f9bc8cd1` was squash-merged as
  `ed0ef8a940ab65f01c312be9cfbd75d94002a61d`; all PR and six main-push checks
  passed, the remote feature branch was deleted, and there was no cloud impact.
- 2026-08-13 — Assigned `GGG-002` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-001 completion ledger merged through PR #72 as
  `a9462b09bd3942391f8442b5168da078eda66332` with green main-push checks.
- 2026-08-13 — Completed `GGG-001` through PR #71. Exact tested head
  `4de5f069d068c7437e02817fdf31bafd067c18bf` was squash-merged as
  `35dbf8095c423a4ea28261952230135a42649402`; all PR and main-push checks passed,
  the remote feature branch was deleted, GGG-002 and GGG-004 were unblocked, and
  there was no cloud impact.
- 2026-08-13 — Assigned `GGG-001` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-006 ledger update merged through PR #69 as
  `40f604e14c15725375847ef6bda41c52dcdc9a4f` with green main-push checks.
- 2026-08-13 — Completed `GGG-006` through PR #68. Exact tested head
  `2878d80080bdd3d52d860f3f88b2b6de304eddc0` was squash-merged as
  `f9df8ab3f8f9387adeaa964d60a1bd04327647b8`; all PR and main-push checks passed,
  the remote feature branch was deleted, and there was no cloud impact.
- 2026-08-13 — Created the first repository-wide inventory from main
  `4155f806085ee09d743fa211656ae96e67fbfcb4`; preserved the existing
  `agent/cancel-active-qr-workout` work as `GGG-006`; recorded release-disabled,
  cloud-gated, deferred, and retired scope separately.

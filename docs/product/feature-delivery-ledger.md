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
- Latest merged repository delivery: `origin/main` at
  `685de9f8d8b70988d5216f99ec1954162ca13336` after PR #133 on 2026-08-22.
- Active feature task: none. Every non-deferred repository feature duty is
  terminal (`COMPLETE` or externally `BLOCKED`); no cloud/read-only reconciliation,
  deployment, provider, release or real-data task may start without new authority.
- Active feature limit: one implementation task at a time unless ownership and
  files are demonstrably disjoint.
- Local resource limit: validation commands run serially with reduced worker
  concurrency where supported. The coordinator must pause for user direction
  before any future Docker command; if resumed, no more than one Docker-backed
  task or stack may run at a time.
- Cloud boundary: repository and GitHub work are authorized. No AWS, Firebase,
  Cloudflare, staging, or production inspection, mutation, or deployment is
  authorized here. Staging-required product code is now repository-terminal, so
  GGG-030 may audit and improve offline infrastructure/release sources; any AWS
  read-only reconciliation still requires separate user authority and credentials.
- Discovery inputs: product, architecture, compliance, and operations documents;
  49 member routes; admin and landing surfaces; API controllers and services;
  worker behavior; 49 API forward migrations and 4 landing D1 migrations;
  generated OpenAPI/contracts; feature
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
- Current implementation / missing behavior: member verification requires a
  fresh foreground location sample within 30 seconds and 50 metres, exposes
  honest permission/unavailable/timeout/inaccurate/retry states, and treats local
  storage only as non-authoritative display recovery. A shared server predicate
  requires an approved, unexpired verification tied to the exact current,
  enabled, non-deleted policy version across discovery, enrollment, leaderboards,
  and streaks. Coordinates are not retained. Member and public waitlist intake
  records versioned consent, returns a generic minimized receipt, canonicalizes
  race-safe replay without regressing status, and participates in privacy export
  and deletion. Admin region/waitlist decisions are reachable, authorized,
  idempotent, bounded, and audited. Region configuration defaults disabled and
  canonical geometry provenance is machine-enforced. No known repository
  behavior remains missing for this technical duty.
- Required tests / operations / cloud dependency: boundary points, minimized
  evidence, pending fail-closed, age/jurisdiction matching, waitlist validation,
  reviewer audit; PostgreSQL/PostGIS and physical-device location.
- Delivery: priority `P0`; assigned task `GoGymGo Feature GGG-003 — Region
  eligibility and regional waitlist`; branch `agent/ggg-003-region-eligibility`
  (deleted after merge); PR `#77`; merge
  `7268a6bffb2fc06499f6585ffa8a43ca89764d0a`; status `COMPLETE`.
- Residual risks / blocker: legal/product approval of the exact enabled geography
  and regional-update retention policy, production PostGIS migration/digest
  reconciliation, and physical iOS/Android permission, accuracy, timeout,
  boundary, retry, and expiry UAT remain external release gates requiring
  separate deployment authority. No cloud access or deployment occurred.

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
- Current implementation / missing behavior: server-authoritative Contest time,
  status, and exact-contest count; immutable Weekly Goal and enrollment evidence;
  stable idempotent enroll/withdraw identity; irreversible audited withdrawal;
  transactional dependent cleanup; locked/idempotent under-minimum lifecycle
  cancellation; and fail-closed publication prerequisites are connected. Missing
  only authorized rollout, real-pilot configuration, and deployed-worker staging
  observation.
- Required tests / operations / cloud dependency: registration timing, cap,
  idempotency, immutable goal, one enrollment, withdrawal closing workouts and
  challenge eligibility, exact-contest count isolation, database integrity,
  rollback-safe worker activation/cancellation, admin preflight, and generated
  contracts passed locally and in CI. Production migration application and
  deployed-worker observation require separate deployment authorization.
- Delivery: priority `P0`; assigned task `GoGymGo Feature GGG-004 — Competition
  enrollment and withdrawal`; branch `agent/ggg-004-competition-enrollment`
  deleted; PR #80; exact tested head
  `bbaa881f2b1dfd458aa13a6e41da2f0725dd1081`; merge
  `b4e98a63933143b2a7eed70bab02c0aeb879c1d7`; status `COMPLETE`.
- Residual risks / blocker: migration application, real pilot legal/reward/
  region/gym approvals and schedule, deployed worker, and staging lifecycle
  observation remain external release gates. GGG-005, GGG-006, GGG-007, and
  GGG-010 retain their separately owned duties. No cloud access or deployment
  occurred.

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
- Current implementation / missing behavior: contest/gym/region-scoped QR
  issuance, recovery, secret-free history, expiry-aware poster rendering,
  revocation, audit/idempotency, exact fail-closed resolution, immutable
  enrollment gym/version evidence, and post-enrollment QR-secret removal are
  connected. Missing only real-gym configuration, physical poster/device UAT,
  final native identifiers/associations, and authorized deployment.
- Required tests / operations / cloud dependency: QR tamper/replay/expiry,
  contest and gym mismatch, scoped partner authorization, poster render, camera
  permissions, exact enrollment gym persistence, credential lifecycle migration,
  concurrency/idempotency, configuration drift, secret minimization, and
  production-artifact isolation passed locally and in CI. Real gym, signed
  devices, and poster placement remain external release requirements.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-005 — Partner gym QR
  enrollment`; branch `agent/ggg-005-partner-gym-qr-enrollment` deleted; PR #83;
  exact tested head `19e717719cdb9cfce6121545b140dca8f1a492a4`;
  merge `1b875c2e77c13a91f21390501f7669fef136b703`; status `COMPLETE`.
- Residual risks / blocker: verified real gym/name/coordinates, printed poster
  placement and revocation rehearsal, final Apple/Android identifiers and
  association/signing values, signed-device camera/App Link UAT, migration
  rollout, and deployment require separate authorization. GGG-028 owns final
  native identifiers/association publication. No cloud access or deployment
  occurred.

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
- Current implementation / missing behavior: server-authoritative contest-scoped
  verified-day scoring, weekly outcomes, Bonus Days, Perfect Month, category and
  tie ordering, privacy-limited standings, owner-scoped progress, transactional
  ledger reconciliation, immutable hash-audited settlement inputs, idempotent draw
  locking, and honest banked/projected states are connected. Missing only the
  external full-month staging rehearsal and separately owned final draw/results.
- Required tests / operations / cloud dependency: timezone/calendar edges,
  duplicate verified days, weekly multipliers, bonus/perfect month, goal category
  tie order, disallowed session/enrollment/gym states, reconciliation/backfill,
  retry/snapshot idempotency, public privacy, lifecycle transitions, member
  projections, and production artifacts passed locally and in CI. A deployed
  worker/full-month rehearsal requires separate deployment authority.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-007 — Competition scoring and
  rankings`; branch `agent/ggg-007-competition-scoring-rankings` deleted; PR #86;
  exact tested head `31b2f47d99a0f7e5a20177f902df26a59c0bac1a`;
  merge `1c6e73075993742666a15aaf8fe13514a742048b`; status `COMPLETE`.
- Residual risks / blocker: the full-month staging rehearsal remains external.
  GGG-008, GGG-010, GGG-015, and GGG-016 consume these outputs; equal-chance draw
  execution and final publication remain GGG-016 and must not be inferred
  client-side. No cloud access or deployment occurred.

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
- Current implementation / missing behavior: versioned `streaks-v1` daily,
  weekly, monthly, and yearly projections use exact authoritative active
  enrollment/Contest/gym/rules/region evidence; dates deduplicate and exclude
  future rows; timezone fallback is consistent; bounded SQL batching, privacy-
  safe public suppression, honest client states, and canonical maximum-two Alias
  rendering across every production/App Tour identity row are connected.
- Required tests / operations / cloud dependency: verified-only source, period
  boundaries, grace periods, timezone fallback, zero state, compact
  decomposition, future dates, privacy/ownership, 100-subject batching, every
  Alias surface, preview isolation, and production artifacts passed locally and
  in CI. Staging data/latency reconciliation requires deployment authority.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-008 — Streaks and Alias
  badges`; branch `agent/ggg-008-streaks-alias-badges` deleted; PR #89; exact
  tested head `8e2b6871d20bc0a1d88c18e5273bc8bc064a1f65`; merge
  `265a203e6c613d27d6811226d4eb784dd71b6595`; status `COMPLETE`.
- Residual risks / blocker: staging data/latency reconciliation and query-latency
  monitoring remain operational rollout steps requiring deployment authority.
  GGG-009, GGG-010, GGG-011, and GGG-016 consume the projection but retain their
  separately owned duties. No cloud access or deployment occurred.

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
- External providers / feature flag: no delivery provider is configured or
  claimed; member copy/system share is intentionally `link` / `not_sent`; no UI
  flag.
- Current implementation / missing behavior: normalized/reserved unique Alias,
  bounded private discovery, authoritative friendship transitions, durable
  bidirectional blocks, canonical pair serialization, downstream block
  precedence, masked/hash-only expiring single-use destination-bound invitation
  links, explicit redemption consent/auth recovery, privacy export/delete,
  redaction, retention cleanup, contracts, and operations documentation are
  connected. No repository behavior is missing for the provider-free duty.
- Required tests / operations / cloud dependency: Alias bounds, friendship and
  block ownership/state/concurrency, masked destination, token expiry/rotation/
  replay/destination binding, deep-link/auth recovery, retention, privacy
  export/delete, database triggers, journeys, contracts, and artifacts passed
  locally and in CI. Applying the migration and operating cleanup in an
  environment require separate deployment authorization.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-009 — Friends and private
  invitations`; branch `agent/ggg-009-friends-private-invitations` deleted; PR
  #92; exact tested head `c8d67539f745ed6b42b5400a066a4b25465fe523`;
  merge `4b7a8d6002b2ca26788f969beef18d6661631338`; status `COMPLETE`.
- Residual risks / blocker: migration application and cleanup-worker operation
  remain authorized rollout work. Phone redemption deliberately requires
  explicit destination confirmation because no verified-phone provider/claim
  was introduced. Product copy remains honest about link-only delivery. GGG-010
  and GGG-011 consume the completed friendship/block boundary.

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
- Current implementation / missing behavior: automatic stranger pairing and
  synthetic searching assignments are removed. Exact accepted/unblocked friend,
  active enrollment/Contest/region/week/server-time/Weekly Goal eligibility,
  explicit accept/decline/cancel, stable idempotency, accepted-request
  provenance, cross-role and permanent one-assignment constraints, privacy-safe
  partner aggregates, lifecycle closure, and authoritative 0x/1x/2x/3x settled
  scoring are connected. Projected values remain explicitly provisional; only
  settled ledger entries are banked. No repository duty remains missing.
- Required tests / operations / cloud dependency: exact eligibility, explicit
  response/cancel/retry, conflicting/concurrent acceptance, solo/searching/
  matched/settled states, privacy-safe partner detail, lifecycle closure,
  provenance/assignment database constraints, 0x/1x/2x/3x settlement,
  reconciliation, contracts, journeys, and artifacts passed locally and in CI.
  Migration rollout and the four-week/two-account staging rehearsal require
  separate deployment authority.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-010 — Direct Weekly
  Challenges`; branch `agent/ggg-010-direct-weekly-challenges` deleted; PR #94;
  exact tested head `548b0cdf6e63af839a1fa1ff5f03717965f3595f`; merge
  `11ca6a407c65e6e8fff7dc35685f3b3b74609db5`; status `COMPLETE`.
- Residual risks / blocker: applying the migration and completing the documented
  four-week/two-account staging rehearsal remain external release work requiring
  deployment authorization. No cloud access or deployment occurred.

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
- Current implementation / missing behavior: database-enforced provenance,
  lifecycle, timezone/date, capacity, membership/block, invitations, and
  local-day check-ins; current exact-region evidence; atomic provider-free
  contact links; verified-gym linkage; UUID-safe projections; privacy operations;
  honest member states; App Tour isolation; and direct accessibility/no-credit
  evidence are merged. Repository duty is complete; GGG-031 restored the only
  failed post-merge dependency gate on newer exact-green main.
- Required tests / operations / cloud dependency: migrated PostgreSQL journeys
  37/37, member tests 235/235, root checks, governance/dependencies, production/
  preview artifacts, direct browser semantics, contract/source/security audits,
  and all exact-head PR checks passed. The original merge had five of six green
  main workflows; the separate GGG-031 remediation then restored all six on main.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-011 — Social activity
  Challenges`; branch `agent/ggg-011-social-activity-challenges` deleted; PR #96;
  exact tested head `0e715771d62a046bf0f8ad0483ec3f79c2a2e626`; merge
  `b549ca292e8706985afdc11ee4a9ab6213be32a7`; status `COMPLETE`.
- Residual risks / blocker: migration/deployment and staging Challenge exercises
  still require separate deployment authority. The Expo metadata residual was
  resolved by GGG-031. No cloud access or deployment occurred.

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
- Current implementation / missing behavior: authoritative public/authenticated
  intake, explicit created/duplicate/screened receipts, idempotency, honeypot and
  validation controls, creator fail-closed gating, bounded retention/purge,
  versioned self-review-safe operator decisions and type-specific detail facts,
  privacy email linkage, strict client decoders and honest no-follow-up outcomes
  are repository-complete.
- Required tests / operations / cloud dependency: validation, spam field, rate
  limits, deduplication/idempotency, role decision, privacy retention/export,
  landing-to-API failure; deployed API/database.
- Delivery: priority `P2`; task `GoGymGo Feature GGG-014 — Partner intake and
  review`; branch `agent/ggg-014-partner-intake-review` (deleted after merge); PR
  `#131`; merge `5728dc3a9c632e7d9b467fd4e6fa4fe5b589c39b`; status
  `BLOCKED`.
- Residual risks / blocker: contractual/program approval remains a human process,
  not an application success state. Approved retention configuration, deployment,
  abuse monitoring and hosted end-to-end UAT require separate authority.

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
- Current implementation / missing behavior: the public/member catalog now
  enforces exact published competition, region-policy, deletion, and availability
  eligibility and returns truthful bounded inventory. Coupon inventory is NFKC-
  normalized, unique, transactionally uploaded only while draft, and encrypted
  under a strict canonical 32-byte AES-256-GCM key. Allocation, owner-only claim,
  retry, redemption, and admin lifecycle writes are versioned, reasoned,
  idempotent, audited, concurrency-safe, and constrained at the database. Member
  and admin projections are runtime-validated and redact private fulfillment
  evidence. No known repository behavior remains missing for this duty.
- Required tests / operations / cloud dependency: insufficient/duplicate codes,
  over-allocation, draw slot bounds, concurrent/idempotent claims, ownership,
  plaintext log/export exclusion, fulfillment transitions; secret manager,
  database, sponsor assets.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-015 — Brand Rewards and
  claims`; branch `agent/ggg-015-brand-rewards-claims` (deleted after merge);
  PR `#101`; merge `640d4abc756f775b9f405b48b5c5cf96084dc36c`;
  status `COMPLETE`.
- Residual risks / blocker: the production key, approved real sponsor inventory,
  assets and HTTPS terms, and separately authorized staging claim/fulfillment UAT
  remain external release gates and fail closed. Never publish placeholder
  inventory or expose coupon plaintext. No cloud access or deployment occurred.

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
- Current implementation / missing behavior: an exact admin-only, idempotent
  lock persists immutable scoring, entrant, reward-slot, and public-identity
  snapshots only after completion grace and reconciliation. Admin reviews the
  snapshot hashes/counts before revealing a canonical matching seed; settlement
  is deterministic, bounds-safe, transactional, retry/concurrency-safe, and
  creates only snapshot-bound GGG-015 awards. Participant/public results use
  immutable privacy-limited snapshots, and member/admin recovery states are
  authoritative and runtime-validated. No known repository behavior remains
  missing for this duty.
- Required tests / operations / cloud dependency: exact snapshot, one user/rank,
  deterministic reveal, interrupted resume, duplicate settle, pending visibility,
  Alias/badge privacy, reward linkage; database and operator browser storage.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-016 — Draw settlement and
  Winners Circle`; branch `agent/ggg-016-draw-settlement-winners` (deleted after
  merge); PR `#103`; merge `fef37d9a552ecb68b90b57d13f7b0082234172ae`;
  status `COMPLETE`.
- Residual risks / blocker: coordinated migration/runtime rollout, separately
  authorized full-month staging settlement, and independent retained-seed/audit
  recovery rehearsal remain operational release gates. No cloud access or
  deployment occurred.

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
- Current implementation / missing behavior: repository behavior is complete:
  canonical Alias/private-profile boundaries, fail-closed media capability,
  strict full-image validation, private version/ETag-bound storage actions,
  single-candidate replacement, versioned moderation, durable cleanup, privacy
  handling, and exact member/admin runtime contracts. Production storage remains
  deliberately disabled and unproven.
- Required tests / operations / cloud dependency: Alias validation/uniqueness,
  upload size/type/signature, pending/approve/reject/remove, ownership, cleanup,
  privacy deletion, local reset semantics; S3/CORS and worker.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-017 — Profile and moderated
  avatar`; branch `agent/ggg-017-profile-moderated-avatar` (deleted after merge);
  PR `#118`; merge `98bc63b04c40e92718af1f0772335150b4c078e6`;
  status `BLOCKED`.
- Residual risks / blocker: `PROFILE_MEDIA_ENABLED=false`; real S3/IAM/CORS/KMS/
  lifecycle and provider-health configuration, hosted upload validation, and
  physical-device release UAT require separate cloud/deployment authority. The
  repository fails closed until those external gates are satisfied.

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
- Current implementation / missing behavior: repository behavior is complete:
  explicit permission/provider/local schedule states, Contest-timezone scheduling,
  installation-scoped private registration/rotation/disable, replay authorization,
  sign-out/reset cleanup, deduplicated fenced delivery, bounded retry/backoff,
  partial-ticket handling, and operational stale-lease evidence. Provider delivery
  remains deliberately disabled and unproven.
- Required tests / operations / cloud dependency: permission states, register/
  disable coupling, token rotation, duplicate delivery, lease recovery, provider
  failure, background notifications; Expo/Firebase project and worker.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-018 — Competition reminders
  and push`; branch `agent/ggg-018-competition-reminders-push` (deleted after
  merge); PR `#120`; merge `6019ac5fddacec9ba4ee22f9a6bb037f9bf35d6d`;
  status `BLOCKED`.
- Residual risks / blocker: `PUSH_NOTIFICATIONS_ENABLED=false`; EAS/Firebase/Expo
  provider configuration and real-device permission, token, background delivery,
  retry and rotation UAT require separate cloud/deployment authority. No UI claims
  push delivery while the provider is disabled or unavailable.

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
- Current implementation / missing behavior: repository behavior is complete.
  Member requests require explicit operation-bound confirmation and expose owned,
  versioned status/event history; operator decisions are body-bound idempotent and
  optimistic-versioned; worker leases renew by token-bound compare-and-swap around
  every external boundary; export schema v12 is exhaustively mapped to the current
  database and excludes secrets/security hashes; deletion covers current private
  data while retaining only documented pseudonymous legal/contest integrity; and
  local reset removes only GoGymGo-owned namespaces. Production keys, private
  bucket lifecycle, deployed worker/provider cleanup, reconciliation and restore/
  incident rehearsal remain unconfigured and unproven.
- Required tests / operations / cloud dependency: ownership, confirmation,
  retry/lease recovery, export completeness and minimization, deletion graph,
  retained integrity, object purge, short-lived URL, local-only reset; S3,
  database, worker, secrets.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-019 — Privacy operations and
  local reset`; branch `agent/ggg-019-privacy-operations-local-reset` (deleted
  after merge); PR `#112`; merge
  `b1b3e7b741467ae7eb16e60f269ca9a2fe8d4068`; status `BLOCKED`.
- Residual risks / blocker: `PRIVACY_OPERATIONS_ENABLED` remains false. No
  production AWS/Firebase configuration or credentials were accessed; private
  bucket lifecycle/purge, deployed worker processing, external object/identity
  cleanup and reconciliation, restore/incident rehearsal, signing/app IDs,
  API/legal URLs, Firebase public configuration, and EAS project/owner remain
  external release gates. The repository and CI are green, but the production
  privacy path must not be represented as live.

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
- Current implementation / missing behavior: invitation-only password operator
  entry, bounded identity restoration, authoritative access routing, forced-token
  retry, and honest denied/expired/retry states are implemented. Firebase role
  claims are discarded; revoked-token-aware password identity plus active
  database roles, non-conflicting exact-gym assignments, and active gym state are
  authoritative. The proxy strictly bounds operator paths, methods, upstreams,
  headers, queries, JSON bodies, and failure disclosure. Owner bootstrap and
  assignment/revocation tooling validates provider, identity, role, gym, and
  assignment conflicts and remains locked, idempotent, reasoned, and audited.
  No known repository behavior remains missing for this duty.
- Required tests / operations / cloud dependency: provider restriction, member
  denial, role/scope matrix, cross-gym denial, proxy allowlist, bootstrap/
  assignment audit, revocation; Firebase, database, Cloudflare Access.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-020 — Role-scoped admin
  access`; branch `agent/ggg-020-role-scoped-admin-access` (deleted after merge);
  PR `#99`; merge `6eb0dc667c0c1489f2cba18125367eae3074352c`;
  status `COMPLETE`.
- Residual risks / blocker: hosted Firebase email/password and authorized-domain
  configuration, Cloudflare Access policy, and hydrated environment UAT require
  separate credentials/deployment authority. Delegation remains deliberately
  owner-operated and fail-closed; no unapproved dual-approval flow was invented.
  Four current Dependabot alerts map exactly to the documented temporary
  exceptions expiring 2026-09-08. No cloud access or deployment occurred.

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
- Current implementation / missing behavior: every production configuration
  panel is reachable, including first-gym creation, and consumes authoritative
  runtime-validated reads/mutations. Contest publication uses a server preflight;
  region/gym/legal lifecycles use database versions and body-bound idempotency;
  gym activation/deletion enforces dependencies and QR cleanup; immutable legal
  documents use append-only versioned owner-gated events; Creator capability is
  server-owned; and minimized audit projections preserve real before/after
  evidence. Honest loading/error/conflict/disabled states and regenerated
  contracts cover the full mutation surface. No known repository behavior
  remains missing for this duty.
- Required tests / operations / cloud dependency: validation, exact publication
  prerequisites, version/body mismatch, rollback, deletion/dependency policy,
  role/scope denial, minimized audit before/after, creator gating and rendered
  reachability; full migrated PostGIS suite and release-environment worker/UAT.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-021 — Administrative
  configuration`; branch `agent/ggg-021-administrative-configuration` (deleted
  after merge); PR `#110`; merge
  `197c6ea489215a6746123a857882df85b485e906`; status `COMPLETE`.
- Residual risks / blocker: migration/runtime rollout, real owner-approved legal,
  reward, region and gym assets/configuration, provider approvals, intentional
  flag enablement and staging operator/worker rehearsal remain external release
  gates. Nothing was invented, enabled, deployed or accessed in cloud.

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
- Current implementation / missing behavior: repository behavior is complete.
  One stable globally paginated queue, minimized detail contract, and
  server-declared decision surface cover Creator submissions, partner
  applications, privacy requests, profile media, region verification, region
  waitlist, and workout sessions. Decisions reauthorize database roles on replay,
  deny self-review, enforce valid transitions and optimistic versions, and bind
  idempotency to the full body. Audit search is bounded, cursor-paginated and
  recursively redacted. Worker/database/queue/lease/provider health is durable
  and honest without probing disabled providers, and the admin client validates
  every response/action fail closed. Deployed alert ownership/destinations and
  production rehearsal remain external.
- Required tests / operations / cloud dependency: stale/degraded worker, queue
  counts, lease recovery, every decision authorization/state conflict, audit
  search/redaction, OTLP failure safety; deployed worker/monitoring.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-022 — Review queues and
  operational health`; branch `agent/ggg-022-review-queues-operational-health`
  (deleted after merge); PR `#114`; merge
  `263ca6e45beb3e688d0ac9a12c2d03aa120a78b9`; status `COMPLETE`.
- Residual risks / blocker: observability is measurable in code but production
  alerts, provider credentials/configuration, alert ownership/destinations and
  staging operational UAT cannot be verified without authorized environment
  access. No production health claim or external probe was invented.

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
- Current implementation / missing behavior: repository behavior is complete.
  Password-verified database roles and active exact-gym assignments are
  authoritative; partner admin writes and staff reads are strictly separated;
  visits are cursor-paginated aggregate counts with no member/session/date/location
  detail; proposals retain immutable gym/proposer provenance through versioned
  draft/submitted/withdrawn/archived states and only submitted proposals may be
  published by a platform admin. Partner QR issue/recovery requires a published
  proposal while platform pre-publication capability remains separate; replay
  reauthorizes current scope/version, and idempotency/audit/history never duplicate
  QR payload/SVG. Gym closure reconciles assignments/roles and clears active QR
  payloads. Admin clients validate all minimized responses fail closed.
- Required tests / operations / cloud dependency: access-level matrix, assignment
  revoke, cross-gym denial, draft ownership/state, poster issue/revoke, visit
  privacy, admin publication; Firebase/database/Cloudflare Access.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-023 — Gym partner portal`;
  branch `agent/ggg-023-gym-partner-portal` (deleted after merge); PR `#116`;
  merge `d845263734b41b9b8a9c0f5d254c569d1c6d7802`; status `COMPLETE`.
- Residual risks / blocker: real Firebase/Cloudflare identity infrastructure,
  hosted real-partner login/revocation and cross-gym UAT, plus physical poster/
  print/device validation remain external release gates. Operator credential
  issuance remains controlled and must not become public signup.

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
- Current implementation / missing behavior: the exact September pilot policy
  now binds one published GoGymGo-sponsored 10000-cent CAD manual-only reward to
  the approved competition, assets, terms, draw reward slot, settled award, and
  immutable public snapshot. Database constraints preserve the live sole reward
  and its amount/currency and enforce one append-only handoff linked to the exact
  winner/slot. The admin route reauthorizes the database admin on every replay,
  uses body-bound idempotency and optimistic award versioning, and atomically
  records the handoff, award transition, and minimized audit; generic cash
  fulfillment is rejected. Member/admin projections are authoritative and
  privacy-limited, landing copy fails closed until availability is proven, and
  no payment, wallet, bank, payee, tax, transfer, webhook, or provider boundary
  exists. No known repository behavior remains missing for this duty.
- Required tests / operations / cloud dependency: exact pilot/reward/snapshot/
  winner linkage, amount/currency, admin denial, version conflict, stable retry,
  concurrency, rollback, append-only audit, privacy export, copy/source/provider
  boundaries, and full migrated PostgreSQL suite; real approved reward assets,
  legal/financial approval, and staging database rehearsal remain external.
- Delivery: priority `P0`; task `GoGymGo Feature GGG-024 — September pilot cash
  reward`; branch `agent/ggg-024-pilot-cash-fulfillment` (deleted after merge);
  PR `#105`; merge `5886931dea855f4a60ddbac94d0c2d38e18ba9d6`;
  status `COMPLETE`.
- Residual risks / blocker: final legal/financial approval, approved public
  assets/terms and real reward configuration, plus a separately authorized
  staging settlement and in-person handoff rehearsal remain release gates. The
  repository stays fail closed meanwhile; no cloud or money movement occurred.

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
- Current implementation / missing behavior: repository behavior is complete:
  release-authoritative fail-closed claims, allowlisted configured origins,
  canonical join/demo/legal/partner navigation, current product captures,
  isolated fake-only demo, metadata/robots/sitemap/headers, responsive keyboard
  states, custom not-found handling, and production/preview artifact isolation.
  Final hosted-domain and released-capability proof remains external.
- Required tests / operations / cloud dependency: canonical links, demo isolation,
  no misleading registration/reward claims, SEO/robots/sitemap, responsive and
  keyboard behavior, production artifact audit; Sites/Firebase hosting domains.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-025 — Public conversion
  journeys`; branch `agent/ggg-025-public-conversion-journeys` (deleted after
  merge); PR `#122`; merge `382a8d951ece5d61af63b8541afedf83bd5ea4a7`;
  status `BLOCKED`.
- Residual risks / blocker: final hosting/TLS mappings, released member-web
  dependencies, approved live legal/reward publication, and hosted crawl/link/
  accessibility UAT require separate deployment/provider authority. Landing claims
  remain fail closed and must continue to track release capability exactly.

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
- Current implementation / missing behavior: repository behavior is complete:
  strict same-origin bounded requests, exact event allowlist/canonical mapping,
  optional minimized contact, replay-safe feedback, aggregate non-identifying rate
  buckets, bounded cleanup/retention, exact owner authorization, paginated minimized
  exports and privacy-safe audit evidence. Production D1 operations remain disabled
  and unproven.
- Required tests / operations / cloud dependency: event allowlist/no PII,
  validation/spam/rate limits, owner denial, disabled export, retention/deletion,
  analytics failure isolation; Cloudflare D1/Sites.
- Delivery: priority `P2`; task `GoGymGo Feature GGG-026 — Public feedback and
  measurement`; branch `agent/ggg-026-public-feedback-measurement` (deleted after
  merge); PR `#124`; merge `605c35274a377c54a6240a53f13cbe247501751c`;
  status `BLOCKED`.
- Residual risks / blocker: D1 migration/binding, approved retention values, hosted
  abuse controls, exact-owner credentials/export rehearsal, deployment and hosted
  UAT require separate Cloudflare/provider authority. No cloud inspection, export
  or real data access occurred.

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
- Current implementation / missing behavior: fail-closed API-only forwarding,
  frozen owner export, strict offline artifact validation, deterministic
  transactional import/reconciliation, provenance, privacy, retention, admin
  visibility, and the cutover runbook are repository-complete. Historical export,
  production import/count/hash verification, deployment cutover, D1 removal, and
  rollback rehearsal are not evidenced.
- Required tests / operations / cloud dependency: read-only export, owner gate,
  idempotent import, duplicate mapping, count/hash verification, rollback, export
  disablement; Cloudflare and database access.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-027 — Landing data cutover`;
  branch `agent/ggg-027-landing-data-cutover` (deleted after merge); PR `#126`;
  merge `5ab7216fe43d92db07b34d74f8d55dfb6341165a`; status `BLOCKED`.
- Residual risks / blocker: real exact-owner D1 export, production PostgreSQL
  import count/hash/rerun verification, deployment cutover, binding removal, and
  rollback rehearsal require separate cloud/data authority and must not be
  attempted from a normal feature task.

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
- Current implementation / missing behavior: exact browser/native release modes,
  fail-closed identifier policy, association generation/audits, artifact
  attestation, exact CloudFront well-known handling, atomic publish/rollback, and
  strict QR/native-link parsing are repository-complete. Native release lacks
  final bundle/package/team/signing IDs, EAS project, store URLs, provider release
  configuration, and physical app-link validation.
- Required tests / operations / cloud dependency: source authorization, exact
  export audit, demo exclusion, association generation, signed iOS/Android link
  test, rollback; Firebase/EAS/Apple/Google and domains.
- Delivery: priority `P1`; task `GoGymGo Feature GGG-028 — Member release and
  native links`; branches deleted after merge; PRs `#128` and `#129`; latest merge
  `6c7d7d63cc8c1689b2150edf0a54b2e67e82a4e8`; status `BLOCKED`.
- Residual risks / blocker: authoritative Apple Team/bundle IDs, Android package/
  signing fingerprints, EAS owner/project, store URLs, Firebase release config,
  explicit approval, deployment/DNS, signed builds, store submission, and
  physical-device UAT require separate authority; placeholder values are
  forbidden.

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
- Current implementation / missing behavior: exact-source authorization, isolated
  API/worker/migration execution roles and secrets, versioned private storage,
  bounded Fargate/worker configuration, fail-closed runtime inputs, alarm/budget
  destinations, serialized deployment with complete rollback baselines, backend-
  disabled Terraform policies/tests, and release/restore/rotation/incident runbooks
  are repository-complete. The authorized 2026-08-22 reconciliation verified
  the dedicated staging account, healthy older runtime, active RDS backups/PITR,
  and current credit application. It also found high-risk private-bucket
  versioning, runtime secret-isolation, alarm-routing, and deployed-source-age
  gaps. The approved Phase 1 follow-up verified bucket encryption/lifecycle,
  the deployed image's historical push scan, empty Parameter Store/SNS
  inventories, and the absence of an Access Analyzer. Exact Terraform drift,
  AWS Backup metadata blocked by an organization SCP, deployment, recovery
  rehearsal, and authenticated UAT remain open; see the
  [AWS staging reconciliation](../operations/aws-staging-reconciliation-2026-08-22.md).
- Required tests / operations / cloud dependency: offline Terraform validation/
  tests, image/security audit, migration idempotency, rollout/rollback, backup/
  restore, health/alerts; AWS cloud dependency is total.
- Delivery: priority `P0` after product code; repository task `GoGymGo Feature
  GGG-030 — AWS platform repository readiness`; branch
  `agent/ggg-030-aws-foundation-readiness` (deleted after merge); PR `#133`; merge
  `685de9f8d8b70988d5216f99ec1954162ca13336`; status `BLOCKED`. A later
  `GoGymGo — AWS Staging Read-Only Reconciliation` task may be created only with
  separate cloud authority at the prescribed gate.
- AWS reconciliation: completed under explicit read-only authority on
  2026-08-22. Account isolation, live public health, current cost/credit
  application, certificates, automated backups/PITR eligibility, and selected
  security controls are now evidenced. The approved Phase 1 follow-up also
  closed narrow S3, SSM, ECR, SNS, and Access Analyzer metadata gaps. An approved
  protected Terraform-plan attempt initialized the exact staging backend from an
  isolated copy but stopped safely before producing a plan when refresh required
  two unapproved tag metadata reads and one deployed CloudFront Function code
  read. An exactly approved retry scoped those reads to the three staging
  resources and completed with exit code 2, confirming drift. Its post-plan JSON
  sanitizer failed, so the unsanitized plan was deleted and exact resource
  actions were not inferred. An exactly approved streaming-JSON retry then
  retained 48 resource address/action events. Twenty-two S3 mutations are
  invalid artifacts because the restricted role cannot run `HeadBucket` on the
  three live application buckets; 19 non-S3 mutation events and 7 data reads
  remain. All attempts' role, lock, state, and temporary-file rollback checks
  passed. Overall status remains BLOCKED because a corrected exact plan, current
  deployment, and material gaps remain.
- Residual risks / blocker: exact Terraform drift, private-bucket versioning and
  lifecycle drift, runtime secret scope, absent alarm/SNS delivery, Backup
  inventory blocked by an organization SCP, restore readiness, current credit
  balance, provider integrations, protected deployment approval, and
  authenticated staging UAT remain unresolved. Deployment requires further
  explicit authority.

### GGG-031 — Expo SDK patch compatibility and deterministic release checks

- Intended user / duty / owning runtime: member release engineer; keep the
  declared Expo SDK 57 package set aligned with Expo's supported patch metadata
  so an unchanged exact-green member release remains reproducibly installable
  and auditable; member app dependency/tooling boundary.
- Surfaces: no new product UI; member iOS, Android, web, and browser-preview
  artifacts must remain behaviorally unchanged.
- API and worker support / persistence: none; no database change.
- Authentication and authorization: unchanged; dependency updates must not
  weaken Firebase, API route, deep-link, permission, or demo-isolation controls.
- External providers / feature flag: npm/Expo compatibility metadata; existing
  locked dependencies only; no feature flag.
- Current implementation / missing behavior: the current SDK 57 patch set is
  aligned through supported Expo tooling. Required PR/main CI now runs the
  strict locked compatibility check with `EXPO_OFFLINE=1`, binding it to the
  installed Expo SDK metadata and exact lock while still rejecting tampered
  packages. A separate weekly/manual online advisory fails visibly when Expo
  recommends newer compatible patches and never mutates dependencies. Unchanged
  locked releases are deterministic and no repository duty remains missing.
- Required tests / operations / cloud dependency: exact declared package/lockfile
  alignment, dependency/governance audit, member type/lint/tests, Expo install
  check, iOS/Android/web exports, production/preview bundle and source audits,
  full repository check, exact-head PR and restored main-push checks. No cloud
  dependency.
- Delivery: priority `P0` CI restoration; task `GoGymGo Feature GGG-031 — Expo
  SDK patch compatibility`; latest branch
  `agent/ggg-031-expo-sdk-deterministic-check-3` (deleted after merge); PR #109;
  exact tested head `110bd70ba3ee7a5d8ed005e17a37bb498b644040`;
  merge `b81b4326ef550b7e87a4cd5e24968828e78f7463`; status `COMPLETE`.
- Residual risks / blocker: Expo compatibility metadata can advance again; the
  deterministic CI gate must remain enabled. This task did not migrate SDK
  major/minor versions or alter permissions, plugins, native identifiers, source,
  runtime configuration, or GGG-028 scope.

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

- 2026-08-22 — Completed the explicitly authorized, non-root
  [AWS staging read-only reconciliation](../operations/aws-staging-reconciliation-2026-08-22.md).
  Verified the dedicated staging account ending 9877 in Canada Central, a
  healthy but 78-commit-old runtime, current AWS credit application, and active
  RDS backup/PITR configuration. Recorded release-blocking versioning,
  secret-scope, alarm-routing, source-age, permission, and recovery gaps. A
  separately approved metadata-policy revision verified bucket encryption and
  lifecycle, the deployed image's historical push scan, empty SSM/SNS
  inventories, and an organization SCP blocking AWS Backup inspection. A later
  approved protected-plan attempt initialized the exact backend and invoked one
  no-apply plan, but refresh stopped before producing a plan because
  budgets:ListTagsForResource, cloudfront:GetFunction, and
  ecr:ListTagsForResource were not allowed. An exactly approved retry scoped
  those reads to the staging resources and completed with exit code 2, proving
  changes are present. Its post-plan JSON sanitizer failed, so the unsanitized
  plan was deleted and no resource-action list was retained. The Phase 1 role
  was restored, no lock remained, state ETag and time were unchanged, and
  temporary files were deleted. No apply, application-resource mutation,
  deployment, secret or application-object/log data read, database connection,
  or restore occurred. A third exactly approved streaming-JSON plan retained
  only resource addresses and actions. It showed 9 creates, 2 deletes, 22
  replacements, 8 updates and 7 reads, but direct authorization checks proved
  the 3 bucket creates and 19 dependent S3 replacements are false artifacts of
  denied `HeadBucket`. Correct S3 refresh now requires separate approval for
  temporary `s3:ListBucket` on only those three application buckets; that action
  can reveal object key names even though all object content reads remain
  denied.

- 2026-08-22 — Completed the repository delivery for `GGG-030` through PR #133.
  Exact head `c3574e59b7a6147b8771524860351062dccdfa7f` was
  guarded-squash merged as `685de9f8d8b70988d5216f99ec1954162ca13336`;
  all required PR checks and all six exact-main workflows passed, the merged
  release-authorization helper independently passed against PR #133 and exact
  main, and the feature branches were deleted. Delivery hardened exact-source
  authorization, split API/worker/migration execution roles and secret scopes,
  made reward and landing secrets runtime-specific, enabled version-aware private
  storage cleanup, bounded Fargate and singleton-worker configuration, required
  production alarm/budget destinations, serialized releases, and restored complete
  prior API/worker baselines for preparation, update, stabilization and readiness
  failures. It also added backend-disabled Terraform policy tests and explicit AWS
  release, restore, secret-rotation, capacity, incident and recovery evidence
  runbooks. Proof included 420 API unit tests, 31 E2E tests, environment 23/23,
  governance 35 passed with one Windows symlink-permission skip, architecture 8/8,
  dependency/contract/source/artifact gates, and checksum-verified Terraform 1.15.8
  formatting, validation and 4/4 mock tests with backend disabled, metadata access
  disabled and provider 6.57.1 pinned. No local Docker, AWS account/provider/
  credential/state/cost query, database, DNS, deployment or real-data action
  occurred. Status remains `BLOCKED` pending separately authorized AWS read-only
  reconciliation and all deployed backup/alarm/integration/release/UAT evidence.
  This closes the implementation queue: every non-deferred repository feature is
  now `COMPLETE` or externally `BLOCKED`; no new task is assigned without new
  evidence or user authority.
- 2026-08-22 — Completed the repository delivery for `GGG-014` through PR #131.
  Corrected exact head `1f4c7d1066f91dc91285518e02feac14a54c20c5`
  was guarded-squash merged as
  `5728dc3a9c632e7d9b467fd4e6fa4fe5b589c39b`; all seven PR checks and all six
  exact-main workflows passed and both feature branches were deleted. Delivery
  removed fabricated offline member successes and landing follow-up promises,
  added strict authoritative receipts, public idempotency and honeypot/consent
  validation, direct API creator-flag enforcement, approved bounded retention and
  purge, minimized summaries with type-specific review facts, versioned/self-review-
  safe decisions, anonymous-email privacy linkage, runtime client decoders, Profile
  reachability and honest fail-closed UI states. Proof included 416 API unit tests,
  31 E2E tests, 273 member tests, 46 admin tests, 35 landing tests, contracts/
  governance/dependency/source/artifact/browser gates, and an authorized disposable
  PostGIS suite passing 4/4. The first CI head exposed only two stale privacy export
  schema-version assertions; the corrected head passed the full CI integration
  inventory. No cloud/provider/credential/deploy action occurred. Status remains
  `BLOCKED` pending program/contract approval, production retention configuration,
  deployment, abuse monitoring and hosted UAT. Windows path-length handling left
  one unregistered partial worktree directory after branch/worktree cleanup; it has
  no Git registration or branch and was intentionally left untouched rather than
  risk broad deletion. With every staging-required product feature now repository-
  terminal, dependency ordering assigns `GGG-030` for offline AWS foundation and
  release-source readiness only; AWS inspection/reconciliation remains prohibited
  without separate authorization.
- 2026-08-21 — Completed the repository delivery for `GGG-028` through PRs #128
  and #129. Exact corrected feature head
  `7b16a9cdf4d9b208b82a02f5206c8a6789a1c5b5` was guarded-squash merged as
  `071a9e412ad6e1cfe136b519daf3ebeb4af59a93`; a main-push workflow-validation
  failure then exposed an invalid job-level `runner.temp` context before any job
  or deployment ran. The narrow exact head
  `6a39e4e67854a271dac43fbab1cbd6196707de56` moved that reference into runner
  steps and was guarded-squash merged as
  `6c7d7d63cc8c1689b2150edf0a54b2e67e82a4e8`. Both PRs and all applicable
  exact-main workflows passed; branches were deleted. Delivery added exact release
  modes and source policy, fail-closed native identifiers, association generation/
  audits, strict canonical QR and `/scan` parsing, deterministic artifact
  attestation, CloudFront well-known bypass, assets-first/index-last publication
  with verification/restoration, and honest browser-only copy. Proof included the
  full repository check (member 270, API 408 unit plus 29 E2E, admin 44, landing
  34), release/governance/dependency/source/artifact audits, a deterministic 26-file
  browser artifact digest, and direct browser validation of welcome/demo/malformed
  and canonical QR states. Database suites were correctly skipped because no data
  path changed; no local Docker, cloud/provider/credential/deploy/native/signing/
  store/DNS action occurred. Status remains `BLOCKED` pending authoritative native
  IDs/configuration, explicit release approval, signed builds, provider deployment,
  store submission, and physical-device UAT. Before any AWS reconciliation, the
  coordinator returns to non-terminal `GGG-014` for its distinct end-to-end partner
  intake/review verification; this may reuse later foundations but must not be
  declared complete by inference.
- 2026-08-21 — Completed the repository delivery for `GGG-027` through PR #126.
  Corrected exact head `2fc7610cc01e2543247d413ecf48f603ac7e15d9` was
  squash-merged with an exact-head guard as
  `5ab7216fe43d92db07b34d74f8d55dfb6341165a`; all seven PR checks and all six
  exact-main workflows passed, the reviewed and merged trees matched exactly, and
  the feature branch was deleted. Delivery replaced landing D1 writes with strict
  fail-closed API-only forwarding, added authenticated idempotent PostgreSQL
  intake with provenance and expiry, frozen exact-owner paginated D1 export,
  strict offline page-chain/count/digest validation, deterministic serializable
  import with duplicate mapping and rerun reconciliation, privacy deletion/export,
  bounded retention, minimized admin evidence, and the cutover/rollback runbook.
  Proof included 408 API unit tests, 29 E2E tests, 34 landing tests, 43 admin tests,
  governance/contracts/source/artifact gates, and an authorized disposable
  PostGIS suite passing 4/4; exact-head CI then passed all 12 integration suites.
  The first CI head exposed only two stale privacy schema-version assertions,
  which were corrected and fully reproved. No cloud/provider/credential/real-data/
  deploy action occurred. Status remains `BLOCKED` pending separately authorized
  real D1 export, production import count/hash/rerun verification, deployment
  cutover, binding removal, and rollback rehearsal. Dependency ordering assigns
  `GGG-028` next for repository release and native-link readiness only; no hosting,
  store, signing, Firebase, EAS, domain, or provider action is authorized.
- 2026-08-21 — Completed the repository delivery for `GGG-026` through PR #124.
  Exact tested head `51e3de9f00be5304ffcbc700544b9e41595f36b8` was
  squash-merged as `605c35274a377c54a6240a53f13cbe247501751c`; all PR
  checks and applicable exact-main workflows passed and the feature branch was
  deleted. Delivery added strict same-origin/content/size/exact-key requests,
  canonical name-only event mapping, optional minimized contact, UUID replay safety,
  aggregate no-IP/no-cookie/no-UA rate buckets, bounded retention cleanup, exact
  owner authorization, paginated minimized export, audit evidence and a forward D1
  migration. Proof included landing 29/29, direct unavailable-D1/retry/accessibility/
  navigation browser checks, build/artifact audit, and governance/dependency/
  contract/source/scope/secret/diff gates. The installed Miniflare alpha could not
  provide reliable in-memory D1 proof and that limitation is documented rather than
  hidden. No cloud/provider/credential/real-data/Docker/PostgreSQL/deploy action
  occurred. Status remains `BLOCKED` pending real D1 migration/binding, approved
  retention, hosted abuse controls, owner credential/export rehearsal, deployment
  and hosted UAT. Dependency ordering assigns `GGG-027` next for repository audit
  and fail-closed cutover readiness only; actual historical export/import remains
  prohibited without separate cloud/data authority.
- 2026-08-21 — Completed the repository delivery for `GGG-025` through PR #122.
  Exact tested head `4db9f3260a46cc26738c519f5c2e10eacc38db24` was
  squash-merged as `382a8d951ece5d61af63b8541afedf83bd5ea4a7`; all seven
  PR checks and all applicable exact-main workflows passed and the feature branch/
  worktree were deleted. Delivery removed calendar-inferred registration claims,
  enforced allowlisted configured origins, replaced retired/fake product captures,
  kept join and fake-only demo boundaries canonical, and hardened public copy,
  partner presets, accessibility/responsive states, metadata, robots/sitemap,
  headers, not-found behavior and production/preview artifact isolation. Proof
  included landing 18/18, member 268/268, production and preview exports/audits,
  direct 430x900 and 1440x900 keyboard/browser QA, plus governance/contracts/
  dependency/source/security/secret/diff gates. No API/schema/persistence changed,
  so Docker/database proof was neither relevant nor run. No cloud/provider/deploy
  action occurred. Status remains `BLOCKED` pending final hosting/TLS, released
  member-web dependencies, approved live legal/reward publication and hosted crawl/
  link/accessibility UAT. Dependency ordering assigns `GGG-026` next because its
  public feedback and measurement duty consumes the now-truthful conversion routes
  without broadening the member or demo systems.
- 2026-08-21 — Completed the repository delivery for `GGG-018` through PR #120.
  Exact tested head `4b7af48c5db40723ac56ad7548f2b1ed71e7de35` was
  squash-merged as `6019ac5fddacec9ba4ee22f9a6bb037f9bf35d6d`; all PR
  checks and all six exact-main workflows passed and the feature branch was
  deleted. Delivery added explicit permission/provider/local schedule states,
  Contest-timezone/DST scheduling, installation-scoped owner-only registration,
  rotation and disable with replay reauthorization, sign-out/reset cleanup,
  private token handling, deduplicated fenced delivery, partial-ticket progress,
  bounded backoff/exhaustion, stale-lease health, migration, contracts, member/
  admin UI and runbooks. Serial proof included 398 API unit tests, 28 API E2E
  tests, 76 PostGIS integration tests, 268 member tests, 43 admin tests, all-platform
  Expo and production-image/runtime checks, plus governance/dependency/source/
  build/artifact/secret gates. No provider, cloud, credential or deployment action
  occurred. Status remains `BLOCKED` because push is disabled and real EAS/
  Firebase/Expo configuration plus physical-device permission/token/background/
  delivery/retry UAT are external. The exact local API image tag was retained after
  three unrelated old stopped PostGIS containers made the conditional cleanup
  authorization inapplicable; those containers were untouched. Dependency ordering
  assigns `GGG-025` next because the public conversion duty can now consume the
  completed landing, demo, legal, reward and member-application boundaries.
- 2026-08-21 — Completed the repository delivery for `GGG-017` through PR #118.
  Exact tested head `3bd0cfb699ff8487473782246b5023ce6e682076` was
  squash-merged as `98bc63b04c40e92718af1f0772335150b4c078e6`; all PR
  checks and all six exact-main workflows passed, the feature branch was deleted,
  and Docker returned exactly to its original stopped-container baseline with zero
  running containers. Delivery added canonical Alias/private-profile controls,
  fail-closed moderated-avatar capability, strict bounded container/full-raster/
  dimension/digest validation, version/ETag-bound private storage and replacement,
  stale/self-review/idempotency protections, durable cleanup, privacy handling,
  exact member/admin runtime decoders, honest accessible UI states, migration,
  contracts and runbooks. Serial proof included 386 API unit tests, 28 API E2E
  tests, 74 PostGIS integration tests, 259 member tests, 43 admin tests, direct
  browser inspection, and all governance/dependency/source/build/artifact/secret
  gates. No cloud access or deployment occurred. Status remains `BLOCKED` because
  `PROFILE_MEDIA_ENABLED=false` and real S3/IAM/CORS/KMS/lifecycle/provider setup,
  hosted-upload validation and device release UAT are external. Dependency ordering
  assigns `GGG-018` next because reminder controls consume the completed Profile,
  privacy and operational-health boundaries.
- 2026-08-21 — Completed `GGG-023` through PR #116. Exact tested head
  `838a45a4db2dcdc1d43405e56711c3a46a19ffb4` was squash-merged as
  `d845263734b41b9b8a9c0f5d254c569d1c6d7802`; all seven PR checks and all six
  exact-main workflows passed, the feature branch was deleted, and current-session
  Testcontainers resources cleaned fully. Delivery added authoritative active
  assignment/role/gym gates, staff-read/admin-write separation, aggregate-only
  paginated visits, immutable versioned proposal provenance/lifecycle with
  submitted-only platform publication, published-only partner poster eligibility,
  versioned replay-reauthorized QR operations without secret duplication, gym
  relationship closure, strict admin runtime contracts and minimized privacy
  export. Serial proof included 374 API unit tests, 28 API E2E tests, 253 member
  tests, 43 admin tests, 15 landing tests, focused API 50/50, focused PostGIS
  30/30 and full integration 74/74, plus all repository/governance/dependency/
  contracts/source/build/artifact/secret gates. No cloud access or deployment.
  Real identity infrastructure, partner/browser UAT and physical poster/device
  validation remain external. Dependency ordering assigns `GGG-017` next because
  its moderated profile-media flow now consumes the completed review, privacy and
  operational-health boundaries.
- 2026-08-21 — Completed `GGG-022` through PR #114. Exact tested head
  `2b99a1d40883322e56cb0d1ee4e18e379867f4a8` was squash-merged as
  `263ca6e45beb3e688d0ac9a12c2d03aa120a78b9`; all seven PR checks and all six
  exact-main workflows passed, the remote branch was deleted, and Docker cleaned
  to zero running containers. Delivery added a globally paginated seven-domain
  review queue, minimized details and server-declared decisions; body-bound
  idempotency, replay reauthorization, self-review denial and optimistic versions;
  bounded recursively redacted audit search; durable cleanup leases/fencing; and
  truthful database/worker/queue/lease/provider health with fail-closed admin
  contracts. Serial proof included 374 API unit tests, 28 API E2E tests, 253
  member tests, 41 admin tests, 15 landing tests, focused regressions 59/59,
  full PostGIS integration 74/74 and database journeys 38/38, plus all contracts,
  governance, dependency, source, build, artifact, diff and secret gates. No
  cloud access or deployment occurred. External alert destinations/ownership,
  provider configuration and production operational rehearsal remain release
  gates. Dependency ordering assigns `GGG-023` next because the partner portal
  consumes the completed role-scoped admin, gym/QR configuration, review and
  audit boundaries.
- 2026-08-20 — Merged the complete repository implementation for `GGG-019`
  through PR #112. Exact tested head
  `f2d6402dcacc32358f2f072c65881a23659a03de` was squash-merged as
  `b1b3e7b741467ae7eb16e60f269ca9a2fe8d4068`; all seven PR checks passed,
  the feature branches were deleted, and Docker cleaned to zero running
  containers. Delivery added explicit confirmed member requests, owned
  versioned status/events, body-bound idempotent/versioned operator decisions,
  renewable token-bound worker leases, exhaustive minimized export schema v12,
  a current-schema deletion graph with documented pseudonymous integrity
  retention, and namespace-only local reset. Serial validation included 253
  member tests, 320 API unit tests, 28 API E2E tests, 37 admin tests, 15 landing
  tests, focused PostGIS proof 22/22 and full integration 74/74, plus all
  governance/dependency/contracts/source/build/artifact/secret gates. No cloud
  access or deployment occurred. Status remains `BLOCKED`, not `COMPLETE`,
  because the production flag, private storage lifecycle, worker/provider
  cleanup, reconciliation and operational rehearsals remain unauthorized and
  unproven. Dependency ordering assigns `GGG-022` next because its human review,
  audit and worker-health duty consumes the now-hardened privacy operations and
  other completed operator workflows.
- 2026-08-20 — Completed `GGG-021` through PR #110. Exact tested head
  `fc6636956ce4eebb17401af50c44f65f2874cae4` was squash-merged as
  `197c6ea489215a6746123a857882df85b485e906`; all seven PR checks and all six
  exact-main workflows passed and the remote branch was deleted. Delivery added
  authoritative Contest publication preflight, versioned/body-idempotent region
  and gym lifecycles, append-only versioned owner-gated legal events, server
  Creator capability, truthful audit projections and reachable/honest admin
  configuration panels. Serial validation included 249 member tests, 309 API
  unit tests, 28 API E2E tests, 37 admin tests, 15 landing tests, full workspace
  gates/builds and dependency/governance/contracts/artifact audits. Authorized
  focused PostGIS proof passed 10/10 and full integration passed 11 suites/73;
  Docker cleaned to zero running containers. No cloud access or deployment.
  Dependency ordering assigns launch-critical P0 `GGG-019` next because privacy
  export/deletion/local reset is the remaining member/operator data-rights duty;
  S3/provider/deployment behavior must remain fail closed without authorization.
- 2026-08-20 — Completed the deterministic `GGG-031` repair through PR #109.
  Exact tested head `110bd70ba3ee7a5d8ed005e17a37bb498b644040`
  was squash-merged as `b81b4326ef550b7e87a4cd5e24968828e78f7463`;
  all seven PR checks and all six exact-main workflows passed and the remote
  branch was deleted. Required CI now strictly validates the exact locked SDK
  against installed Expo metadata offline, with a tampered-package regression;
  a separate weekly/manual online advisory reports future compatible patches
  without blocking unrelated releases or mutating dependencies. The bounded
  five-file change also aligned the current eleven SDK 57 patches. Serial proof
  included clean install, 249 member tests/audits, iOS/Android/web and preview
  exports, governance, dependency audit, non-database journeys, and the full
  repository check. No local Docker, cloud access, deployment, SDK major/minor,
  product source/configuration, permission, plugin, or native-ID change occurred.
  `GGG-021` remains the next launch-critical P0 feature.
- 2026-08-20 — Recompleted `GGG-031` after Expo's external SDK 57 compatibility
  metadata advanced again. Exact tested head
  `403475b911416b390125d9e13c07a98b97139d62` changed only the member package
  declaration and root lockfile, was squash-merged through PR #108 as
  `3398b47621096805cc044682a613975c3cc53df9`, and restored the previously failing
  Expo check. All seven PR checks and all six exact-main workflows passed; the
  remote branch was deleted. Serial validation included a clean locked install,
  244 member tests and audits, iOS/Android/web and preview exports, governance,
  dependency audit, non-database journeys, and the full non-Docker repository
  check. No local Docker, cloud access, deployment, SDK major/minor migration,
  source/configuration, permission, plugin, or native-identifier change occurred.
  `GGG-021` remains the next launch-critical P0 feature.
- 2026-08-15 — Completed `GGG-024` through PR #105. Exact tested head
  `c5bfb50c6fc0fff8f998dd0d80296bafbe2553b9` was squash-merged as
  `5886931dea855f4a60ddbac94d0c2d38e18ba9d6`; all seven PR checks and all six
  exact-main workflows passed, the remote branch was deleted, and there was no
  cloud or payment-provider impact. Serial validation included the complete
  repository gate, 298 API unit tests, 28 API E2E tests, 244 member tests, 37
  admin tests, 15 landing tests, the focused five-case cash workflow and 70
  database integration tests across 11 suites. Authorized Docker gates ran one
  at a time and cleaned fully. Dependency ordering assigns launch-critical P0
  `GGG-021` next because the consolidated administrative configuration duty is
  the remaining authoritative operator prerequisite for staging; real legal/
  financial approval and production configuration remain outside repository
  authority. Future Docker use again pauses for user direction.
- 2026-08-14 — Completed `GGG-016` through PR #103. Exact tested head
  `16d6968cfc4009a9199d462ce327be18cfdfc6b6` was squash-merged as
  `fef37d9a552ecb68b90b57d13f7b0082234172ae`; all seven PR checks and all six
  exact-main workflows passed, the remote branch was deleted, and there was no
  cloud impact. Serial validation included the full repository gate, 268 API
  unit tests, 28 API E2E tests, 243 member tests, 37 admin tests, 15 landing
  tests, 11 focused draw/scoring database tests, 38 database journey tests, and
  65 full API database tests. Authorized Docker gates ran one at a time and
  cleaned fully between runs. Dependency ordering assigns launch-critical P0
  `GGG-024` next because its strictly manual pilot cash exception consumes the
  now-audited result/award boundary; legal approval and real-money fulfillment
  remain outside repository authority and must stay fail closed. Future Docker
  use again pauses for user direction.
- 2026-08-14 — Completed `GGG-015` through PR #101. Exact tested head
  `589561d8da975e10e546b63265eb02186e1d0037` was squash-merged as
  `640d4abc756f775b9f405b48b5c5cf96084dc36c`; all seven PR statuses and all six
  exact-main workflows passed, the remote branch was deleted, and there was no
  cloud impact. Serial validation included the full repository gate, 260 API
  unit tests, 28 API E2E tests, 241 member tests, 35 admin tests, 15 landing
  tests, 38 database journey tests, and 65 full API database integration tests.
  The user explicitly authorized those two Docker gates; they ran one at a time
  with Docker empty before, between, and after. Dependency ordering assigns P0
  `GGG-016` next because audited draw settlement and result publication consume
  the now-authoritative reward inventory and award boundary and precede GGG-024
  pilot fulfillment. Future Docker use again pauses for user direction.
- 2026-08-14 — Completed `GGG-020` through PR #99. Exact tested head
  `f679eb4fc2766a5698e2d166bd9c80966706ad7b` was squash-merged as
  `6eb0dc667c0c1489f2cba18125367eae3074352c`; all seven PR checks and all
  applicable exact-main workflows passed, the remote branch was deleted, and
  no cloud access or deployment occurred. Serial validation included the full
  repository gate, 35 admin tests, 253 API unit tests, 28 API E2E tests, the
  six-case partner authorization database suite, and the 37-case database
  journey gate. The later user boundary now requires pausing before every future
  Docker command. Dependency ordering assigns P0 `GGG-015` next because the
  authoritative reward catalog, inventory, award, and claim boundary precedes
  draw publication, pilot cash fulfillment, and the broader admin audit.
- 2026-08-14 — Completed urgent `GGG-031` through PR #97. Exact tested head
  `7793c28aca7a8ff2c73280c90d3057ea21737bd1` was squash-merged as
  `815ae80b1a27fd5dd70a7368bf01fbb2cf767fb4`; every PR and main-push workflow
  passed, the main Member job explicitly reported Expo dependencies current and
  passed all-platform/bundle audits, the remote branch was deleted, and there
  was no cloud impact. The only GGG-011 CI residual is resolved, so GGG-011 is
  now `COMPLETE`. Dependency ordering assigns foundational P0 `GGG-020` next;
  its role-scoped authorization boundary precedes reward, settlement, admin,
  partner-portal, and pilot-fulfillment duties.
- 2026-08-14 — Merged `GGG-011` through PR #96. Exact tested head
  `0e715771d62a046bf0f8ad0483ec3f79c2a2e626` was squash-merged as
  `b549ca292e8706985afdc11ee4a9ab6213be32a7`; all PR checks and five of six
  main-push workflows passed. Member App CI then failed only because Expo's
  external compatibility metadata advanced after the PR run and now requires
  eleven SDK 57 patch updates. Recorded `GGG-011` as `CI_PENDING`, discovered and
  assigned urgent `GGG-031` as its separate dependency-maintenance task, and did
  not broaden the social feature or contact any cloud environment.
- 2026-08-14 — Completed `GGG-010` through PR #94. Exact tested head
  `548b0cdf6e63af839a1fa1ff5f03717965f3595f` was squash-merged as
  `11ca6a407c65e6e8fff7dc35685f3b3b74609db5`; all seven PR and six main-push
  checks passed, the remote feature branch was deleted, and there was no cloud
  impact. Explicit friend-only Weekly Challenges, authoritative eligibility and
  lifecycle closure, provenance/concurrency/database constraints, privacy-safe
  projections, honest member states, canonical settlement/reconciliation, and
  direct regressions are complete. Assigned `GGG-011` to its fresh feature task
  and isolated branch for creation after this ledger merge. Local validation is
  now permanently serialized with at most one Docker task at a time.
- 2026-08-14 — Completed `GGG-009` through PR #92. Exact tested head
  `c8d67539f745ed6b42b5400a066a4b25465fe523` was squash-merged as
  `4b7a8d6002b2ca26788f969beef18d6661631338`; all seven PR and six main-push
  checks passed, the remote feature branch was deleted, and there was no cloud
  impact. Authoritative Alias/friendship/block state, concurrency-safe privacy
  precedence, explicit provider-free invitation links, auth/deep-link recovery,
  retention/privacy operations, contracts, and direct database/client
  regressions are complete. Assigned the now-unblocked `GGG-010` to its fresh
  feature task and isolated branch for creation after this ledger merge.
- 2026-08-14 — Assigned `GGG-009` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-008 completion ledger merged through PR #90 as
  `bbf7ae2f92667b5d61f6e74ebbae5c501ccbd34d` with green main-push checks.
- 2026-08-14 — Completed `GGG-008` through PR #89. Exact tested head
  `8e2b6871d20bc0a1d88c18e5273bc8bc064a1f65` was squash-merged as
  `265a203e6c613d27d6811226d4eb784dd71b6595`; all seven PR and six main-push
  checks passed, the remote feature branch was deleted, and there was no cloud
  impact. Authoritative versioned streaks, bounded database projection, privacy-
  safe public fields, fail-closed client states, two-badge Alias rendering,
  contracts, and direct database/browser/cross-surface regressions are complete;
  staging data/latency reconciliation remains external.
- 2026-08-13 — Assigned `GGG-008` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-007 completion ledger merged through PR #87 as
  `ada4982f9c0e2d001604cd34c73064351c5a5c8d` with green main-push checks.
- 2026-08-13 — Completed `GGG-007` through PR #86. Exact tested head
  `31b2f47d99a0f7e5a20177f902df26a59c0bac1a` was squash-merged as
  `1c6e73075993742666a15aaf8fe13514a742048b`; all seven PR and six main-push
  checks passed, the remote feature branch was deleted, and there was no cloud
  impact. Canonical contest-scoped scoring/ranking, privacy-safe progress,
  ledger reconciliation, immutable settlement snapshots, contracts, migration,
  client states, and direct regressions are complete; the full-month staging
  rehearsal remains external.
- 2026-08-13 — Assigned `GGG-007` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-005 completion ledger merged through PR #84 as
  `8fd2a91e8541f29b674066edf6f483f8e99e3051` with green main-push checks.
- 2026-08-13 — Completed `GGG-005` through PR #83. Exact tested head
  `19e717719cdb9cfce6121545b140dca8f1a492a4` was squash-merged as
  `1b875c2e77c13a91f21390501f7669fef136b703`; all seven PR and six main-push
  checks passed, the remote feature branch was deleted, and there was no cloud
  impact. Authoritative expiring/scoped credentials, immutable enrollment gym
  evidence, idempotent audited operator flows, secret-free history, member
  secret minimization, contracts, migration, and direct regressions are complete;
  real-gym/poster/signed-device/native-identifier rollout gates remain external.
- 2026-08-13 — Assigned `GGG-005` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-004 completion ledger merged through PR #81 as
  `f011ba0cc0cd1ac875eb58aa8178e6a25eaf82c9` with green main-push checks.
- 2026-08-13 — Completed `GGG-004` through PR #80. Exact tested head
  `bbaa881f2b1dfd458aa13a6e41da2f0725dd1081` was squash-merged as
  `b4e98a63933143b2a7eed70bab02c0aeb879c1d7`; all PR and six main-push checks
  passed, the remote feature branch was deleted, and there was no cloud impact.
  Server-authoritative Contest state/counts, immutable enrollment evidence,
  idempotent enrollment/withdrawal, audited transactional cleanup, lifecycle
  cancellation safety, publication prerequisites, contracts, and direct
  regressions are complete; authorized rollout and staging observation remain.
- 2026-08-13 — Assigned `GGG-004` to its fresh feature task and isolated branch
  from `origin/main` after the GGG-003 completion ledger merged through PR #78 as
  `4188fe8f0e246b41b4dd0a1191a7245c55a32c9c` with green main-push checks.
- 2026-08-13 — Completed `GGG-003` through PR #77. Initial CI found a
  platform-dependent raw-byte geometry hash; the corrected canonical-LF exact
  head `48760972e76e2d75d360fce2fe52106fbd0fd6ed` was squash-merged as
  `7268a6bffb2fc06499f6585ffa8a43ca89764d0a`. All PR and six main-push checks
  passed, the remote feature branch was deleted, and there was no cloud impact.
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

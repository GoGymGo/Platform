# GoGymGo backend handoff architecture

Status: current frontend decision record, July 2026

## Decision

Use a NestJS modular monolith, Firebase Authentication, PostgreSQL/PostGIS, a
database-backed operations worker, and private object storage. The Expo app is an
untrusted client. Regional contests award sponsor-funded physical products and
coupon codes through a server-authoritative rewards marketplace.

```mermaid
flowchart LR
  App[Expo app] -->|Firebase ID token| API[NestJS API]
  API --> DB[(PostgreSQL and PostGIS)]
  API --> Storage[Private object storage]
  Worker[Operations worker] --> DB
  Worker --> Push[Expo push service]
  Admin[Operator tools] --> API
```

## Trust boundaries

- The API derives the account from a verified Firebase token and never trusts a
  client-supplied user ID.
- Only the server creates verified sessions, entries, draw snapshots, winners,
  reward awards, or coupon assignments.
- Retried value-bearing writes require idempotency keys and operator mutations
  require append-only audit events.
- Coupon plaintext is encrypted at the API boundary, redacted from logs, and
  revealed only to the authenticated award owner after claim.

## Operator access contract

`GET /v1/operator/access` is the only workspace-selection contract for the
admin client. It requires a revoked-token-aware Firebase bearer token, a
password sign-in provider, an active and email-verified PostgreSQL user, and an
unambiguous database role state. Firebase custom role claims are ignored.

- `admin` receives the global GoGymGo workspace only when it has no partner role
  or active partner assignment. Specialist `operator` and `fraud_operator`
  roles are subject to the same unscoped requirement on their global routes.
- `gym_partner_admin` receives exact-gym writes only for active `admin`
  assignments whose gym is active and nondeleted.
- `gym_partner_staff` receives read-only data only for active `staff`
  assignments. Mixed admin/staff assignments retain their per-gym levels rather
  than being unioned.
- Ordinary members, unverified/suspended identities, social-provider sessions,
  missing or revoked assignments, inactive gyms, role conflicts, and cross-gym
  requests fail closed.

Every downstream operator read/write repeats the relevant database role and
scope check. Client navigation is presentation only and cannot authorize an
operation. The same-origin admin proxy accepts only bounded JSON requests for
`/v1/operator/*` at the configured API origin and forwards no cookies, origin,
redirects, or arbitrary headers.

- Physical fulfillment uses a sponsor HTTPS claim URL or instructions. The app
  does not collect a shipping address.
- AsyncStorage is only a convenience cache and never the source of truth for
  consent, eligibility, verification, inventory, or claims.
- The product has no cash, bank-account, payee, or payment-provider workflow.

## Stack

| Layer      | Choice                                      | Purpose                                             |
| ---------- | ------------------------------------------- | --------------------------------------------------- |
| Mobile     | Expo, React Native, Expo Router, TypeScript | Shared iOS, Android, and preview UI                 |
| Identity   | Firebase Authentication                     | Email, Apple, and Google identity                   |
| API        | NestJS on ECS Fargate                       | Modules, guards, validation, OpenAPI                |
| Data       | PostgreSQL/PostGIS through Kysely           | Transactions, constraints, regional policy          |
| Migrations | node-pg-migrate                             | Reviewable forward schema history                   |
| Jobs       | PostgreSQL leases                           | Retryable lifecycle, push, media, and privacy work  |
| Media      | Private Amazon S3                           | Signed avatar/media operations                      |
| Rewards    | PostgreSQL plus AES-256-GCM                 | Regional catalog, inventory, awards, coupon secrecy |

## Module ownership

| Module                 | Owns                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Auth and profiles      | Firebase guard, account status, public identity                                                     |
| Regions                | Versioned service areas and eligibility evidence                                                    |
| Competitions           | Definitions, brackets, enrollment, rules versions, Weekly Challenge partner requests                |
| Sessions and ledger    | Evidence, review snapshots, append-only entries                                                     |
| Leaderboards and draws | Read models, locked entrant snapshot, selection                                                     |
| Rewards                | Catalog, inventory, awards, claims, encrypted coupon codes                                          |
| Social                 | Bounded Alias-prefix search, friendship lifecycle, blocks, Challenges, hashed link-only invitations |
| Creator workouts       | Public catalog, rights-attested submissions, calendar plans                                         |
| Notifications          | Preferences, templates, delivery attempts                                                           |
| Operator/privacy       | Configuration, audit, export, erasure, support queues                                               |

## Frontend connection readiness

The mobile app has two explicit data modes: `api` for server data and
`unavailable` for honest empty/error states when the API is not configured.
There is no local data source that can imitate production records.

| Product flow                                          | Mobile adapter                                                                          | Server contract                                                                                 | Current status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase account access                               | `state/auth.tsx`                                                                        | Firebase ID token guard                                                                         | Connected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Alias and friend discovery                            | `data/socialRepository.ts`                                                              | `GET/PATCH /v1/me`, `/v1/social/users`, friend/request/block routes                             | Connected; UI term is **Alias**, API field remains `screenName`. Public Aliases are uppercase ASCII, unique, nonreserved, and searched by an authenticated/rate-limited prefix query capped at 20. Self, private identities, and blocked pairs are excluded.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Friends and private invitation links                  | `data/socialRepository.ts`, auth/join routes                                            | `/v1/social/*`                                                                                  | Connected; request transitions, cancellation/removal, and blocks are server-authoritative and retry-safe. Contact intake returns a masked, expiring, single-use link with `deliveryMode=link` and `deliveryStatus=not_sent`; no delivery provider is contacted. Auth preserves the opaque token without redemption, then Join inspects masked metadata and requires explicit destination-bound acceptance.                                                                                                                                                                                                                                                                  |
| Friend and regional activity Challenges               | `data/socialRepository.ts`, `components/socialChallenges.tsx`, Squad Social, Join       | `/v1/social/challenges*`                                                                        | Connected; create is 1-31 days, timezone-safe, kind-specific, and atomic with friend or provider-free contact invitations. Regional create/discovery/join requires current approved evidence for the exact enabled region and serializes capacity. Owner/member/invitation/cancel/withdraw/block/removal states and one local-day check-in are database-enforced. Responses expose only Alias, permitted `streaks-v1`, aggregate progress, and caller-relative capabilities. Gym progress can reference an existing verified workout; manual Challenge activity cannot create workout, Contest ledger/progress/streak/rank, Prize Draw Entry, reward, or settlement credit. |
| Leaderboards, progress, results, streaks, and rewards | `data/appData.ts`, `data/sessionRepository.ts`                                          | leaderboards, `GET /v1/me/progress`, `GET /v1/results/mine/latest`, streaks, rewards            | Connected; live standings and owned progress use server time and versioned scoring rules, distinguish banked entries from provisional projections, expose no private public fields, and identify the signed-in row without matching an alias. Every own/shared streak is a validated `streaks-v1` projection from the same bounded server query; public counts honor `showStats`, every Alias row uses the canonical two-badge renderer, and missing data fails closed. An ended participant sees the pending audit once, then the exact immutable settlement-input snapshot, category champions, and reward winners once published                                         |
| Creator catalog, planning, and submission             | `data/appData.ts`                                                                       | `/v1/creator-workouts/*`                                                                        | Connected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Profile image                                         | `data/accountSettingsRepository.ts`, `state/profile.tsx`                                | `/v1/me/avatar*`                                                                                | Connected through a fail-closed capability read, exact runtime decoders, create-only short-lived private upload, full server decode/inspection, owner-only pending preview, versioned approved presentation, current-version moderation, atomic replacement/removal, and durable exact-version cleanup. Pending/rejected media is never presented as the Profile image.                                                                                                                                                                                                                                                                                                         |
| Legal documents and receipts                          | `data/accountReadinessRepository.ts`                                                    | `/v1/legal-documents/current`, `/v1/me/legal-receipts*`                                         | Connected; exact current bundle is displayed and receipted during registration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Region eligibility                                    | `data/accountReadinessRepository.ts` plus `state/competitionRegion.tsx`                 | `/v1/regions`, `/v1/me/region-verifications*`                                                   | Connected; pending reviews cannot be presented as approved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Competition enrollment                                | `hooks/useCompetitionRegistration.ts`, Home, Profile                                    | `/v1/competitions/current*`, exact-contest enrollment count, enrollment and withdrawal commands | Connected; discovery and start state use authoritative server status/time, confirmation requires the exact legal receipt, approved region evidence, and one active nonexpired Contest/gym-scoped poster. Retry keys remain stable per Contest. The response and current-enrollment read return the pinned gym ID, name, and credential version; Weekly Goal and all enrollment evidence are database-immutable. The member cache drops the public QR payload after enrollment. Withdrawal is irreversible, audited, and atomically closes active workouts and open Weekly Challenge participation while retaining the historical record                                     |
| Weekly Matches                                       | `data/appData.ts`, `app/(tabs)/squad/index.tsx`                                         | exact-Contest match read plus `/v1/competitions/:monthKey/weekly-challenges/*`                  | Connected; active, unblocked players with the same Weekly Goal are paired automatically within the exact Contest/week. Pending direct-friend requests remain explicit and idempotent but do not block automatic assignment. One database-constrained assignment exists per player/week. Partner reads contain only Alias, permitted streak projections/current/best streak, monthly verified-day total, and weekly verified count. Projected multiplier/entries are labeled provisional; only settled values are banked. No client-stored assignment authority exists                                                                     |
| September verified gym session                        | `data/gymScanRepository.ts`, `data/sessionRepository.ts`, `app/(modals)/qr-scanner.tsx` | `POST /v1/gym-scans`, `POST /v1/sessions/:sessionId/cancel`                                     | Connected; the enrollment scan resolves only an assigned active Partner gym in the exact Contest region. Authenticated start and finish location-check commands then use the immutable enrolled gym without resending the poster credential, and start, report early, verify or reject using server time and fresh location. A member can explicitly cancel the active session without credit while keeping enrolled gym access for a later workout                                                                                                                                                                                                                         |
| Competition reminders                                 | notification and push-registration services                                             | `/v1/me/push-devices*`                                                                          | Connected with explicit permission/provisional state, bounded Contest-timezone local schedules, fail-closed remote capability, strict token-free responses, stable installation rotation, owner-scoped disable and honest local-only/retry states. Production remote delivery remains blocked pending EAS/provider configuration and physical-device/background/retry UAT. |
| Privacy export/deletion                               | `data/accountSettingsRepository.ts`, `/account-data`                                    | `/v1/me/privacy-requests*`                                                                      | Connected with fail-closed capabilities, exact operation confirmation, owned history/detail, guarded/versioned operator processing, retry state, and short-lived private export downloads. The Profile local reset is separate and clears only GoGymGo device state; it never creates a server request. Production processing remains disabled until private storage, identity cleanup, retention, worker recovery, restore, and incident gates are rehearsed.                                                                                                                                                                                                              |

### Integration order

1. Run the generated OpenAPI audit and real-device loading, empty, error, retry,
   permission-denied, and expired-session scenarios before enabling API mode.
2. Configure S3 upload CORS for the signed avatar headers. Separately complete
   the EAS/provider and physical-device gates in
   `docs/operations/competition-reminders-and-push.md` before remote push is
   enabled.
3. Confirm the session-review worker refresh cadence against the mobile
   `/v1/me/progress` query and notification expectations.

`services/api/scripts/audit-frontend-contract.mjs` is the release gate for every
mobile-facing operation, including adapters that are staged but not yet wired.
Adding or removing a product flow requires updating both this matrix and that
contract gate.

## Core reward contract

- `GET /v1/rewards/catalog?region=&monthKey=`
- `GET /v1/rewards/awards/me`
- `POST /v1/rewards/awards/{awardId}/claim`
- `GET /v1/results/mine/latest`
- `POST /v1/operator/configuration/rewards`
- `PUT /v1/operator/configuration/rewards/{rewardId}`
- `POST /v1/operator/configuration/rewards/{rewardId}/coupon-codes`
- `POST /v1/operator/configuration/rewards/{rewardId}/status-action`

The catalog is public and contains presentation-safe inventory only. Award and
claim routes are authenticated. Operator mutations require a database role,
reason, idempotency key, and optimistic version where applicable.

## Invariants

- One enrollment per user and competition; its user, Contest, Weekly Goal, gym, region, and rules evidence never change, and withdrawn or disqualified rows cannot return to active. One ledger award exists per source event.
- Public entrant counts are pinned to one exact registration/active Contest and include only active, verified member accounts; they never aggregate other same-month regional Contests.
- Each verified session can award one local Contest day only through its exact
  active enrollment, pinned gym, region timezone, and rules version. Public
  standings contain Alias, score/rank, current-user marker, and public badges;
  personal progress is authenticated and owned.
- Streak projections include only completed verified sessions that satisfy that
  identity, exclude future dates, carry `projectionVersion = streaks-v1`, and
  aggregate in bounded 100-member batches. Public consumers receive no actual
  streak counts when the profile disables public statistics; list contracts use
  a canonical all-zero projection that renders no compact badges.
- Draw settlement transactionally reconciles derived progress with the
  append-only ledger and locks immutable eligible draw entries plus the full
  category/tie scoring-input snapshot, rules version, exact eligible reward
  slots, and privacy-limited public Alias/streak projection. Settled category
  and reward result reads use only those snapshots; later profile, streak, or
  catalog edits cannot rewrite published history.
- `GET /v1/results/mine/latest` is runtime-validated before rendering. Pending
  results must contain no settled rows or timestamp. Settled results require
  exact keys, final category snapshots, matching Contest IDs, unique goals,
  sequential ranks, matching reward counts, canonical Alias/streak projections,
  and no internal IDs or fulfillment fields.
- Published reward inventory is positive and region-scoped by competition.
- One winner and one rank per draw; awards cannot exceed catalog inventory.
- Coupon fingerprints are globally unique and coupon plaintext is absent from
  logs, public catalog data, privacy exports, and other users' responses.
- Every administrative decision stores actor, reason, state, and timestamp.

## Handoff sequence

1. Provision isolated staging and production AWS member accounts, Firebase
   projects, private RDS/PostGIS, GitHub OIDC, Secrets Manager, S3, backups, and
   monitoring.
2. Populate `DATABASE_URL` and a random 32-byte base64
   `REWARD_CODE_ENCRYPTION_KEY` outside Terraform state.
3. Run the committed OpenAPI and mobile contract checks.
4. Execute the forward-only brand-rewards migration before worker/API rollout.
5. Configure sponsor inventory in draft, load coupon codes where applicable,
   publish rewards, then publish the regional competition.
6. Validate loading, empty, error, physical-claim, coupon-claim, duplicate retry,
   and out-of-stock behavior on real devices.
7. Complete regional contest, privacy, sponsor-terms, fulfillment, fraud, and
   incident approval before enabling registration.

Detailed endpoints and migration instructions are in
`docs/product/brand-rewards-marketplace.md`.

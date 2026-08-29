# GoGymGo product requirements

Status: connected browser-first QR pilot baseline, August 1, 2026

The September 2026 pilot requirements in this document supersede earlier
wearable, heart-rate, biometric and random-presence concepts. Those legacy
capabilities may remain in isolated code for future research, but they are not
reachable, required or approved for the pilot.

## 1. Product objective

GoGymGo motivates consistent gym attendance through verifiable workouts,
visible streaks, regional competition, friends, named challenges, creator-led
workout planning, and sponsor-funded physical or coupon rewards.

V1 must prove that:

- users repeatedly complete eligible, server-reviewed workouts;
- streaks, friends, and direct Weekly Challenges improve retention;
- regional monthly competitions can launch and settle fairly against fixed
  sponsor inventory;
- creator workouts improve planning without being confused with verified
  competition credit;
- brands value privacy-safe verified-participation reporting; and
- physical and coupon fulfillment can operate without consumer payment rails.

No purchase is required. The pilot has one administrator-recorded $100 CAD cash
reward and no wallet, bank-account, payee, payment-processor, transfer,
stored-value, or tax-form flow.

That pilot reward must be the sole published reward for the exact September
competition: GoGymGo sponsor, 10,000 cents CAD, inventory one, approved image
and terms, manual instructions, and no claim/provider URL. Draw lock freezes the
value in one slot. Only its exact settled winning Award may receive one manual
handoff record. The authorized operator records an already-completed in-person
handoff with a body-bound idempotency key, expected Award version, bounded
reason and server time; the transaction and append-only audit do not send or
promise payment.

### Product principles

- The server is authoritative for eligibility, enrollment, verified workouts,
  streaks, entries, standings, winners, inventory, and reward claims.
- The client must never present a pending or locally simulated result as an
  approved result.
- Sensitive evidence is collected only when a versioned regional policy
  requires it.
- The product uses one visible vocabulary across every screen.
- Mobile controls must be usable one-handed, accessible, and honest in loading,
  empty, permission, offline, retry, pending, rejected, and completed states.

## 2. Product language

These terms are mandatory in user-visible copy. Internal database and API names
may remain stable when their mapping is documented.

| Product term       | Meaning                                                             | Avoid in visible copy                       | Internal mapping                     |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Alias              | A player's unique public name                                       | Screen name, callsign                       | `screenName`, `screen_name`          |
| Weekly Goal        | The locked number of verified days required each scoring week       | Commitment after registration               | enrollment `goalDays`                |
| Weekly Challenge   | A one-week head-to-head comparison with a selected eligible friend  | Period Match, Match                         | competition match and period records |
| Challenge          | A friend-created or regional activity goal                          | Match                                       | social challenge                     |
| Verified workout   | A workout approved by server evidence review                        | Check-in when referring to the full workout | session, evidence events, review     |
| Challenge check-in | A completion recorded inside a social Challenge                     | Verified workout                            | challenge check-in                   |
| Prize draw entry   | A non-cash chance in a sponsor-funded draw                          | Ticket, point, payout                       | ledger entry                         |
| Reward             | The published pilot cash reward or a future approved sponsor reward | Payout                                      | reward catalog and award             |
| Partner gym        | A gym supporting location-verified workouts                         | Partner when the gym meaning is unclear     | gym application and saved credential |
| Creator workout    | Approved workout guidance that can be added to a calendar           | Verified workout                            | creator catalog and plan             |

The UI term **Alias** maps to the API field `screenName`. Alias validation is
3-24 letters, numbers, or underscores and is case-insensitively unique.

## 3. Core mobile experience

### 3.1 Account access and identity

- Firebase supports email/password, Apple, and Google sign-in.
- Email verification is required before value-bearing or competition actions.
- The API derives the user from the verified Firebase token and never accepts a
  client-supplied account ID.
- Users choose one public identity mode: private system identity, Alias, or
  approved real name.
- An Alias is used consistently in rankings, category champions, Weekly
  Challenges, friends, Challenges, Winners Circle, and reward-winner results.
- Personal contact details, exact location evidence, legal receipts, health
  evidence, and biometric material are never public profile fields.
- Users can upload, replace, or remove an optional avatar. Uploads use private
  signed actions and explicit pending-review, approved, rejected, and removed
  moderation states.

### 3.2 Onboarding, legal consent, and regional eligibility

The required onboarding path is:

1. create or sign into a Firebase account;
2. verify the account email;
3. complete **Use My Location**;
4. verify Vancouver Island + Gulf Islands eligibility;
5. accept the published Privacy Policy, Terms and official contest rules;
6. confirm 19+ eligibility and choose a Weekly Goal; and
7. join the September competition and reach Home.

Public identity is not a registration blocker. The app generates a private,
stable player callsign automatically; users may add a public Alias later from
Profile. The pilot does not request wearable, health, biometric or local
device-presence consent.

Registration requirements:

- The app displays the current server-published Privacy Policy, Terms, and
  competition rules rather than relying on stale bundled copy.
- Acceptance records include document IDs, content hashes, jurisdiction,
  locale, version, and receipt bundle.
- The user explicitly accepts current legal documents and competition rules and
  attests that they meet the verified region's minimum age.
- Region evidence comes from a one-time device-location check. Exact
  coordinates are not stored as public profile data.
- Pending, expired, rejected, or mismatched regional evidence must never appear
  approved.
- The Weekly Goal is selected from 1-7 verified days and is immutable after
  enrollment because there is no goal-change endpoint in V1.
- A player may withdraw from Profile. Withdrawal is irreversible for that
  Contest, retains the historical record for Contest integrity, and immediately
  ends active workouts, ranking, Weekly Challenge, and prize eligibility.
- Profile offers a separate local-device reset that signs out and clears app
  namespaced storage/recovery data, app-owned browser cookies, query state, and
  caches. It preserves unrelated device/browser data and does not create a
  deletion request or delete the account or authoritative server history.
- The current competition, legal receipt, approved region verification, age
  attestation, and accepted rules must all agree before enrollment succeeds.
- Successful registration returns directly to Home with a short confirmation
  banner. The legacy confirmation route redirects to Home and cannot claim
  registration independently.

Competition timing requirements:

- Publishing a competition opens enrollment immediately.
- An eligible player may join before the competition starts or while it is
  active. Enrollment closes only when the competition ends, reaches its
  published entrant cap, or is cancelled.
- Every contest can launch with one eligible entrant and may
  optionally have a sponsor-approved maximum.
- A player who joins after scoring begins may select any published Weekly Goal.
  Only verified results earned after enrollment is confirmed count.

### 3.3 Workout verification lifecycle

Users can start from a creator workout plan or their own workout, but both paths
must enter the same authoritative verification lifecycle.

The only pilot verification method is an approved static gym QR selected once
during enrollment, combined with fresh browser location readings at workout
start and finish. The poster is not rescanned for workouts.

Required lifecycle:

1. confirm the user is enrolled in the current active competition and has a
   selected Partner gym;
2. complete a fresh start location check within the configured 75 m radius;
3. create one authoritative server session that expires at the earlier of four
   hours or 15 minutes after the competition ends;
4. wait at least 30 minutes using server time;
5. complete a fresh finish location check at the selected Partner gym no later
   than 15 minutes after the competition ends; and
6. reconcile the verified or rejected result through authoritative progress.

Evidence and trust requirements:

- QR camera frames are processed locally and are not stored; the validated QR
  payload identifies the selected Partner gym for later location checks.
- Raw location coordinates are used only for the immediate check and are not
  persisted or logged.
- The app must never fabricate QR, location, timer or verification evidence.
- Wearable, heart-rate, Face ID/passcode, biometric-consent and random
  mid-session checks are disabled for the pilot.
- API mode uses real time. Timer acceleration is allowed only in an explicit
  local preview.
- Cancelling a workout closes the server session so it cannot remain stranded
  in an active state.

Completion states:

- **Pending review:** evidence was submitted, but no verified day, score, entry,
  or streak is awarded yet.
- **Verified:** server review approved the workout and authoritative progress
  may add the verified day and resulting awards.
- **Rejected:** duration or evidence requirements failed and no credit is
  awarded.
- **Submission failed:** the session remains recoverable and the user can retry
  the same idempotent completion request.
- **Cancelled:** the workout is closed without review or credit.

Only one verified workout per regional calendar day counts. Manual workout logs
support private history and planning but never silently create competition
credit. Calendar days, verified counts, Weekly Goal, streak inputs, category
score, and Prize Draw Entry totals reconcile from server progress in API mode.

### 3.4 Streaks and visible badges

- The backend calculates daily, weekly, monthly, and yearly streak counts from
  distinct verified dates in the competition timezone.
- Full profile or detail surfaces may explain all streak dimensions.
- Wherever a player Alias appears, an earned streak badge may appear beside it,
  including category champions, rankings, friends, Weekly Challenges, social
  Challenges, and winner results.
- No Alias row may display more than two streak badges at once.
- Compact badge display decomposes the current consecutive verified-day streak
  into its largest duration unit and one remainder unit.
- A 33-day streak therefore displays one month badge and one 3-day badge.
- A streak shorter than seven days displays only one daily badge with its
  numeric count.
- Zero-count or inapplicable badges are hidden in compact Alias rows rather than
  adding visual clutter.
- The client can format badge presentation but cannot invent authoritative
  streak status.

### 3.5 Friends and invitations

- Profile shows the accepted friend list and pending incoming requests.
- Users can search bounded Alias prefixes without exposing contact, location,
  private-stat, or account identifiers.
- Friend requests require recipient acceptance and support explicit accept,
  decline, requester cancellation, and friendship removal actions.
- Users can create an email- or phone-addressed private invitation link and
  explicitly copy/share it. GoGymGo does not claim email/SMS delivery unless an
  approved provider later supplies an authoritative accepted response.
- Contact invitations reveal only a masked destination hint after submission;
  raw destinations are not retained in social read models.
- Block and privacy rules override discovery, requests, contact invitations,
  Challenge membership, and shared visibility.
- Opening an invitation never auto-accepts it. The token survives authentication
  and email verification, then a signed-in member reviews the masked destination
  and explicitly accepts. Email binds to the verified principal; phone requires
  destination confirmation. Links expire and can be redeemed once.

### 3.6 Weekly Challenges

- A Weekly Challenge is created for one of the four seven-day scoring weeks.
- The system automatically assigns the first available active, unblocked player
  in the same competition, scoring week, and Weekly Goal. The assigned Alias and
  live weekly progress must remain plainly visible from Home and Compete.
- While automatic pairing is still in progress, a player can request an accepted
  friend who is actively enrolled in the same competition, region, scoring week,
  and Weekly Goal. A pending request never prevents an eligible automatic match.
- The invited player must explicitly accept or decline.
- Each player can have only one Weekly Challenge partner for a scoring week;
  accepting one request cancels conflicting pending requests.
- If no eligible player is available, the week remains visibly in pairing state
  and may settle in solo mode according to competition rules.
- Tapping the Weekly Challenge shows the partner's permitted Alias, visible
  streak badges, current and best streaks, monthly verified-day total, and that
  week's verified count without exposing private workout details.

Weekly scoring:

- Missing the Weekly Goal produces 0 entries for that week.
- Meeting the goal in solo/searching mode produces the base 1x result.
- If both matched players meet the goal, the settled result is 2x.
- If the user meets the goal, the partner misses it, and the user completes an
  eligible extra workout, the settled result is 3x; otherwise it remains 1x.
- Weekly values shown before settlement are progress projections, not banked
  entries.

### 3.7 Friend and regional Challenges

- A user can create a named Challenge for gym visits, running, walking,
  cycling, hiking, fitness classes, or another described activity.
- A Challenge specifies a 1-31 day window, weekly or monthly target, and target
  count from 1-31.
- A friend Challenge requires at least one accepted GoGymGo friend or an email/
  phone contact invitation.
- A regional Challenge additionally requires a supported region, meeting
  location, local scheduled time, and one or more scheduled weekdays.
- Regional Challenges support discovery and joining within their region and
  optional participant limits.
- Membership and invitation states are explicit: pending, accepted, declined,
  not joined, member, and owner.
- Challenge progress can come from manual Challenge check-ins or eligible
  verified workouts, but Challenge check-ins do not create competition credit.

### 3.8 Competition, rankings, and results

- Competitions are scoped to one verified region and calendar month with
  versioned draft, registration, active, settling, settled, and cancelled
  states.
- The month contains four scoring weeks: days 1-7, 8-14, 15-21, and 22-28.
- Eligible verified workouts on days 29-31 are Bonus Days; each completed Bonus
  Day contributes the user's Weekly Goal in entries.
- Meeting every eligible Weekly Goal can apply the published Perfect Month 10x
  multiplier after all weeks settle.
- Goal categories are 1-7 days. Category ranking separates verified days,
  category score, and Prize Draw Entry weight.
- Category rank is determined by Goal Score. Players with equal Goal Scores share
  the same competition rank, and every player tied for first is a Goal Champion.
- Category placement can change draw weight but never guarantees a reward.
- Winners Circle separates category champions from Brand Reward winners.
- Category champions and all other displayed players show Alias badges when
  applicable under the two-badge rule.
- Public results remain unavailable until an audited draw has settled.

## 4. Creator workout experience

### Catalog and planning

- The catalog lists only approved, published creator workouts.
- Each workout exposes creator, title, duration, style, equipment, region, and
  approved hosted-video metadata.
- A user can add a creator workout to a specific planning date with an optional
  private note.
- Planning or watching a creator workout never creates verified competition
  credit; the user must still complete the standard GoGymGo session flow.

### Creator submission and rights

- Creators submit a hosted video URL and may disclose materially AI-generated
  or AI-altered visuals or audio.
- Submission requires an explicit, versioned rights attestation covering video,
  music, likeness, location, and other necessary rights.
- The creator retains ownership and grants GoGymGo a non-exclusive, worldwide,
  royalty-free license to host, reproduce, edit, crop, reframe, caption,
  translate, and format the submission for GoGymGo products and promotion.
- The license includes approved GoGymGo or sponsor brand placement and reviewed
  AI-assisted reframes, alternate camera angles, and format adaptations for
  supported screens.
- GoGymGo may moderate, decline, pause, or remove a submission for safety,
  rights, disclosure, sponsor, or brand-fit concerns.
- Withdrawal and takedown requests remain operator-controlled and auditable.

## 5. Brand Rewards marketplace

### Catalog

- The marketplace is reachable from Regional Ranks and shows the selected
  region and competition month.
- Each card shows sponsor, title, description, approved image, physical or
  coupon type, total and remaining inventory, availability, and terms link.
- Only published rewards inside their availability window are public.
- Empty, loading, error, unavailable, and out-of-stock states are explicit.
- Styling uses the shared GoGymGo theme rather than an isolated hardcoded brand
  palette.

### Administration

- An operator creates a draft Brand Reward for an existing competition.
- A physical reward requires fulfillment instructions or an HTTPS sponsor claim
  URL.
- The September cash reward requires manual instructions, immutable amount and
  currency, and no claim URL. Other cash rewards are outside the approved
  product scope.
- A coupon reward requires at least as many encrypted unique codes as declared
  inventory before publication.
- Operator mutations require role authorization, audit reason, idempotency key,
  and optimistic version where applicable.
- A competition cannot be published until it has at least one published Brand
  Reward.
- Published reward definitions are immutable except for approved archival or
  status actions.

### Award and claim

- Draw settlement expands published inventory into exact reward slots and
  cannot award more units than the catalog contains.
- One user and one rank can appear only once in a draw.
- Winners receive an in-app or push notification and a My Rewards record.
- Claiming is authenticated, ownership-checked, and idempotent.
- Coupon plaintext is returned only to its assigned winner after claim.
- Physical claims return only the sponsor claim URL or fulfillment instructions;
  GoGymGo does not collect a shipping address.
- Cash is not member-claimable. My Rewards shows pending or fulfilled from the
  authoritative settled snapshot, while the exact admin records one completed
  in-person handoff. Public/member responses exclude the private reason,
  fulfillment-row identifier, operator identifier and winner account UUID.
- Coupon codes and claim secrets never appear in logs, public results, other
  users' APIs, analytics, or privacy exports.

### Winner presentation

- Winners Circle separates category champions from Brand Reward winners.
- Public winner records show permitted Alias, visible streak badges, rank, and
  reward title/type—not coupon codes or private fulfillment details.
- Results and reward claims use server data and provide retryable error states;
  unavailable services render explicit empty or error states.

## 6. Sponsorship and partner model

- Brands contract for approved regional placements and supply reward inventory.
- Campaign configuration includes region, month, creative versions, destination
  URLs, inventory, availability, terms, disclosures, and reporting scope.
- Sponsor areas remain visually separate from workout controls and external
  video players.
- Reporting is aggregate and excludes health, biometric, legal identity,
  location evidence, private social activity, raw contact destinations, and
  coupon plaintext.
- Supported metrics can include served/viewable impressions, reach, frequency,
  clicks, Challenge starts, verified finishes, marketplace views, reward awards,
  claims, and redemptions when the brand supplies that signal.
- Creator, sponsor, and gym partner applications are available from public and
  Profile entry points and have explicit validation and submission outcomes.

Users earn competition credit only through verified GoGymGo workouts, never
through external views, likes, subscriptions, comments, shares, or watch time.
Creator compensation, if introduced later, is a separate business-accounting
decision outside the V1 user application.

## 7. Profile, reminders, and account controls

- Profile contains Alias editing, avatar management, account/email state,
  verified stats, friends, incoming friend requests, region status, workout
  method, calendar, rewards, legal documents, consent notices, reminders,
  partner intake, and sign-out.
- Alias editing in Profile and Friends uses the same validation and API update.
- Competition reminders cover Weekly Goal progress, Weekly Challenges, and
  Bonus Days.
- Enabling reminders requires notification permission, local schedule sync, and
  authenticated Expo push-device registration in API mode.
- Disabling reminders removes local schedules and disables the stored server
  push device.
- Account Data lets a user request a portable export, inspect request history,
  open a short-lived authenticated download when available, and request account
  deletion.
- Account deletion requires an explicit confirmation step and is processed by
  the server rather than immediately erasing local UI state.
- Privacy request creation fails closed while processing is disabled. Operator
  decisions require an authoritative database role, reason, idempotency key,
  and current version; worker completion requires the same renewable live
  lease. The portable export format is versioned and its table disposition is
  exhaustive for the current schema.

## 8. Architecture and data requirements

### Stack

- Expo SDK 57, React Native, Expo Router, TypeScript, and TanStack Query.
- NestJS modular monolith on ECS Fargate.
- Firebase Authentication.
- PostgreSQL/PostGIS with Kysely and node-pg-migrate.
- Database-leased operations worker and private Amazon S3.
- OpenAPI contract audit, structured redacted logs, and optional OTLP.

### Mobile data modes

- **API:** authenticated repository adapters and server-authoritative state.
- **Unavailable:** safe empty/error behavior when no API is configured.

AsyncStorage is a convenience cache for local preferences, active-session
recovery, and manual notes. It is never authoritative for legal consent,
regional eligibility, enrollment, verified credit, entries, inventory, winners,
or claims.

### Authoritative records

- users, profiles, roles, blocks, friendships, and Alias uniqueness;
- region policies, boundaries, verification evidence, and decisions;
- legal documents and append-only legal receipt bundles;
- competitions, goal brackets, enrollments, Weekly Challenge requests and
  assignments;
- workout sessions, immutable evidence events, review snapshots, decisions,
  ledgers, progress, and standings;
- social Challenges, invitations, contact-invite hashes, membership, and
  check-ins;
- creator submissions, rights receipts, catalog workouts, and calendar plans;
- draws, Brand Reward catalog items, awards, encrypted coupon inventory, and
  claims;
- avatars, notifications, push devices, privacy operations, idempotency records,
  and operator audits.

### Required invariants

- All value-bearing mutations are retry-safe and use stable idempotency scopes.
- Only the server can create verified sessions, entries, winners, awards, or
  claims.
- One enrollment exists per user and competition; the registered Weekly Goal is
  locked.
- One active workout session exists per user, and one verified workout per
  regional date can affect competition progress.
- One Weekly Challenge assignment exists per player and scoring week.
- Brand Reward inventory cannot become negative or be over-awarded.
- Coupon fingerprints are unique, ciphertext uses a random IV, and plaintext is
  absent outside the authorized claim response.
- Administrative actions are authorized, versioned, reasoned, and audited.
- The production administration surface exposes every required Contest, region,
  reward, legal, Creator-workout, and Partner-gym step; it never substitutes a
  client-only readiness result or hides a mandatory prerequisite workflow.
- Contest publication inspects the exact current database schedule, policy and
  boundary version, owner-approved legal versions/digests, reward inventory,
  active exact-region gym/QR coverage, and rules. Missing, stale, disabled, or
  unavailable evidence fails closed.
- Region, gym, legal, and other stateful lifecycle commands use the version
  returned by the authoritative read. Destructive actions preserve settlement,
  receipt, enrollment, workout, QR, reward, and audit history according to the
  deletion policy.
- The configured legal owner remains the only publisher/withdrawer. Partner
  roles remain exact-gym scoped and cannot obtain platform configuration. A
  Creator admin build flag does not override the API release flag.
- Account deletion preserves only approved pseudonymous contest and reward
  integrity records.
- Historical migrations remain replayable and production migrations are
  forward-only.

### Mobile-facing contract

The mobile release contract currently covers 61 required operations across:

- profile, avatar, legal receipt, region, privacy, and push-device APIs;
- current competition, enrollment, Weekly Challenge, leaderboard, session,
  progress, streak, result, and reward APIs;
- friend, contact invitation, social Challenge, discovery, join, and check-in
  APIs; and
- creator catalog, planning, submission, and partner-application APIs.

Any product-flow addition or removal must update the OpenAPI file, frontend
contract audit, PRD, and backend handoff matrix together.

## 9. Privacy, safety, compliance, and accessibility

- Collect the least evidence required for eligibility and verification.
- Publish versioned Terms, Privacy, competition rules, and health/biometric
  consent per supported jurisdiction and locale.
- Legal counsel approves no-purchase rules, eligibility, age threshold, skill
  and chance structure, publicity, winner disclosure, and regional prize
  treatment.
- Sponsor agreements define inventory ownership, delivery, code validity,
  expiry, substitutions, refunds/replacements, support, moderation, image
  rights, trademarks, prohibited claims, and incident response.
- Blocks are immediate and prevent discovery, requests, invitations, and shared
  social access.
- Raw email and phone invitation destinations are used only to create the
  invitation and are not returned in social APIs.
- Logs, telemetry, idempotency response bodies, and privacy exports exclude raw
  invitation destinations and opaque tokens. Resolved masked metadata is
  retention-limited and removed by the operations worker.
- Biometric identifiers and camera frames are not stored or transmitted by the
  current mobile presence and QR flows.
- Health, region, consent, and session evidence have explicit retention and
  deletion rules.
- Every interactive control meets mobile touch-target requirements and exposes
  meaningful roles, labels, checked/disabled states, and live error/status
  announcements.
- Content supports readable contrast, safe-area insets, keyboard avoidance,
  reduced motion, and narrow phone layouts without horizontal scrolling.
- Destructive actions, including session cancellation and account deletion,
  require explicit confirmation.

## 10. V1 scope

Included:

- Firebase authentication, email verification, onboarding, Alias/profile,
  moderated avatar, regional eligibility, and legal receipts;
- competition enrollment, immutable Weekly Goal, verified session flow,
  server-side evidence review, cancellation, and progress reconciliation;
- compact two-badge Alias display backed by daily, weekly, monthly, and yearly
  streak calculation;
- friends, friend requests, email/phone invitations, direct Weekly Challenge
  selection, partner statistics, named friend Challenges, and regional scheduled
  Challenges;
- creator catalog, calendar planning, rights-attested submissions, AI
  disclosure, approved brand placement, and reviewed format adaptations;
- category rankings, monthly competition settlement, Bonus Days, Perfect Month,
  category champions, Winners Circle, and Brand Reward winners;
- regional physical/coupon marketplace, encrypted coupon inventory, My Rewards,
  and claims;
- creator, sponsor, and gym partner applications;
- local and push reminders, privacy export/deletion, moderation, operator
  configuration, migrations, OpenAPI, tests, and deployment runbooks.

Deferred:

- user purchases, subscriptions, entry fees, wallets, automated cash payments,
  or stored-value rewards;
- wallets, bank connections, payee onboarding, transfers, and tax forms;
- GoGymGo collection of shipping addresses;
- self-service brand fulfillment and automated third-party fulfillment;
- creator-owned in-app video hosting and user-generated live video;
- sponsor creative delivery, playback, impression/click ingestion, and
  advertising analytics until a production contract and approval gate exist;
- wearable and combined biometric/device-attestation competition policies until
  real signed evidence integrations are implemented and approved; and
- global launch before region-by-region legal and operational approval.

## 11. Current implementation baseline

As of July 30, 2026:

- the Expo Router app contains 49 concrete routes and 47 audited literal links;
- the primary account, onboarding, registration, QR handoff, creator, rewards,
  friends, privacy, and profile flows have been browser smoke-tested;
- the mobile check passes typecheck, lint, 127 automated tests, a 64-request-site
  API audit covering 59 mobile operations, and the source audit;
- the backend check passes formatting, typecheck, lint, 116 unit tests, 26 E2E
  tests, 21 clean migrated PostgreSQL/PostGIS integration tests, OpenAPI
  generation, the 62-operation frontend contract audit, source audit, and
  production build;
- production web, iOS, and Android bundles exclude the development App Tour
  data and UI while development builds retain the dedicated click-through
  testing area;
- the production backend image and deployable configuration have zero
  high/critical Trivy findings, and the Terraform foundation tests pass; and
- API adapters exist for legal/region/enrollment, sessions and progress, social
  features, creators, rewards, avatars, privacy, and push devices.

The remaining release work is deployment, owner-approved legal text, the real
condo gym configuration, Cloud billing and domains, and an on-site two-account
staging UAT using the static QR poster.

## 12. Release gates

1. The real PostgreSQL/PostGIS migration suite passes from a clean database and
   a second idempotent migration run. Any database created from the retired
   preproduction migration set is rebuilt from empty before this baseline is
   used.
2. Mobile and backend lint, typecheck, unit, E2E, OpenAPI, contract, source, and
   production builds pass with no generated diff.
3. A random 32-byte base64 `REWARD_CODE_ENCRYPTION_KEY` is provisioned outside
   Terraform state, API-only, recoverable through approved secret procedures,
   and never logged.
4. GCS upload CORS permits the signed avatar headers, and the release EAS project
   ID can mint Expo push tokens.
5. Staging proves legal receipt, region decision, enrollment, session create,
   evidence, completion, cancellation, pending review, rejection, verification,
   and `/v1/me/progress` reconciliation.
6. Staging proves friend acceptance, direct Weekly Challenge assignment,
   regional Challenge discovery/join/check-in, contact invitation redemption,
   and block enforcement.
7. Staging proves creator rights receipts, AI disclosure, catalog moderation,
   calendar planning, Brand Reward publication, insufficient-code rejection,
   inventory bounds, draw idempotency, ownership checks, duplicate claims, and
   removed payout-route behavior.
8. Two physical browser devices pass QR camera, live-location, geofence,
   accessibility, offline/error, idempotent retry, and background/foreground
   exercises at the configured condo gym.
9. One complete regional month is rehearsed: registration, minimum entrant
   decision, four Weekly Challenges, Bonus Days, settlement, Winners Circle,
   reward claim, fulfillment, privacy export/deletion, backup, restore, fraud,
   and incident handling.
10. Business, security, privacy, operations, sponsors, and counsel sign off for
    every enabled region.

Implementation details and ownership are maintained in:

- `docs/architecture/member-readiness-audit.md`;
- `docs/architecture/member-api-contract.md`;
- `docs/product/brand-rewards-marketplace.md`;
- `docs/product/social-challenges.md`; and
- `docs/product/streak-rewards.md`.

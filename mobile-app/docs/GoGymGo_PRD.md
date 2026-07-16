# GoGymGo product requirements

Status: current V1 direction, July 2026

## 1. Product objective

GoGymGo motivates consistent gym attendance through verifiable workouts,
visible streaks, regional competition, friends, named challenges, and
sponsor-funded physical or coupon rewards.

V1 must prove:

- users complete repeat verified gym sessions;
- streaks and social accountability improve retention;
- regional contests can settle fairly against fixed reward inventory;
- brands value privacy-safe verified-participation reporting; and
- physical/coupon fulfillment can operate without consumer payment rails.

No purchase is required. V1 contains no cash, wallet, bank-account, payee,
payment-processor, transfer, or tax-form flow.

## 2. Core experience

### Account and public identity

- Firebase supports email/password, Apple, and Google sign-in.
- The API derives the user from a verified token.
- A unique screen name is the public identity used in leaderboards, friend
  search, challenges, and winner announcements.
- Personal contact, location evidence, legal receipts, and health evidence are
  never public profile fields.
- Users can upload, replace, or remove an optional moderated avatar.

### Commitment and workouts

- A user selects a monthly commitment goal and accepts the current regional
  contest/legal versions.
- A verified workout uses server-reviewed evidence such as approved partner-gym
  QR, device integrity, wearable data, and biometric checkpoints as required by
  policy.
- Manual logs can support personal history but never silently create contest
  credit.
- Entry and score changes are append-only and bound to the exact rules/evidence
  version.

### Streak rewards

- The app displays four badges: daily, weekly, monthly, and yearly.
- The centered number is the current count of consecutive completed periods.
- A count of zero uses the theme's locked/disabled treatment.
- The backend calculates streaks from distinct verified gym-log periods; the
  client never computes authoritative streak status.

### Friends and challenges

- Users search exact or partial screen names without exposing emails.
- Friend requests require recipient acceptance; block rules override search,
  requests, invitations, and challenge visibility.
- Any user can create a named challenge and invite accepted friends.
- A private challenge owner can also send an expiring invitation link through
  an email or phone composer; raw contact destinations are not retained.
- Invitations have explicit pending, accepted, and declined states.
- Challenge membership and activity visibility follow server-side privacy rules.
- Before a Weekly Challenge is assigned, a player can request an accepted friend
  who is active in the same competition and has the same Weekly Goal. The
  recipient must accept, and a player can have only one partner per week.
- Tapping an active Weekly Challenge reveals the partner's public verified-day
  totals and streaks without exposing private workout details.

### Competition and standings

- Competitions are scoped to one region and calendar month with a versioned
  registration/active/settled lifecycle.
- Regional and gym leaderboards distinguish verified days, category score, and
  prize-draw entries.
- Draw settlement snapshots eligible active users with verified email and no
  disqualifying finding, then selects without replacement using the published
  weighting rules.
- Category placement can change selection weight but does not guarantee a win.

## 3. Brand rewards marketplace

### Catalog

- The marketplace is reachable from Regional Ranks and shows the selected
  region and competition month.
- Each card shows sponsor, title, description, image when approved, physical or
  coupon type, total/remaining inventory, and terms link.
- Only published rewards within their availability window are public.
- Empty, loading, error, unavailable, and out-of-stock states are explicit.
- Styling uses the existing theme tokens; no isolated hardcoded brand palette.

### Administration

- An operator creates a draft reward for an existing competition.
- A physical reward requires sponsor fulfillment instructions or an HTTPS claim
  URL.
- A coupon reward requires at least as many encrypted unique codes as its
  declared inventory before publication.
- Operator mutations require role authorization, audit reason, idempotency key,
  and optimistic version where relevant.
- A competition cannot be published until it has a published reward.
- Published reward definitions are immutable except for archival.

### Award and claim

- Draw settlement expands published inventory into exact reward slots and cannot
  award more units than the catalog contains.
- One user and one rank can appear only once in a draw.
- Winners receive an in-app/push notification and a My Rewards record.
- Claiming is authenticated, ownership-checked, and idempotent.
- Coupon plaintext is returned only to its assigned winner after claim.
- Physical claims return only the sponsor claim URL/instructions; GoGymGo does
  not collect a shipping address.
- Coupon codes and claim secrets never appear in logs, public results, other
  users' APIs, analytics, or privacy exports.

### Winner results

- Winners Circle separates category champions from reward winners.
- Public winner records show permitted screen name, rank, and reward title/type,
  not coupon codes or private fulfillment details.
- Results remain unavailable until an audited draw has settled.

## 4. Sponsorship model

- Brands contract for approved regional placements and supply reward inventory.
- Campaign configuration includes region, month, creative versions, destination
  URLs, inventory, availability, terms, disclosures, and reporting scope.
- Sponsor areas remain visually separate from workout controls and external video
  players.
- Reporting is aggregate and excludes health, biometric, legal identity,
  location evidence, private social activity, and coupon plaintext.
- Supported metrics can include served/viewable impressions, reach, frequency,
  clicks, challenge starts, verified finishes, marketplace views, reward awards,
  claims, and redemptions when the brand supplies that signal.

Creator-led workouts and sponsored challenges may use approved external video
links. Users earn contest credit only through verified GoGymGo workouts, never
through external views, likes, subscriptions, comments, shares, or watch time.
Creator compensation, if introduced later, is a separate business-accounting
decision and is outside the V1 user application.

The creator catalog exposes approved follow-along videos with creator, duration,
style, equipment, and region metadata. A user can add a catalog workout to a
specific planning date, but this never creates verified competition credit.
Creators can submit hosted videos for review only after accepting the current
rights terms and disclosing materially synthetic media. Those terms grant a
non-exclusive license for hosting, cropping, reframing, captions, translations,
approved brand placement, and reviewed AI-assisted format or camera-angle
adaptations while the creator retains ownership. Moderation, withdrawal, rights,
sponsor, and safety review remain operator-controlled.

## 5. Architecture and data

### Stack

- Expo SDK 57, React Native, Expo Router, TypeScript, TanStack Query.
- NestJS modular monolith on Cloud Run.
- Firebase Authentication.
- PostgreSQL/PostGIS with Kysely and node-pg-migrate.
- Database-leased operations worker and private Cloud Storage.
- OpenAPI-generated contract, structured redacted logs, and optional OTLP.

### Authoritative records

- users, profiles, roles, blocks, friendships;
- region policies and evidence decisions;
- legal documents and append-only receipts;
- competitions, brackets, enrollments, sessions, reviews, ledgers, standings;
- draws, reward catalog items, awards, encrypted coupon inventory;
- challenges, invitations, memberships;
- notifications, privacy operations, idempotency, operator audits.

### Required invariants

- all value-bearing mutations are retry-safe;
- catalog inventory cannot become negative or be over-awarded;
- coupon fingerprints are unique and ciphertext uses a random IV;
- plaintext coupon codes are absent from storage outside the encrypted field;
- administrative actions are authorized, versioned, reasoned, and audited;
- account deletion preserves only approved pseudonymous contest/reward integrity;
- historical migrations remain replayable and production migrations are forward.

## 6. Privacy, safety, and compliance

- Collect the least evidence required for eligibility and verification.
- Publish versioned Terms, Privacy, contest rules, and health/biometric consent per
  supported jurisdiction and locale.
- Legal counsel approves no-purchase rules, eligibility, age threshold, skill/
  chance structure, publicity, winner disclosure, and regional prize treatment.
- Sponsor agreements define inventory ownership, delivery, code validity,
  expiry, substitutions, refunds/replacements, support, moderation, image rights,
  trademarks, prohibited claims, and incident response.
- Blocks are immediate and prevent discovery, requests, invitations, and shared
  social access.
- The app must provide accessible touch targets, readable states, reduced-motion
  behavior, and meaningful screen-reader labels.

## 7. V1 scope

Included:

- authentication, onboarding, profile, region review, legal receipts;
- workout session flow and server-side evidence review;
- daily/weekly/monthly/yearly streak badges with numeric counts;
- leaderboards, monthly draw, category champions, reward winners;
- regional physical/coupon marketplace and My Rewards claims;
- screen-name search, friend requests, named challenges, invitations;
- sponsor/creator/gym application surfaces;
- notifications, moderation, privacy export/deletion, operator configuration;
- migrations, OpenAPI, tests, deployment foundation, and runbooks.

Deferred:

- user purchases, subscriptions, entry fees, cash or stored-value rewards;
- wallets, bank connections, payee onboarding, transfers, and tax forms;
- GoGymGo collection of shipping addresses;
- self-service brand fulfillment portal and automated third-party fulfillment;
- creator-owned in-app video hosting and user-generated live video;
- global launch before region-by-region legal and operational approval.

## 8. Release gates

1. Real PostgreSQL migration suite passes from a clean database and an upgraded
   legacy database backup.
2. Lint, typecheck, unit, E2E, OpenAPI, contract, source, and production builds
   pass for backend and mobile.
3. Coupon encryption key is generated out of band, API-only, recoverable through
   approved secret procedures, and never logged.
4. Staging proves catalog publication, insufficient-code rejection, inventory
   bounds, draw idempotency, ownership checks, duplicate claims, and legacy route
   removal.
5. Physical and coupon fulfillment are rehearsed with each launch sponsor.
6. Real-device verification, notification, accessibility, offline/error, fraud,
   privacy export/deletion, backup, restore, and incident exercises pass.
7. Business, security, privacy, and counsel sign off for each enabled region.

The implementation contract and migration steps live in
`backend/docs/brand-rewards-marketplace.md`.

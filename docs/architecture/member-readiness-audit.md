# GoGymGo frontend readiness audit

Status: code audit complete; external release configuration pending, July 30, 2026

This document is the working map for taking the Expo app to a
backend-connected release candidate. It separates implemented UI from
server-authoritative behavior and requires honest unavailable states wherever a
production integration is not ready.

## Current evidence

- The Expo Router tree contains 49 concrete routes and 47 literal navigation
  targets. `npm run audit:source` currently finds no broken literal target.
- A browser boot sweep loaded all 46 App Tour catalog screens at default and
  390 x 844 dimensions without an uncaught render error, console error, or
  horizontal overflow.
- Mobile typecheck, lint, 127 domain/data tests, API route audit, and source
  audit pass.
- Backend formatting, typecheck, lint, build, 116 unit tests, 26 E2E tests,
  21 clean PostgreSQL/PostGIS integration tests, OpenAPI generation, contract
  audit, and source audit pass. The source audit inspected 270 files, and the
  compiled production audit found all 21 prohibited markers absent across 165
  generated files.
- The frontend contract gate now requires all 59 mobile-facing server
  operations, rather than the original 20-route subset.
- Production web, iOS, and Android bundles were scanned for 23 App Tour
  fixture/UI markers across 69 generated files. None are packaged. Development
  builds retain the dedicated click-through App Tour through production-aware
  Metro aliases.

## Product-language dictionary

Use these terms in all visible copy. Internal database and API names may remain
stable when the mapping is documented.

| Product term | Use for | Avoid in visible copy | Internal mapping |
| --- | --- | --- | --- |
| Alias | A player's public unique name | Screen name, callsign | `screenName`, `screen_name` |
| Weekly Challenge | The one-week head-to-head commitment comparison | Period Match, weekly match | competition match/period tables |
| Challenge | A friend-created or regional activity goal | Match | social challenge |
| Verified workout | A workout accepted by server evidence review | Check-in when referring to the full workout | session plus evidence events |
| Challenge check-in | One completion recorded inside a social activity challenge | Verified workout | social challenge check-in |
| Prize draw entry | A non-cash chance in the sponsor-funded draw | Ticket, point, payout | ledger entry |
| Brand reward | A physical sponsor prize or coupon | Cash prize, payout | reward catalog/award |
| Partner gym | A gym with entry/exit QR verification | Partner when the gym meaning is unclear | partner application/gym evidence |
| Weekly Challenge partner | The friend selected for one competition week | Random match | opponent user |

The UI term **Alias** maps to the API field `screenName`. The alias editor is now
shared by Profile and Friends, validates the backend's exact 3-24 character
rule, and updates public identity and friend discovery in one request.

## Flow map

| Flow | Entry | Primary completion | Current integration |
| --- | --- | --- | --- |
| Player account | `/` -> `/join` -> `/sign-up` or `/sign-in` | Firebase account and verified email | Firebase connected; legal receipts are synchronized during registration |
| Required setup | `/region` (location + account agreements) -> `/commitment` | Active competition enrollment | Current legal documents, receipts, region evidence, and enrollment are connected |
| Optional profile/workout setup | Profile -> `/identity`; first verified workout -> `/verification` | Custom public Alias and saved workout device | Private callsign is automatic; device-presence consent is requested at first use |
| Verified workout | Home/Start -> first-use device selection -> check-in -> active -> check-out -> complete | Server-reviewed session | Authoritative create/evidence/complete/cancel adapter connected; pending review never appears verified |
| Competition | Home/Ranks -> Squad -> Weekly Challenge detail | Goal, partner, progress, and stats | Enrollment and read/partner-request adapters connected |
| Friends | Profile/Squad -> `/squad/social` | Search, request, accept, invite | API adapter connected |
| Activity challenge | Friends -> Challenges | Create/join/invite/check in | API adapter connected |
| Creator planning | Home/Start -> `/workouts` -> detail | Add creator workout to calendar | API adapter connected |
| Creator submission | Creator catalog/application -> `/creator/submit` | Rights-attested submission | API adapter connected |
| Results and rewards | Ranks/Home -> Winners Circle/Rewards | View winners and claim award | API adapter connected |
| Partner intake | Join -> `/partner` | Creator, sponsor, or gym application | API adapter connected |
| Account controls | Profile -> Account Data | Alias, avatar, legal, privacy, reminders | Connected; signed avatar moderation, push registration, and privacy request status have explicit adapters |

## Code-size and duplication priorities

Line count is a signal, not an automatic defect. These files need ownership
boundaries because they currently combine independent state machines and large
style blocks:

1. `src/components/socialChallenges.tsx` (~1,800 lines): split builder,
   challenge card/progress, and shared controls/formatters. Keep validation in
   `domain/social.ts`.
2. `app/(onboarding)/commitment.tsx` (~980 lines): split goal selection,
   projection/rules, and registration summary. Keep calculations in domain
   modules.
3. `app/(tabs)/squad/social.tsx` (~780 lines after alias consolidation): split
   Friends, Requests, and Challenges tab bodies while retaining one query owner.
4. `app/(tabs)/calendar.tsx`, `profile/index.tsx`, and
   `state/workoutProgress.tsx` (~700-820 lines): extract presentation sections;
   keep transactional state changes in the provider/repository boundary.

Do not split components solely to reduce a number. A split is complete only
when the new module has one product responsibility, a narrow typed interface,
and equivalent tests/render behavior.

## Remaining release-blocking inputs and connections

The September browser pilot uses only the connected static gym QR and live
location flow. Wearable, heart-rate, biometric and random-presence items below
are retained as historical/future readiness notes and are not pilot blockers.

The authoritative status matrix and integration order live in
`backend-handoff-architecture.md`. Code checks are green. Store release remains
blocked until the release owner supplies or approves:

1. final iOS bundle ID and Android package ID;
2. the EAS owner and initialized EAS project ID;
3. a public HTTPS production API deployment;
4. public deployment and approval of the privacy-policy and implemented
   `/account-deletion` pages;
5. the real condo gym and issued static QR credential; and
6. physical-device validation for QR camera, location, push token,
   notification permission, and signed avatar upload states.

## Required verification for completion

- Walk account creation, sign-in, email verification, and every onboarding step
  with a staging Firebase account.
- Exercise every permission result: granted, denied, unavailable, expired, and
  retry.
- Exercise every API-backed surface in loading, empty, success, validation,
  unauthorized, conflict, server-error, offline, and idempotent-retry states.
- Complete one 30-minute QR entry/exit session with two real browser accounts
  at the staging condo gym.
- Verify one full monthly competition lifecycle: enrollment, four Weekly
  Challenges, bonus days, settlement, Winners Circle, and reward claim.
- Confirm aliases and at most two streak badges wherever a player alias appears.
- Run `npm run check` in both workspaces and confirm the regenerated OpenAPI file
  produces no diff.

The codebase is ready for GitHub handoff. Store submission remains gated on the
external release inputs and physical-device evidence listed above.

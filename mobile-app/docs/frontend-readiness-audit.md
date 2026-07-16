# GoGymGo frontend readiness audit

Status: active audit, July 15, 2026

This document is the working map for taking the Expo app from a complete local
product preview to a backend-connected release candidate. It separates what is
visually implemented from what is server-authoritative so a polished demo state
cannot be mistaken for a production integration.

## Current evidence

- The Expo Router tree contains 48 concrete routes and 46 literal navigation
  targets. `npm run audit:source` currently finds no broken literal target.
- A 390 x 844 browser boot sweep loaded every concrete route (using a catalog
  workout for the dynamic route) without an uncaught render error or console
  error. Guarded routes still require stateful, action-by-action validation.
- Mobile typecheck, lint, and 112 domain/data tests pass.
- Backend typecheck, lint, 98 unit tests, OpenAPI generation, and formatting pass.
- The frontend contract gate now requires all 59 mobile-facing server
  operations, rather than the original 20-route subset.

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
| Onboarding | `/identity` -> `/region` -> `/consents` -> `/verification` -> `/commitment` | Active competition enrollment | Current legal documents, receipts, region evidence, and enrollment are connected |
| Verified workout | Home/Start -> method -> check-in -> active -> check-out -> complete | Server-reviewed session | Authoritative create/evidence/complete/cancel adapter connected; pending review never appears verified |
| Competition | Home/Ranks -> Squad -> Weekly Challenge detail | Goal, partner, progress, and stats | Enrollment and read/partner-request adapters connected |
| Friends | Profile/Squad -> `/squad/social` | Search, request, accept, invite | API adapter connected |
| Activity challenge | Friends -> Challenges | Create/join/invite/check in | API adapter connected |
| Creator planning | Home/Start -> `/workouts` -> detail | Add creator workout to calendar | API adapter connected |
| Creator submission | Creator catalog/application -> `/creator/submit` | Rights-attested submission | API adapter connected |
| Results and rewards | Ranks/Home -> Winners Circle/Rewards | View winners and claim award | API adapter connected |
| Partner intake | Join/Profile -> `/partner` | Creator, sponsor, or gym application | API adapter connected |
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

## Remaining release-blocking connections

The authoritative status matrix and integration order live in
`backend-handoff-architecture.md`. The current P0 order is:

1. physical-device verification for QR camera, device presence, push token,
   notification permission, and signed avatar upload states;
2. decomposition of the large Commitment, social challenge, and workout state
   files after their data boundaries are stable.

## Required verification for completion

- Walk account creation, sign-in, email verification, and every onboarding step
  with a staging Firebase account.
- Exercise every permission result: granted, denied, unavailable, expired, and
  retry.
- Exercise every API-backed surface in loading, empty, success, validation,
  unauthorized, conflict, server-error, offline, and idempotent-retry states.
- Complete one QR workout and one non-QR workout on physical iOS and Android
  devices, including a mid-session presence check.
- Verify one full monthly competition lifecycle: enrollment, four Weekly
  Challenges, bonus days, settlement, Winners Circle, and reward claim.
- Confirm aliases and at most two streak badges wherever a player alias appears.
- Run `npm run check` in both workspaces and confirm the regenerated OpenAPI file
  produces no diff.

The frontend is ready for GitHub handoff only when this evidence exists and all
remaining P0 connections above are moved from local/demo state to an
authenticated API adapter or are explicitly removed from the release scope.

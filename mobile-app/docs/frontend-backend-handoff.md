# Frontend to Backend Handoff

## Readiness status

The Expo React Native frontend is structured for backend integration and fails honestly when production services are unavailable. Preview routes, runtime mock fixtures, synthetic users, accelerated timers, simulated workout verification, and local application-success fallbacks have been removed. `npm run check` includes a production-readiness audit that prevents these paths from being reintroduced.

The frontend is not the source of truth for competition eligibility, verified workouts, scoring, rankings, payouts, sponsor approvals, or legal receipts. Existing AsyncStorage-backed workout and onboarding state supports UI continuity only and must be replaced or reconciled with authoritative API responses before production launch.

The workout storage keys were versioned during this cleanup so active sessions and workout logs created by the removed preview implementation are not hydrated into the cleaned app.

## Runtime configuration

- `EXPO_PUBLIC_API_URL` is the only frontend API origin.
- Firebase supplies the bearer token through `ApiProvider`.
- Missing API configuration produces explicit unavailable states; writes never succeed locally.
- `.env.local`, Firebase native files, generated exports, logs, and build output are ignored by Git.

## API calls already aligned with the backend

| Frontend capability | Backend contract |
| --- | --- |
| Regional category leaderboard | `GET /v1/leaderboards/current?goal={1-7}` |
| Competition matches | `GET /v1/competitions/{monthKey}/matches?goal={1-7}&region={code}` |
| Public enrollment count | `GET /v1/competitions/{monthKey}/enrollment-count?region={code}` |
| Current payout claim | `GET /v1/payout-claims/me` |
| Hyperwallet portal action | `POST /v1/payout-claims/{claimId}/portal-action` |
| Creator application | `POST /v1/partner-applications/creators` |
| Sponsor application | `POST /v1/partner-applications/sponsors` |
| Gym application | `POST /v1/partner-applications/gyms` |

All money crosses the API boundary as integer minor units and is converted for display in the frontend repository layer.

## Contracts still to connect

1. Fetch the server legal bundle, render its versioned content, and submit `POST /v1/me/legal-receipts` after authentication. Do not restore a local legal-receipt substitute.
2. Replace client region assignment with the server region-policy and verification lifecycle. A pending verification must never be presented as approved.
3. Hydrate profile, current competition, enrollment, and progress from `/v1/me`, `/v1/competitions/current`, and `/v1/me/progress`.
4. Replace local verified-workout mutations with `/v1/sessions`, immutable session events, provider evidence, and `/v1/sessions/{sessionId}/complete`.
5. Add backend response contracts for approved sponsor campaigns, creator workouts, settled competition results, and public winner summaries. Until those endpoints exist, the frontend returns empty/unavailable states and never invents routes or data.
6. Reconcile or clear legacy AsyncStorage competition/workout state after authoritative hydration. Personal display preferences may remain local; competition facts may not.

## Native integration boundaries

Heart-rate telemetry, identity evidence, and signed partner-gym QR scanning currently return unavailable and their checkpoint buttons remain disabled. Each provider must return backend-accepted evidence before the frontend advances. Device biometrics alone confirm local device ownership and must not be treated as proof that a workout occurred.

## Recommended backend integration order

1. Development API URL, Firebase authentication, `/v1/me`, and legal receipts.
2. Region policies, region-verification status, current competition, and enrollment.
3. Session creation, evidence events, completion, and authoritative progress.
4. Leaderboards, matches, sponsor campaigns, creator content, results, and payouts.
5. Contract/component tests for loading, empty, authorization, validation, timeout, retry, and server-error states, followed by device E2E coverage.

Run `npm.cmd run check`, `npx.cmd expo install --check`, `npx.cmd expo-doctor@latest`, `npm.cmd audit --omit=dev`, and a production web export before handing off a branch.

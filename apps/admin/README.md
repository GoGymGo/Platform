# GoGymGo Admin

Private operations dashboard for GoGymGo competitions, regional boundaries,
brand rewards, creator workouts, legal documents, system health, and audit
history.

## Access model

The operator portal is invitation-only and has two server-selected workspaces.
GoGymGo staff with the `admin` role enter the full platform console. Gym partners
with `gym_partner_admin` or `gym_partner_staff` roles enter a workspace limited
to their active `gym_partner_assignments`. There is no public registration or
social-provider login on this surface. GoGymGo creates each operator's
email/password account directly in the existing Firebase project and distributes
the initial credentials through an approved private channel.

Authentication alone does not grant access: every request is authorized again
by the GoGymGo API, which requires an active, email-verified database user and a
Firebase token whose sign-in provider is `password`. Full configuration routes
still require the `admin` role. Partner routes additionally verify the requested
gym against the user's active assignment; hiding a navigation item is never the
authorization boundary. A normal member or social-provider account therefore
cannot enter even with valid Firebase authentication.

Gym-partner administrators may manage QR posters for their assigned gyms and
create or edit gym-owned competition proposals while those proposals remain in
`draft`. GoGymGo administrators retain exclusive control of publication,
cancellation, rewards, regions, legal content, moderation, system health, and
global audit history. Partner staff have read-only gym and visit access.
Administrative changes require a reason, an idempotency key, and server-side
validation, and are recorded in the operator audit history.

## Local setup

Copy `.env.example` to `.env.local` and set the existing API and Firebase web
configuration values. Firebase web configuration is public client
configuration; no Firebase Admin credentials belong in this project.

```bash
npm install
npm run dev
```

The local dashboard runs at `http://localhost:3001` when the mobile app already
occupies port 3000.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm test
npm run audit:production-bundle
npm run audit:dependencies
```

`npm test` produces the deployable Vinext build and verifies the
server-rendered entry screen plus the critical authorization and mutation
safeguards.

The production-bundle audit blocks deployment if the vulnerable `image-size`
ICNS, HEIF, or JXL parser becomes reachable in the built admin artifact. The
dependency audit separately reports the two upstream build-tool advisories and
accepts only the dated exceptions in
`config/dependency-audit-exceptions.json`. Those exceptions expire on September
8, 2026, so the weekly Admin CI run will require an upgrade or a fresh security
review instead of allowing them indefinitely.

## Backend contract

The same-origin `/api/gogymgo/*` proxy forwards only `/v1/operator/*` requests
to `GOGYMGO_API_URL`. Firebase ID tokens are forwarded as bearer tokens; the
backend remains the sole authority for roles, validation, publication state,
and data persistence.

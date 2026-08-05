# GoGymGo Admin

Private operations dashboard for GoGymGo competitions, regional boundaries,
brand rewards, creator workouts, legal documents, system health, and audit
history.

## Access model

The dashboard is invitation-only for approved gym owners and GoGymGo regional
directors. There is no public registration or social-provider login on this
surface. GoGymGo creates each operator's email/password account directly in the
existing Firebase project and distributes the initial credentials through an
approved private channel.

Authentication alone does not grant access: every dashboard request is
authorized again by the GoGymGo API, which requires an active, email-verified
database user with the `admin` role and a Firebase token whose sign-in provider
is `password`. A normal member or social-provider account therefore cannot
enter the dashboard even if it has valid Firebase authentication.
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
npm audit --omit=dev
```

`npm test` produces the deployable Vinext build and verifies the
server-rendered entry screen plus the critical authorization and mutation
safeguards.

## Backend contract

The same-origin `/api/gogymgo/*` proxy forwards only `/v1/operator/*` requests
to `GOGYMGO_API_URL`. Firebase ID tokens are forwarded as bearer tokens; the
backend remains the sole authority for roles, validation, publication state,
and data persistence.

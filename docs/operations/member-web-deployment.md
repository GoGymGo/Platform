# Connected browser deployment

The browser app is the Expo web build of the mobile application, not a second
implementation. Browser and native clients share:

- the Firebase project and Firebase user ID;
- the Firebase ID-token bearer guard;
- the NestJS API contracts;
- the PostgreSQL/PostGIS database;
- account identity, avatar, verified region, agreements and enrollment;
- competition progress, sessions, leaderboards, rewards and social data.

Public identity and verified-region hydration read the backend first and keep
user-scoped device storage only as a resilience cache. Both providers refresh
from the backend when the app becomes active again.

## Free connected preview

From the repository root:

```powershell
.\tooling\scripts\start-free-preview.cmd
```

The launcher prints:

- a local browser URL;
- a secure phone/browser URL;
- a temporary public API URL.

Use the secure phone/browser URL when testing location verification. The local
LAN HTTP URL is a fallback for screens that do not need browser geolocation.

This preview uses the real database, API, worker and Firebase authentication.
The two Cloudflare Quick Tunnel URLs change after restart, and the computer,
Docker and Expo must remain running.

## Firebase Hosting preview

The static browser build is configured for Firebase Hosting in
`firebase.json`. Build and audit it before deployment:

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=1024'
npx.cmd expo export --platform web --output-dir dist
npm.cmd run audit:production-bundle -- dist
```

Deploy a time-limited preview channel:

```powershell
npx.cmd firebase-tools@15.25.0 hosting:channel:deploy connected-browser `
  --project gogymgo-8cb8b `
  --expires 7d
```

The hosted origin must be added to the API's exact `CORS_ORIGINS` list before
authenticated requests will succeed.

## Permanent user deployment

Firebase Hosting can provide the stable HTTPS frontend. A permanent launch also
requires an always-on HTTPS API and PostgreSQL/PostGIS service. Do not promote a
bundle containing a Quick Tunnel API URL to the live Hosting channel.

For a permanent release:

1. provision the production database and API runtime;
2. run migrations and the API readiness check;
3. configure exact frontend CORS origins and production secrets;
4. build Expo web with the permanent `EXPO_PUBLIC_API_URL`;
5. run the frontend, backend, contract and production-bundle gates;
6. deploy Firebase Hosting with `firebase deploy --only hosting`;
7. verify sign-in, profile/region restoration, enrollment, reads and a
   non-destructive write with a staging Firebase account.

Device permissions, notification registrations, unfinished form drafts and
active hardware evidence collection remain device-specific by design. Their
authoritative results are written to the shared backend.

## Standalone browser test preview

Use the standalone preview before the business, live competition and permanent
backend are ready. It exports the real Expo Router screens with sample data and
starts new visitors at the same welcome screen and required onboarding flow as
the mobile app. It does not create Firebase users, real entries or prize claims.

```powershell
npm.cmd run export:web-test-preview
npm.cmd run audit:web-test-preview
```

The generated site is written to `dist`. Opening `/` starts the guided
new-player flow. Opening `/test-preview` shows the screen directory and the
`START NEW PLAYER DEMO` action.

The preview build sets `EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW=true` only for
that export command. Store and permanent connected builds must leave the flag
false so Metro replaces every sample-data module with its production stub.

The exported preview also replaces the unfinished release legal documents with
short, clearly labeled browser-preview notices. `audit:web-test-preview` rejects
internal-draft wording and engineering fixture names. The separate store-release
audit intentionally remains blocked until the real operator, contact, privacy,
terms and contest-rule documents replace the source placeholders.

For a time-limited Firebase Hosting link:

```powershell
npx.cmd firebase-tools@15.25.0 hosting:channel:deploy browser-testing `
  --project gogymgo-8cb8b `
  --expires 7d
```

Firebase CLI sign-in is the only account login needed for that static testing
link. The standalone preview does not need Docker, the API or PostgreSQL.

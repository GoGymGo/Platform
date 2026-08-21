# GoGymGo landing site

Public marketing and signup site for `gogymgo.com`. It is a Sites-hosted
Vinext application and retains its existing project identity in
`.openai/hosting.json`.

## Local commands

From the monorepo root:

```powershell
npm.cmd run start:landing
npm.cmd run check --workspace @gogymgo/landing
```

Set `GOGYMGO_API_URL` to the public API origin. `/api/interest` validates and
forwards member and brand submissions to `/v1/interest-submissions`; the
landing application is not a source of truth.

The legacy D1 binding remains attached only until its historical submissions
are exported, idempotently imported into PostgreSQL, and count-verified. Follow
[`docs/operations/landing-data-migration.md`](../../docs/operations/landing-data-migration.md)
before removing that binding. Do not write new submissions to D1.

User journeys belong to the canonical member application:

- **Try Demo** -> `https://app.gogymgo.com/demo`
- **Join Beta** -> `https://app.gogymgo.com/join` (the live member-app account flow)

Do not add a second demo implementation or account database to this app.
For local cross-application testing, set `NEXT_PUBLIC_MEMBER_APP_ORIGIN` to the
local loopback member-app origin. A production build accepts only
`https://app.gogymgo.com`; a missing, malformed, non-HTTPS, private, preview, or
unapproved origin renders every member-app control unavailable.

`NEXT_PUBLIC_SEPTEMBER_PILOT_PUBLISHED=yes` is a release assertion, not a
calendar switch. Set it only for the exact landing build created after the
September Contest, current legal documents, and sole GoGymGo-sponsored $100 CAD
manual-handoff reward are approved and published. Missing or different values
keep registration and reward claims visibly closed. See
[`docs/operations/public-conversion-release.md`](../../docs/operations/public-conversion-release.md).

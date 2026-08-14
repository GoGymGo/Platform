# Gym streak rewards

The gym streak reward system is implemented end to end. PostgreSQL remains the
source of truth, the API derives streaks from verified workout sessions, and the
Expo home screen renders the authenticated result through the existing TanStack
Query data boundary.

## Reward rules

- Only completed `workout_sessions` rows with `status = 'verified'` that still
  satisfy the database-enforced session/enrollment/Contest/gym/rules identity
  contract earn streak credit. Inactive member accounts, withdrawn or
  disqualified participation, cancelled Contests, and future dates are excluded.
- A calendar period counts once even if more than one verified session exists in
  that period.
- Daily streaks use consecutive local calendar dates.
- Weekly streaks use consecutive Monday-through-Sunday weeks.
- Monthly and yearly streaks use calendar months and years.
- A streak stays active when its latest achievement is in the current period or
  the immediately previous period. This gives the member the full current
  period to add a new verified log.
- Older gaps reset that tier to zero. Each tier is calculated independently.
- The current approved region timezone is used for `asOfDate`. If no current
  verification exists, the latest verified workout's region is used, then UTC.

Pending-review, rejected, cancelled, and active sessions never unlock a badge.
The calculation spans competitions so changing competition months does not
silently reset a member's gym history.

## Database and API

The existing `workout_sessions.eligible_date` field is the durable local gym-log
date. No duplicate check-in table or denormalized counter is introduced. The
migration at `migrations/1783947600000_streak_query_index.ts` adds a partial
descending index on `(user_id, eligible_date)` for verified sessions. It uses
PostgreSQL's concurrent index path outside a transaction so a populated
`workout_sessions` table remains writable while the index is built.

The authenticated endpoint is:

```http
GET /v1/streaks/me
Authorization: Bearer <Firebase ID token>
```

```json
{
  "asOfDate": "2026-07-15",
  "timezone": "America/Vancouver",
  "streaks": {
    "daily": 3,
    "projectionVersion": "streaks-v1",
    "weekly": 4,
    "monthly": 2,
    "yearly": 1
  }
}
```

The backend feature lives in `src/modules/streaks/` and is registered in
`src/app.module.ts`. `streak-calculation.ts` is the pure calendar reference and
`streak-query.ts` performs the equivalent bounded PostgreSQL aggregation. Lists
are deduplicated and processed in batches of at most 100 member IDs, so clients
never load unbounded workout history or issue one query per Alias. The own route
uses the current approved region timezone, then the latest authoritative workout
region, then UTC. Public projections use the same fallback. When a profile
disables `showStats`, its actual counts are suppressed and required list DTOs
receive the canonical all-zero projection, which renders no compact badges.

## Frontend integration

The feature is already hooked into the home screen:

- `apps/member-app/src/domain/streaks.ts` defines the shared client contract.
- `apps/member-app/src/data/appData.ts` fetches `/v1/streaks/me` from the
  authenticated API and returns no streak record when services are unavailable.
- `apps/member-app/src/data/appDataHooks.tsx` exposes `useMyStreaks()`.
- `apps/member-app/src/components/streakRewards.tsx` renders the responsive badge
  grid and the canonical at-most-two Alias strip using only GoGymGo theme tokens.
- `apps/member-app/app/(tabs)/home/index.tsx` places the badge panel below the active
  workout card.

Daily, weekly, monthly, and yearly badges use the established cyan, success,
pink, and warning token families. A zero count uses the existing muted border,
surface, text, and opacity language and displays `LOCKED`.
Only an authoritative all-zero `streaks-v1` response may display that locked
state. Loading, malformed, and failed responses display unavailable/retry state
and never reuse a local or cached count as authority.

## Local migration and verification

From the repository root in PowerShell:

```powershell
Set-Location '.\backend'
Copy-Item .env.example .env # only when .env does not already exist
npm.cmd install
npm.cmd run migrate:up
npm.cmd run check

Set-Location '.\apps\member-app'
npm.cmd install
npm.cmd run check
npm.cmd run web
```

Set the mobile app's existing API environment values as described in
`apps/member-app/.env.example`. Sign in with a Firebase account and open Home. The
badges refresh through TanStack Query whenever the query becomes stale or the
app regains focus.

For a built deployment artifact, run migrations before routing traffic to the
new API revision:

```powershell
Set-Location '.\backend'
npm.cmd run build
npm.cmd run migrate:deploy
```

`migrate:deploy` reads `DATABASE_URL` and applies the compiled migration from
`dist/migrations`. The migration adds one index concurrently and does not
rewrite reward source data or alter API-visible records.

## Test coverage

- Unit tests cover empty, active, grace-period, duplicate-period, stale, future,
  invalid-date, cross-year Monday-week, batching, and compact display behavior.
- HTTP end-to-end coverage proves the route is protected by authentication.
- Database integration coverage verifies the partial index and exercises the
  exact verified-workout projection, latest-session timezone fallback, and
  public-stat privacy after all migrations. Run it with Docker available and
  `$env:RUN_DATABASE_INTEGRATION='true'; npm.cmd run test:integration`.
- Frontend data-boundary tests cover unavailable and authenticated API modes.

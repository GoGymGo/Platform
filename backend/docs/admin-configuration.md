# Administrative configuration operations

GoGymGo configuration changes are authenticated server operations, not direct database edits or Expo-controlled settings. Every command requires a Firebase bearer token, an `Idempotency-Key`, a Firebase-verified email, and an active database user with the exact `admin` role. The database role is authoritative; token claims cannot promote an existing account.

## Supported commands

All routes use the `/v1/operator/configuration` prefix:

- `POST /region-policies` creates one immutable, time-bounded policy version. PostgreSQL rejects overlapping versions for the same region code and invalid PostGIS boundaries.
- `POST /competitions` creates a draft with its complete rules, schedule, entrant limits, and goal brackets.
- `PUT /competitions/:id` replaces a draft when `expectedVersion` matches.
- `POST /competitions/:id/status-action` publishes or cancels a competition when `expectedVersion` matches.
- `POST /creator-workouts` creates an unpublished workout.
- `PUT /creator-workouts/:id` replaces an unpublished workout when `expectedVersion` matches.
- `POST /creator-workouts/:id/status-action` publishes or unpublishes a workout when `expectedVersion` matches.

Competition publication requires a future registration close and start, a region policy covering the full lifecycle, enabled competition operations, at least one goal bracket, and at least one published catalog reward. Creator workout publication requires absolute HTTPS media URLs and currently enabled target regions.

The worker changes a published competition from `registration` to `active` at its start time. If the competition is below `minimumEntrants`, it instead cancels the competition, withdraws active enrollments, queues a neutral cancellation notification, and records an append-only audit event.

## First administrator bootstrap

There is deliberately no public role-grant endpoint. A user must verify their Firebase email and sign in once so the database identity exists. Then an infrastructure owner with direct secret-manager and production database access runs the audited, one-time bootstrap command from a trusted administrative environment:

```powershell
$env:BOOTSTRAP_ADMIN_FIREBASE_UID='<firebase uid>'
$env:BOOTSTRAP_ADMIN_REASON='<approved change-ticket reason>'
$env:CONFIRM_BOOTSTRAP_ADMIN='yes'
npm.cmd run admin:bootstrap
```

`DATABASE_URL` must already come from the runtime secret manager. Do not place any of these values in source control, shell scripts, CI logs, or Expo environment variables. The command is idempotent, does not print the Firebase UID, and records `user.admin_bootstrapped` in the append-only operator audit ledger.

After the first bootstrap, role administration should be implemented as a separate, dual-approval security workflow before additional administrators are delegated. Do not broaden the configuration endpoints to grant roles.

## Deployment checks

1. Apply migrations before deploying API or worker code.
2. Confirm the PostGIS and `btree_gist` extensions are available.
3. Run one API process and at least one worker process from the same release image.
4. Verify the worker reports competition activation/cancellation counts.
5. Keep the OpenAPI artifact and mobile contract audit from the same commit.
6. Test an idempotent draft creation and version-conflict response in staging.
7. Review the append-only audit event before promoting production configuration.

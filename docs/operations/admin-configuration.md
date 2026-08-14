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
- `POST /rewards` creates a draft sponsor reward with an approved image, terms,
  exact inventory, availability window, and one permitted claim path.
- `PUT /rewards/:id` replaces a draft when `expectedVersion` matches.
- `POST /rewards/:id/coupon-codes` adds NFKC-normalized, encrypted codes to a
  draft coupon reward when `expectedVersion` matches and returns the advanced
  version. It never returns plaintext inventory.
- `POST /rewards/:id/status-action` publishes or archives a reward when
  `expectedVersion` matches. Publication requires complete coupon inventory,
  approved HTTPS image and terms, and an eligible competition/region.

Reward fulfillment routes use the `/v1/operator` prefix:

- `POST /reward-awards/:awardId/status-action` cancels an unclaimed award,
  fulfills a claimed physical reward, or redeems a claimed coupon. The request
  includes `expectedVersion` and a specific audit reason.

The dashboard award list is fulfillment-safe metadata only. Verify winner
callsign, rank, reward type, status, and version before confirming an action.
Coupon plaintext, ciphertext, fingerprints, and member claim instructions are
intentionally absent. Retrying a lost response must reuse the same
`Idempotency-Key`; a stale version requires refresh and review.

Contest-specific Partner-gym poster routes use the `/v1/operator` prefix:

- `POST /competitions/:competitionId/gym-locations/:gymId` assigns one active
  gym in the exact Contest region; this remains platform-admin only.
- `POST /competitions/:competitionId/gym-locations/:gymId/qr-credentials`
  issues or reissues one expiring poster. A partner needs active `admin` access
  to that exact gym; staff access is read-only.
- `GET /competitions/:competitionId/gym-locations/:gymId/qr-credentials/active`
  recovers only the current nonexpired poster for an active, assigned gym and
  enabled region.
- `GET /competitions/:competitionId/gym-locations/:gymId/qr-credentials` lists
  scoped lifecycle history without the public enrollment payload.
- `POST /competitions/:competitionId/gym-locations/:gymId/qr-credentials/revoke`
  immediately retires the active poster and preserves its audit history.

Issue, assignment, and revocation commands require a reason and an
`Idempotency-Key`. A browser retry after a network error, server error, or
in-progress response must reuse the same key. Verify the preview's exact
Contest, gym, version, and expiry before printing; revoke all test-era posters
before distributing a real artifact.

Competition publication requires registration to be open already, with its close and Contest start still in the future. The enabled region policy must cover the full lifecycle; current owner-approved Privacy, Terms, and Official Contest Rules must resolve for its exact jurisdiction; at least one goal bracket and published catalog reward must exist; and the currently supported verification policy must require an assigned active Partner gym with an active contest-specific QR credential. A future registration window remains a draft until an operator intentionally publishes it after the window opens. Creator workout publication requires absolute HTTPS media URLs and currently enabled target regions.

The worker changes a published competition from `registration` to `active` at its start time. If the competition is below `minimumEntrants`, one locked transaction instead cancels the competition, withdraws active enrollments, cancels active workouts and open Weekly Challenge participation, queues neutral cancellation notifications, and records one append-only audit event. A notification enqueue or audit failure rolls back the whole transition so a worker retry can safely complete it without duplicate effects. Manual cancellation uses the same participation cleanup.

After the contest end and its 15-minute workout completion period, the contest
home exposes one **Finalize + publish results** confirmation. The dashboard
generates a cryptographically random draw seed, commits the locked entrant
snapshot through `POST /v1/operator/draws/lock`, then reveals that same seed
through `POST /v1/operator/draws/:drawId/settle`. An interrupted publication
keeps the pending reveal in the signed-in browser so the same audited draw can
be resumed; do not clear browser storage while a contest says **Draw locked**.
Successful settlement changes the contest to `settled` and makes its exact
participant results available in the member Winners Circle.

Locking the draw is also the scoring reconciliation boundary. In the same
transaction, the API settles every remaining scoring period, reconstructs each
member's progress from the append-only entry ledger, and compares verified-day
entries with the exact eligible verified sessions. It refuses to lock on any
negative total, session/ledger mismatch, unresolved workout, or invalid scoring
input. A successful lock stores both the draw-entry snapshot and the complete
versioned scoring inputs (goal, verified days, category score/rank, longest
streak, prize entries, rules version, and deterministic tie digest). The audit
event records the scoring and entrant snapshot hashes plus the number of
reconciled progress rows. Retrying the same request and seed commitment returns
the same locked snapshot; a different commitment is rejected.

Weekly Challenge partners are never an operator selection. Operators configure
only the versioned Contest multipliers and use the existing lifecycle/finalize
preflight. Before finalization, verify every paired match references one
accepted direct request, each player appears in at most one assignment for the
week, all pending requests for closed weeks are cancelled, and projected member
values are not counted as banked ledger entries. A provenance, participant, or
session/ledger reconciliation failure must fail finalization closed; investigate
the originating request, relationship, enrollment, or session and retry the
same operation after an audited forward fix. Never insert a partner, edit a
match outcome, or repair the ledger directly.

Before revealing the seed, operators must verify the entrant count, total
entries, and both 64-character snapshot hashes shown by the lock response. Do
not repair `competition_progress`, `entry_ledger`, draw entries, or settlement
inputs with direct database edits. Investigate the originating session or
ledger event and rerun the idempotent lock after the data-integrity issue has
been corrected through an audited operational procedure.

## First administrator bootstrap

There is deliberately no public role-grant endpoint. A user must verify their Firebase email and sign in once so the database identity exists. Then an infrastructure owner with direct secret-manager and production database access runs the audited, one-time bootstrap command from a trusted administrative environment:

The first production administrator is deliberately restricted to the owner
identity stored as `GOGYMGO_OWNER_EMAIL` in the protected runtime secret manager.

```powershell
$env:GOGYMGO_OWNER_EMAIL='<protected owner email>'
$env:BOOTSTRAP_ADMIN_EMAIL=$env:GOGYMGO_OWNER_EMAIL
$env:BOOTSTRAP_ADMIN_REASON='<approved change-ticket reason>'
$env:CONFIRM_BOOTSTRAP_ADMIN='yes'
npm.cmd run admin:bootstrap --workspace @gogymgo/api
```

`DATABASE_URL`, `FIREBASE_PROJECT_ID`, the runtime Firebase Admin credential,
and `GOGYMGO_OWNER_EMAIL` must already come from the trusted runtime identity or
secret manager. Do not place any of these values in source control, shell
scripts, CI logs, or Expo environment variables. The command resolves the
already-created database user by email and Firebase UID, verifies that Firebase
still reports the exact enabled, email-verified account with a password
provider, and rejects any partner role or active gym assignment. It is
idempotent and records `user.admin_bootstrapped` in the append-only operator
audit ledger only when it makes the material role change.

Publishing and withdrawing a legal document are additionally restricted to
this configured owner identity. Publication requires explicit approval of the
exact immutable version. Unapproved legacy documents are not returned by the
member legal API. Legal records cannot be deleted from the operator API or
dashboard; withdrawal preserves immutable content, approvals, events, and
receipt history while returning resolution to the prior current version.

After the first bootstrap, administrator delegation remains deliberately
fail-closed and owner-operated. A separate, explicitly approved product and
security requirement must define the second-person approval lifecycle before
additional administrators can be delegated. No such dual-approval workflow is
implemented here; do not broaden configuration endpoints or the partner tool to
grant `admin`.

## Issuing operator logins

Operator logins are issued directly by GoGymGo only to approved gym owners and
GoGymGo staff. The portal has no registration flow and does not accept Google or
Apple sign-in. The API also rejects portal requests when the Firebase token's
sign-in provider is anything other than `password`.

For each approved operator, a production owner must:

1. Record the approval, operator type, intended access, and accountable
   GoGymGo sponsor in the private access register.
2. Create an email/password user in the production Firebase console with a
   verified operator email. Do not reuse a member or shared team account.
3. Deliver the initial credentials through an approved private channel and
   require the operator to sign in once so the database identity is created.
4. For GoGymGo staff, grant the database `admin` role only through the audited
   infrastructure workflow. For a partner, run the scoped assignment command
   below and never grant `admin`. Never add a public role-grant endpoint or
   trust Firebase token claims as the authorization source.
5. Confirm a normal member account is denied, a partner can retrieve only its
   assigned gyms, and a GoGymGo administrator can enter the full console. Retain
   that evidence with the access approval.

The `admin` role always opens the full-administration surface and must never be
used for a gym-scoped operator. Gym partners use `gym_partner_admin` or
`gym_partner_staff` plus an active per-gym assignment. Provision or revoke that
assignment from a trusted administrative environment:

```powershell
$env:PARTNER_OPERATOR_EMAIL='<verified partner email>'
$env:PARTNER_GYM_LOCATION_ID='<assigned gym UUID>'
$env:PARTNER_ACCESS_LEVEL='admin' # or staff
$env:PARTNER_ACCESS_ACTION='grant' # or revoke
$env:PARTNER_ACCESS_REASON='<approved access-ticket reason>'
$env:CONFIRM_PARTNER_ACCESS='yes'
npm.cmd run partner:access --workspace @gogymgo/api
```

The partner must first sign in once with the GoGymGo-issued Firebase password
account so the database identity exists. Before changing PostgreSQL, the command
uses the trusted Firebase Admin runtime to verify that the exact UID/email is
enabled, email-verified, and has a password provider; social-only, disabled,
suspended, platform-admin, or specialist-operator identities fail closed. The
command locks the database user and assignment, derives role flags from all
active exact-gym assignments, and records each material grant, access-level
change, revocation, or role reconciliation in the append-only operator audit
ledger with the supplied reason. Repeating an already completed grant or
revocation is an idempotent no-op. Partner competition proposals are always gym
scoped and remain drafts until a GoGymGo administrator publishes them.

## Deployment checks

1. Apply migrations before deploying API or worker code.
2. Confirm the PostGIS and `btree_gist` extensions are available.
3. Run one API process and at least one worker process from the same release image.
4. Verify the worker reports competition activation/cancellation counts.
5. Keep the OpenAPI artifact and mobile contract audit from the same commit.
6. Test an idempotent draft creation and version-conflict response in staging.
7. Review the append-only audit event before promoting production configuration.
8. Confirm poster history contains no QR payload, a scoped staff account cannot
   issue or revoke, and a revoked/expired poster immediately fails a member
   enrollment attempt without changing enrollment state.
9. Rehearse one complete Contest calendar in staging: every local-day and weekly
   boundary, duplicate and disallowed sessions, late enrollment, direct
   accepted-friend pairing plus solo settlement, Bonus Day, Perfect Month,
   reconciliation replay, draw-lock replay,
   and recovery from an unresolved review. Retain the scoring/entrant hashes,
   audit event, settlement-input count, and exact release commit as evidence.

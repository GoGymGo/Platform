# Privacy operations and local-device reset

## Outcome

Deliver one auditable privacy lifecycle: an authenticated member explicitly
confirms an export or deletion request, an authorized operator records a
versioned decision, and a leased worker completes private export or deletion
work without overstating external cleanup. Keep the separate device reset
strictly local to GoGymGo-owned state.

## Boundaries

- `PRIVACY_OPERATIONS_ENABLED=false` remains the fail-closed default. Neither
  the member app nor an operator can claim that a request was accepted while
  processing is disabled.
- The bearer identity owns create/list/detail/download operations. The client
  supplies no user ID and must send the exact operation confirmation
  `EXPORT_MY_DATA` or `DELETE_MY_ACCOUNT`.
- Operator decisions require a password-authenticated, verified, unscoped
  database operator role, a reason, stable idempotency key, and the current
  request version. Replays return the stored decision; changed bodies or stale
  versions fail closed.
- The worker owns processing through a bounded renewable lease. Every external
  identity/object boundary is bracketed by a lease renewal, and completion or
  failure recording is conditional on the same unexpired token.
- Export format `12` is a deterministic, minimized JSON document in a dedicated
  private object bucket. A compile-time disposition map forces every current
  database table to receive an export and deletion decision.
- Firebase identity and S3 object removal happen before database erasure and
  must actually succeed (or report idempotent absence). The database cannot
  manufacture success for unavailable external cleanup.
- Local reset signs out, clears TanStack Query and GoGymGo/Firebase app
  namespaces, recovery keys, owned cookies, and owned caches. It does not call
  the privacy-request API and must preserve unrelated device/browser data.

## Data disposition

- Export includes owned account/profile/legal/consent, region, Contest,
  workout, ledger, reward, social, Creator, Partner, notification, media, and
  privacy-request records introduced through the current migration ledger.
- Export omits bearer/provider credentials, token and credential hashes,
  reusable QR material, push tokens, coupon inventory, object keys, internal
  moderation/operator evidence, free-text fulfillment notes, and other users'
  identifiers. Heart-rate events retain only the numeric sample.
- Deletion removes direct identity, private media and exports, notification and
  push data, local idempotency records, owned social/private Creator content,
  assignments, plans, and submissions. It redacts free text and region/session
  evidence before pseudonymizing the user/profile and related operational rows.
- Only documented pseudonymous receipt, consent, verified-workout, Contest
  scoring/settlement/draw, reward, fraud/integrity, and operator-audit facts are
  retained. Published draw Alias/streak snapshots remain immutable historical
  result evidence; they are no longer linked to direct account identifiers.

## Rollout

1. Apply `1787706000000_privacy_request_integrity.ts`. It adds explicit
   confirmation evidence, optimistic versions, terminal/transition triggers,
   and removes historical free-text/hash metadata from the append-only entry
   ledger. Preexisting unconfirmed active requests are rejected, not silently
   confirmed.
2. Deploy the worker and API from the same immutable artifact after migration.
   Keep privacy operations disabled while checking worker heartbeat, private
   buckets, signing/IAM, lifecycle, Firebase administrator credentials,
   pseudonymization secret, alerting, backup/restore, and cleanup rehearsal.
3. Enable only through the protected environment after counsel-approved
   retention/hold policy and staging export/deletion/restore/incident rehearsal.
4. Publish matching generated contracts, member/admin artifacts, and the public
   account-deletion instructions. Confirm disabled, pending, processing,
   retrying, rejected, completed, expired-download, and local-reset states.

## Validation

- Unit tests cover confirmation mismatch, disabled behavior, body-bound
  idempotency, authorized decision shape, stale versions, lease renewal/loss,
  minimized v12 payloads, deterministic object identity, private presign TTL,
  expiry purge, and namespace-only reset isolation.
- Migrated PostgreSQL tests cover ownership, duplicate-active conflict,
  confirmation/version constraints, terminal immutability, lease expiry and
  takeover, completion ownership, full export fixtures, deletion FKs and
  pseudonymous retention, external cleanup retry, and object reconciliation.
- Member/admin/landing source and rendered tests cover route reachability,
  accessible confirmation, authoritative loading/empty/error/retry states,
  unavailable behavior, expiry and deletion copy, versioned decisions, and the
  distinction between local reset and server erasure.
- Final gates run generated-contract drift, formatting, lint/typecheck, unit and
  DB-disabled integration suites, builds, source/artifact/security/privacy and
  secret audits. Docker/Testcontainers gates require separate authorization.

## Observability

The worker heartbeat and system-health queue expose processing counts. Attempt
failures store a bounded code, attempt number, and next retry time, never raw
exceptions or exported/member payloads. Immutable request events capture
status transitions without operator reasons; the protected operator audit owns
the reason and before/after version. Export expiry deletion is measured even if
bucket lifecycle cleanup lags.

## Recovery

Keep the forward integrity migration during application rollback. Expired
leases become reclaimable; deterministic object keys, create-only writes,
idempotent deletes, pseudonymization, and conditional completions make retries
safe. Do not use a down migration in production. If identity/object cleanup is
uncertain, leave the request in processing with a safe retry code, restore the
required integration, reconcile, and only then complete database erasure. If
retention policy or pseudonymization-key integrity is in doubt, disable privacy
operations and follow counsel/security incident review before resuming.

# GGG-018 competition reminders and push lifecycle

## Outcome

Let a member explicitly opt into bounded Weekly Goal, Weekly Challenge and Bonus
Day reminders, see the exact permission, Contest timezone, local schedule and
remote-registration state, and turn local and remote delivery off together.
Harden push registration, rotation, delivery retries and operational evidence
without exposing tokens or claiming that a disabled provider is available.

## Boundaries

- The member app owns permission prompts, the stable local installation ID,
  Contest-timezone schedules, strict API response decoding and accessible state.
  Browser and App Tour modes never call native notifications or acquire a token.
- The API owns authenticated device registration/rotation, owner-scoped disable,
  a five-device cap, event deduplication, immutable target snapshots, fenced
  leases, bounded attempts/backoff, safe provider-ticket classification and
  token minimization. Provider responses, messages and credentials are neither
  persisted nor returned.
- Admin changes are limited to the existing protected system-health projection:
  notification stale leases become separately visible. No device, token,
  provider payload or member notification content enters the admin contract.
- `PUSH_NOTIFICATIONS_ENABLED=false` remains the default. Local reminders may
  work while remote delivery is disabled, but the UI must say so. No repository
  test contacts Expo, Firebase or another provider.

## Rollout

1. Apply `1788051600000_notification_lifecycle_integrity.ts`. It adds stable
   installation identity, nullable/minimized disabled tokens, bounded device
   progress, event dedupe and delivery constraints. Deploy API and worker from
   the same immutable artifact after the migration.
2. Keep remote push disabled. Confirm the API returns disabled capability while
   native local schedules continue to identify permission, quiet/provisional
   authorization, exact timezone, reminder times and scheduled count.
3. Configure final EAS project ownership and protected worker-only Expo access
   outside source control. Enable only in an authorized staging environment
   after real-device permission, background, rotation, logout, provider failure,
   partial-ticket, lease-expiry and retry UAT.
4. Enable production only through protected environment approval after alerts,
   incident ownership and staging evidence are accepted. A configured flag is
   not proof that a notification reached a device.

## Validation

- Member unit/source tests cover explicit opt-in, denied/provisional/unavailable
  permission, provider-off local-only behavior, timezone/DST resolution,
  schedule bounds, strict response decoding, disable retry, App Tour isolation,
  sign-out and namespace reset behavior.
- API unit tests cover capability gating, replay reauthorization, strict fake
  Expo ticket decoding, bounded batches, event dedupe, device snapshots,
  accepted/invalid/retryable outcomes, token minimization, backoff and lease
  fencing. Admin decoder/render tests cover the new stale-lease count.
- Generated OpenAPI/contracts, formatting, lint, typecheck, unit and DB-disabled
  integration suites, builds, source/privacy/secret/dependency/artifact audits
  run serially. Docker/Testcontainers/PostgreSQL proof requires separate fresh
  authorization.

## Recovery

Keep the additive migration applied during application rollback. Disable
`PUSH_NOTIFICATIONS_ENABLED` to stop new provider calls while preserving local
reminders and durable delivery evidence. Expired leases are reclaimed; target
snapshots and per-device completion prevent already-recorded accepts from being
resent, while attempts exhaust after five safe-code failures. Expo acceptance
is still at-least-once: an ambiguous timeout before the fenced database update
can duplicate a generic notification carrying the same stable notification ID.
Do not mark uncertain provider work sent; restore the integration and reconcile
the durable item forward.

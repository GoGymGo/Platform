# GGG-022 review queues and operational health

## Outcome

Give an authorized, password-authenticated GoGymGo operator one authoritative
view of every current human-review domain and every durable worker queue. Queue
items are globally ordered and cursor-paginated, detail reads are minimized and
server-derived, decisions are reasoned, body-bound, idempotent and
optimistically versioned, and audit history is searchable without exposing
credentials or private payloads. Operational health distinguishes database,
worker, queue, lease and provider-configuration evidence without probing an
external provider or claiming a production service is healthy.

## Boundaries and domain inventory

- Human review includes pending workout sessions, current device-location
  region verifications, Partner applications, privacy requests, moderated
  profile media, Creator video submissions and region-waitlist outreach.
- Reward fulfillment, Contest/draw, legal, region-policy, Creator catalog and
  Partner-gym configuration stay in their existing versioned administrative
  workflows. They remain visible through audit history and Contest alerts but
  are not duplicated as human-review queue items.
- Landing interest submissions are read-only contact leads with no persisted
  lifecycle or permitted decision. Member friend, Weekly Challenge and social
  invitation states are member-owned. Neither is represented as operator review
  work until a separately approved authoritative workflow exists.
- Member applications receive only their own authoritative pending, retry,
  error or terminal state. Operator identity, reasons, queue metadata, signed
  media review actions and private application content never cross into member
  responses, App Tour data or demo fixtures.
- Provider status is one of disabled, configured or unavailable. Configured
  means the protected runtime says the feature is enabled; it is not a network
  probe or an availability promise. Unavailable requires durable local failure
  evidence. No test contacts Expo, S3, Firebase, OTLP or another provider.

## Data and API changes

1. Apply one forward-only migration that adds optimistic review versions to
   every operator-owned review table, durable lease/retry/failure fields for
   profile-media cleanup, and indexes for global queue/audit traversal.
2. Return a bounded global work-queue page with one opaque cursor, authoritative
   versions and stable ordering across all included domains. A separate detail
   read returns only the fields needed for the selected domain and the exact
   decisions currently permitted by server state.
3. Bind each decision key to the exact kind, record, expected version, decision,
   reason and any evidence/expiry input. Re-authorize the database operator on
   every request and replay; stale versions, changed bodies, changed evidence,
   invalid state transitions and self-review fail closed.
4. Return audit pages from append-only rows with bounded filters and an opaque
   cursor. A shared recursive minimizer removes credential, token, object,
   identity, contact and private-payload fields from before/after projections.
5. Expose factual review/worker queue depths, active and expired leases,
   scheduled retries, exhausted work, the durable worker heartbeat/result, and
   feature/provider configuration evidence. The existing liveness/readiness
   endpoints remain the public database/worker gate.

## Worker recovery and observability

- Notification and privacy work retain token-bound leases; expired leases are
  reclaimable and surfaced separately from active leases. Completion/failure
  remains conditional on the current token.
- Profile-media cleanup gains the same bounded claim, lease, attempt, safe
  failure-code and retry model. Signed URLs, object keys and exception messages
  are absent from health and audit responses.
- Worker heartbeat writes are fenced to the current instance so an older
  process cannot overwrite a replacement. A successful batch with durable item
  failures is degraded rather than silently healthy.
- Existing configured worker-stale and retry timings remain authoritative. This
  change does not invent SLOs, alert destinations or production health claims.

## Validation

- Unit tests cover cursor bounds/order, detail minimization, transition tables,
  self-review, expected-version conflicts, changed-body replay, recursive audit
  redaction, provider disabled/configured/unavailable states, stale heartbeat,
  expired-lease recovery and fenced heartbeat writes.
- Admin tests cover runtime decoding, loading/empty/error/retry/disabled/stale
  presentation, accessible detail/action controls, server pagination and
  Contest-home operational alerts. Member/source tests prove operator data and
  demo fallbacks are absent from member artifacts.
- Generated OpenAPI/contracts, migration replay, API/admin/member tests,
  workspace checks/builds, critical journeys, source/privacy/secret audits and
  production-artifact audits run serially. Docker/Testcontainers/database-backed
  validation requires fresh user authorization before any command is run.

## Rollout

Deploy migration, worker, API and admin from the same reviewed artifact. Keep
privacy, profile-media and notification providers disabled until their existing
environment-specific release gates pass. Rehearse a claimed lease expiring,
replacement-worker takeover, provider failure, changed-body retry, stale review
decision and audit lookup in an authorized staging environment before enabling
production workflows. Configure alert ownership and destinations outside the
repository; their absence remains an explicit release blocker.

## Recovery

The migration is additive and stays applied during an application rollback.
Expired leases are recovered forward; append-only audit and decision history is
never rewritten. If a provider result is uncertain, leave the durable item
retryable or failed, restore the integration, and reconcile with the same
operation identity. Roll back clients independently only while the API continues
to fail closed; otherwise roll worker/API together to a schema-compatible
artifact and correct forward.

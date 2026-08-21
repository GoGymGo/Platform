# Review queues and operational health

This runbook covers the repository-owned human-review, audit, and worker-health
surfaces. It does not establish an SLO, an alert destination, or evidence that a
deployed provider is healthy. Production alert ownership and an authorized
staging rehearsal remain release gates.

## Access and trust boundary

Every route in this document requires a Firebase token from a verified password
sign-in and a current, active database `admin` role. The API resolves that role
for every request, including an idempotent replay. A client capability, cached
queue item, or Firebase custom claim cannot grant access. An administrator may
inspect work created by their own member identity, but the detail response
declares `decisionAllowed: false` with `self_review`, and the mutation rejects
the decision after reauthorization.

The admin client treats queue, detail, audit, and health JSON as untrusted. It
runtime-validates the response, renders only an allow-list of facts for the
declared domain, and offers only the server's `allowedDecisions`. Invalid or
unknown response shapes fail closed with a retry state.

## Authoritative review inventory

`GET /v1/operator/work-queue` returns an ascending, globally ordered page. The
opaque cursor binds the final `(createdAt, kind, id)` tuple, so later inserts do
not shift the next page. `limit` defaults to 50 and the server caps it at 100.
`kind` may select one row of the following table. Fetch the selected record from
`GET /v1/operator/work-queue/{kind}/{id}` before deciding it.

| Queue kind | Included state | Server-declared transitions |
| --- | --- | --- |
| `workout_session` | `pending_review` | `verified`, `rejected`, bound to the evidence snapshot |
| `region_verification` | pending current-policy reviews, plus visibly stuck stale/unsupported reviews | `approved`, `rejected` only when the policy and method remain eligible |
| `partner_application` | `submitted`, `in_review` | `in_review`, `approved`, `rejected` as allowed by current state |
| `privacy_request` | `requested`, and processing/retry/stale work for observation | `processing`, `rejected` only while requested |
| `profile_media` | completed `pending_review` media | `approved`, `rejected` |
| `creator_submission` | `submitted`, `in_review` | `in_review`, `approved`, `rejected` as allowed by current state |
| `region_waitlist` | `waiting`, `contacted`, `launched` | only the current waitlist transition set |

Reward fulfillment, Contest/draw, legal publication, region-policy changes,
Creator catalog configuration, and Partner-gym configuration retain their
existing versioned admin workflows. They are audit-visible but are not
duplicated in this queue. Landing interest submissions are read-only leads with
no authoritative decision lifecycle. Social invitations, friends, and Weekly
Challenges are member-owned. Do not treat those exclusions as missing work or
invent operator actions for them.

## Decision procedure

1. Refresh the queue and fetch its detail. Confirm the kind, ID, current status,
   `reviewVersion`, `decisionAllowed`, and `allowedDecisions` from that response.
2. Review only the minimized detail. Profile media requires the explicit
   short-lived review action for the current review version. Confirm its
   server-verified MIME, byte count, dimensions, digest, and expiry before
   opening the private preview; approval stays disabled until that action is
   loaded. Never copy its URL into a ticket, reason, log, or audit note. Session
   review requires the returned evidence digest and typed findings rather than
   raw location or device evidence.
3. Submit a permitted transition with an operational reason, the returned
   `expectedVersion`, and a new idempotency key. The key is bound to the complete
   decision body, including evidence fields. A different body with the same key
   fails. A changed version or state returns a conflict; refresh and review the
   authoritative record instead of retrying stale input.
4. Confirm the returned state and locate the minimized event in
   `/v1/operator/audit-history`. Do not infer success from a button state or a
   network timeout.

Waitlist decisions use `/v1/operator/region-waitlist/{id}/status`; all other
decision routes are represented in the generated OpenAPI document. Repeating an
identical successful request is safe only while the caller remains authorized.

## Audit search and minimization

`GET /v1/operator/audit-history` accepts `search`, `action`, `entityType`,
`cursor`, and `limit`. Search is bounded to 2–100 characters, action and entity
type to 100, the cursor to 1,024, and the page to 1–100 rows. Pages use an opaque
descending `(createdAt, id)` cursor. Use server search and cursor pagination;
local filtering is not complete history.

The response recursively removes identity/contact fields, credentials, bearer
tokens, QR payloads, coupon/reward codes, claim or object URLs, encrypted
material, precise location, free-text notes/messages, private payload/content,
and other sensitive keys. Remaining strings, object keys, arrays, and nesting
are bounded. Reasons are redacted and bounded. If a required investigation
needs excluded private evidence, follow the domain-specific authorized process;
do not broaden this endpoint or paste the data into an audit reason.

## Reading system health

`GET /v1/operator/system-health` first proves a database read. If that read
fails, the request fails; the API does not fabricate a database status. A
successful response contains:

- human-review depths for all seven domains;
- durable notification, privacy, profile-media-cleanup, competition, session,
  and social work counts, including applicable active leases, scheduled retries,
  exhausted work, and separately counted expired/stale leases;
- the durable worker heartbeat state: `starting`, `healthy`, `stale`, or
  `degraded`, plus bounded last-completion/failure evidence; and
- notification, privacy, profile-media, and observability provider state.

Provider state is deliberately limited to `disabled`, `unconfigured`,
`unavailable`, or `configured`. `configured` means required protected
configuration is present and no durable failure is recorded; it is not a
network probe or availability claim. `unavailable` is derived from durable
failed work. Tests and this endpoint do not contact providers.

Treat `starting` as no completed worker heartbeat yet. Treat `stale` according
to the configured worker-staleness boundary, not an operator-invented timer.
Treat `degraded` as a completed worker pass that recorded a durable batch or
item failure. Active leases are not failures; expired leases must be reclaimable
by the next worker, while token-fenced completion prevents the older owner from
overwriting the replacement.

## Triage and recovery

- Database request failure: stop decisions and investigate the database/readiness
  path. Do not describe queues as empty.
- Worker `starting` or `stale`: verify the intended worker revision is running,
  compare the durable instance/heartbeat, and preserve lease evidence. A
  replacement must acquire the current instance identity before reporting work.
- Worker `degraded` or exhausted/retry work: use the bounded failure code and
  affected durable counts. Never paste exception text, provider payloads, object
  keys, tokens, or member content into an incident record.
- Expired privacy/profile-media lease: allow normal token-bound reclamation and
  confirm the older token cannot complete. Do not manually mark the item done.
- Provider `disabled` or `unconfigured`: keep the feature disabled until its
  existing security, privacy, and environment gates pass. Do not generate a
  credential to silence health.
- Provider `unavailable`: restore the integration, preserve the durable retry,
  and reconcile with the same operation identity. Do not claim delivery,
  deletion, or cleanup from a timeout.

Before production enablement, an authorized staging owner must rehearse a stale
review conflict, a changed-body idempotency conflict, expired-lease takeover,
partial worker failure, provider-disabled and unavailable displays, audit
lookup, and retry recovery using approved disposable fixtures. Retain the exact
release commit and sanitized results. Repository tests do not satisfy deployed
alerting, access, provider, or operational UAT.

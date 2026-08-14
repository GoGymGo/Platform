# Social privacy and private invitation operations

## Provider and cloud boundary

Private contact invitations are link creation only. The API never invokes an
email or SMS provider and never describes a link as sent or delivered. The
member app may invoke the local operating-system share sheet or copy action;
dismissal/failure remains visible and retryable. This capability has no AWS or
other cloud-provider mutation by itself.

## Data and retention

- Raw destinations exist only for request normalization and token-bound hashing.
- API logs redact `body.destination` and `body.token`. Telemetry must never add
  either value or a full join URL as an attribute.
- PostgreSQL keeps only the masked hint, link-only delivery mode, token version,
  cryptographic hashes, timestamps, status, inviter, and eventual claimant.
- Pending links expire after 31 days. Each operations-worker cycle marks due
  pending records expired and purges resolved records 90 days after expiry or
  claim. The worker reports `socialInvitationsExpired` and
  `socialInvitationsPurged`.
- Privacy exports contain masked metadata and account-relative relationship
  directions/roles, never foreign IDs, raw destinations, hashes, or tokens.
  Erasure removes blocks, requests, friendships, memberships, owned/claimed
  invitation metadata, and direct identity while retaining pseudonymous,
  append-only relationship audit events.

## Monitoring and incident response

Monitor rate-limit responses, invitation-not-available results, worker failures,
and the two cleanup counters without recording a token or destination. A rise in
mismatch/not-available results can indicate link guessing or sharing to the
wrong account; preserve generic client responses to avoid enumeration.

If a link may be exposed, create a replacement with the same client retry key;
the server rotates and invalidates the prior link while retaining no response
token. If token/destination material appears in logs or telemetry, restrict the
affected sink, follow the privacy incident process, purge within approved
retention authority, and rotate links. Do not add a delivery provider during an
incident.

## Release and recovery

Apply `1787101200000_friendship_privacy_integrity.ts` before running the new API
or worker. Validate crossed requests, direct blocked-pair inserts, block cleanup,
link rotation/mismatch/expiry/replay, privacy export/deletion, and worker
retention against a migrated PostGIS database. Roll application traffic back
only while the additive schema remains in place; never use the down migration in
production. A forward fix must preserve block precedence and token secrecy.

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
  directions/roles and Challenge check-in dates/source, never foreign IDs, raw
  destinations, hashes, tokens, or the linked workout-session ID. Erasure
  deletes owned check-ins before membership/configuration cleanup, then removes
  blocks, requests, friendships, memberships, owned/claimed invitation metadata,
  and direct identity while retaining pseudonymous, append-only relationship
  audit events.

## Challenge integrity and credit isolation

- Friend Challenge creation must commit an owner membership plus at least one
  accepted-unblocked friend invitation or contact link in the same transaction.
- Regional create/discovery/join requires current approved `device_location`
  evidence for the exact enabled, non-deleted region policy. Generic region
  mismatch responses must not reveal another region's Challenge or evidence.
- Capacity is serialized on the Challenge row. A `REGIONAL_CHALLENGE_FULL`
  conflict is expected during a last-place race and must remain retry-safe.
- One check-in is stored per member/local Challenge day. Non-gym sources are
  manual with no workout link. Gym sources must reference an existing verified
  workout for the same member and date; deletion is restricted while referenced.
- Challenge writes never call or write workout verification/review, Contest
  ledger/progress, streak/ranking, Prize Draw Entry, reward, or settlement
  paths. Treat any correlated change in those records as a credit-integrity
  incident and stop Challenge writes while investigating.
- Cancellation revokes pending contact links. Withdrawal, friendship removal,
  or either-direction block retains the historical membership as `withdrawn`
  and removes it from active shared projections.

## Monitoring and incident response

Monitor rate-limit responses, generic rejected create/join/check-in outcomes,
capacity conflicts, invitation-not-available results, worker failures, and the
two cleanup counters without recording a member ID, region evidence, token,
destination, or join URL. A rise in mismatch/not-available results can indicate
link guessing or sharing to the wrong account; preserve generic client responses
to avoid enumeration.

If a link may be exposed, create a replacement with the same client retry key;
the server rotates and invalidates the prior link while retaining no response
token. If token/destination material appears in logs or telemetry, restrict the
affected sink, follow the privacy incident process, purge within approved
retention authority, and rotate links. Do not add a delivery provider during an
incident.

## Release and recovery

Apply `1787101200000_friendship_privacy_integrity.ts`, then
`1787274000000_social_activity_challenge_integrity.ts`, before running the new
API or worker. Validate crossed requests, direct blocked-pair inserts, block and
friend-removal withdrawal, concurrent capacity, current-region mismatch,
local-day/source constraints, link rotation/mismatch/expiry/replay, explicit
cancellation/withdrawal, no-credit table invariance, privacy export/deletion,
and worker retention against a migrated PostGIS database. Roll application
traffic back only while the additive schema remains in place; never use the down
migration in production. A forward fix must preserve block precedence, source
integrity, credit isolation, and token secrecy.

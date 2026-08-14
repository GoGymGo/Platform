# Friend and regional activity Challenges

## Outcome

Deliver structured, privacy-safe activity Challenges that authenticated members
can create, invite, discover, join, leave, cancel, and check in to without
creating verified workouts or any form of Contest credit.

## Authority boundaries

- PostgreSQL owns Challenge configuration, owner/member status, invitation
  provenance, capacity, lifecycle, and one-check-in-per-local-day integrity.
- Friend Challenges require at least one accepted, unblocked friend membership
  or an atomically-created provider-free contact invitation. Contact intake
  returns a masked, rotating link with `deliveryStatus: not_sent`; no delivery
  provider is contacted.
- Regional create, discovery, and join require a current approved
  `device_location` verification for the exact enabled, non-deleted policy.
  Caller-supplied region or timezone values are never eligibility evidence.
- A manual check-in is permitted only for a non-gym Challenge. Gym progress can
  reference an already-verified workout for the same member and local day, but
  Challenge code never creates or updates a workout, Contest ledger/progress,
  streak, rank, Prize Draw Entry, reward, or settlement record.
- Challenge responses expose Alias, approved `streaks-v1` badges, aggregate
  progress, and caller-relative capabilities. They omit owner/member UUIDs,
  private workout detail, contact destinations, hashes, tokens, and region
  evidence.

## Delivery sequence

1. Apply `1787274000000_social_activity_challenge_integrity.ts`. It adds
   timezone and retry provenance, explicit cancelled/withdrawn states,
   configuration and membership triggers, row-locked capacity enforcement,
   current-region checks, check-in source/date guards, and audit idempotency.
2. Start the API revision with the generated OpenAPI contract. Confirm old
   Challenge rows remain readable and new create/join/check-in writes fail
   closed when migration evidence is absent.
3. Start the privacy/retention worker and observe existing invitation expiry and
   purge counters. No new delivery service or cloud dependency is introduced.
4. Publish the matching member artifact. Smoke-test My, Discover, Create,
   invitation recovery through authentication, accept/decline, full/upcoming/
   ended/cancelled states, check-in, withdrawal, cancellation, and share retry.

## Validation

- Unit/source coverage owns 1-31-day validation, target and kind-specific
  inputs, IANA timezone handling, atomic contact payloads, stable repository
  retry keys, unavailable/error/retry states, lifecycle capability controls,
  accessibility roles/state, UUID exclusion, and App Tour isolation.
- Migrated PostGIS coverage owns deferred owner/invitation provenance,
  friendship/block precedence, exact current-region policy, concurrent capacity,
  status transitions, local-day uniqueness, verified-gym linkage, immutable
  configuration, link rotation/replay, privacy export/deletion, and retention.
- The no-credit regression snapshots workout/session-event, Contest ledger and
  progress, Prize Draw Entry, and reward rows around a manual Challenge check-in
  and requires every count to remain unchanged.
- Final gates regenerate and audit contracts, run member/API/security/privacy/
  worker tests, browser artifact checks, critical journeys, dependency and
  governance audits, then verify the exact Git head in GitHub checks.

## Observability and recovery

Audit events record lifecycle action, actor, request identity, Challenge ID, and
non-sensitive metadata. They never include a contact destination, token, join
URL, private workout detail, or raw region evidence. Operational metrics should
track generic rejected create/join/check-in outcomes, capacity conflicts,
invitation expiry/purge, and privacy-worker failures without member attributes.

Keep the additive integrity migration in place during an application rollback.
Do not weaken triggers or use the down migration in production. Revoke pending
links by cancelling the Challenge, rotate a possibly exposed link with the same
retry key, and fix forward if membership, capacity, source linkage, or no-credit
integrity is in doubt. There is no cloud deployment in this change.

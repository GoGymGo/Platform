# Audited draw settlement and Winners Circle

## Outcome

An authorized GoGymGo administrator locks one exact, versioned contest
settlement boundary after the workout completion grace period. The boundary
contains reconciled scoring inputs, weighted entrants, eligible reward slots,
and privacy-limited public identity projections. A canonical committed seed is
revealed later to select one deterministic, unique winner sequence and create
bounded Brand Reward awards exactly once. Participant and public result reads
consume only the settled immutable snapshots, while the admin dashboard exposes
the evidence needed to review and safely resume an interrupted finalization.

## Boundaries

This change coordinates PostgreSQL and the API draw/result modules, generated
contracts, the admin finalization workflow, and the member Winners Circle. The
owners must move together because the lock response and persisted snapshots are
the authority consumed by settlement and both result clients. GGG-007 remains
the owner of scoring calculations and GGG-015 remains the owner of reward
catalog, claim, and fulfillment lifecycles; this change only connects their
completed outputs at the draw boundary. It does not add cash fulfillment,
approve inventory or legal terms, contact a cloud account, or deploy an
environment.

## Rollout

1. Apply the draw-settlement integrity migration before running the updated API.
2. Release the API, generated contract, admin dashboard, and member app from the
   same exact green commit.
3. Keep contest finalization unavailable until the configured completion grace
   has elapsed and every scoring input, reward slot, and public projection can
   be locked atomically.
4. Have the operator lock first, review entrant/entry/reward counts and snapshot
   hashes, then reveal and publish from the same scoped browser recovery record.
5. Perform the separately authorized full-month staging and independent
   seed/audit recovery rehearsals before enabling a production contest.

## Validation

- Unit tests cover canonical seed commitments, deterministic unbiased weighted
  selection, duplicate and numeric bounds, and the exact completion boundary.
- API service tests cover exact admin authorization, idempotency replay, log
  redaction, response privacy, and immutable result projections.
- PostgreSQL integration tests cover snapshot finalization, late-write and
  mutation rejection, reward provenance, lock/settle concurrency and retry,
  mismatch failure, transactional rollback, award bounds, audit consistency,
  and settled-history immutability.
- Admin tests cover cryptographic randomness, scoped/expiring recovery,
  account/environment isolation, lost-seed handling, and the separate
  lock-review-reveal workflow.
- Member tests cover strict runtime decoding and honest loading, empty, pending,
  error, retry, and settled presentation.
- Generated-contract, source, production-artifact, governance, dependency,
  critical-journey, full-root, and exact-head CI gates validate the coordinated
  artifact.

## Recovery

Before a draw is locked, roll back all runtime artifacts together if necessary.
After lock, never delete or rewrite the draw, settlement inputs, reward/public
snapshots, seed commitment, or audit history. Restore the scoped seed recovery
record from the independently retained authorized copy and retry settlement
with the same reveal; a different reveal must fail closed. If settlement fails,
the transaction leaves no partial winners, awards, notifications, state change,
or settle audit, so a forward fix can retry the same draw. After settlement,
roll forward only: preserve the reveal, exact snapshots, awards, result history,
and audit evidence while correcting projections or clients.

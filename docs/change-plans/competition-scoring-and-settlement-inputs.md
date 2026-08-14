# Competition scoring and settlement inputs

## Outcome

Make verified-day credit, Weekly Goal outcomes, category standings, projected
and banked Prize Draw Entries, and the final draw input snapshot agree on one
server-authoritative, versioned scoring model. Member screens must present the
server result honestly and must not describe unsettled projections as banked
entries.

## Boundaries

- The API and worker own eligible verified-day selection, weekly settlement,
  deterministic category ordering, ledger reconciliation, and the immutable
  draw-input boundary.
- PostgreSQL owns enrollment/session/ledger/progress identity consistency,
  append-only scoring history, unique verified-day credit, and nonnegative
  materialized progress.
- The member app consumes explicit server time, scoring state, category rank,
  and projected-versus-banked entry values. It may derive presentation only;
  it does not award credit or invent a rank.
- Generated contracts mirror the API DTOs and remain the only cross-runtime
  type boundary.
- Weekly Challenge invitation UX remains GGG-010. Streak rewards remain
  GGG-008. Reward inventory remains GGG-015. Random draw execution and result
  publication remain GGG-016.

## Rollout

1. Apply the forward-only scoring-integrity migration before starting the
   updated API or worker.
2. Deploy API and worker from the same immutable artifact so period settlement,
   ledger reconciliation, and draw locking use identical rules.
3. Publish member artifacts only after the generated OpenAPI contract matches
   the API artifact.
4. Rehearse a complete contest month and compare the append-only ledger,
   materialized progress, category order, and locked draw snapshot before any
   production Contest is enabled.

## Validation

- Unit coverage proves weekly multipliers, late enrollment, deterministic tie
  ordering, unique local days, provisional/final labels, and client contract
  rejection for malformed scoring data.
- PostgreSQL integration coverage proves disallowed session states cannot
  score, cross-enrollment rows are rejected, retries do not double-credit,
  materialized drift is reconciled, and finalization produces one stable input
  snapshot.
- OpenAPI generation, migration replay, API/member checks, critical journeys,
  governance, dependency audit, and production-artifact audits pass on the
  exact published head.

## Recovery

If member presentation regresses, roll back only the member artifact; the API
continues to expose explicit scoring state and authoritative values. If the API
or worker rollout fails, roll back both to the preceding shared artifact. Keep
the relational integrity constraints in place and never delete or rewrite
ledger, match, draw-entry, or audit history. Repair a materialized progress
projection by replaying the append-only ledger, then retry settlement with the
same operator request and draw commitment.

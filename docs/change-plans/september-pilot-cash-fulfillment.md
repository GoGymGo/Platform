# September pilot cash fulfillment

## Outcome

The September 2026 Island pilot may publish only with one approved,
GoGymGo-sponsored cash reward whose settled value is exactly 10,000 cents CAD
and whose inventory is one. The settled winner sees that immutable draw
snapshot. An exact authorized GoGymGo administrator may later record one
already-completed in-person handoff with stable retry behavior and append-only
evidence.

## Boundaries

This change coordinates the PostgreSQL schema, API, generated contracts,
member app, admin app, landing site, pilot configurator, and operator/product
documentation because each surface must describe the same authoritative
reward and fulfillment lifecycle. It does not configure real pilot approval,
publish the Contest, deploy infrastructure, move money, contact a provider, or
collect bank, payee, card, wallet, tax, balance, or transfer data. The App Tour
continues to use fabricated fixtures only.

## Rollout

1. Apply the database migration before the API so cash value snapshots,
   fulfillment linkage, and commit-time invariants exist first.
2. Deploy the API and regenerated contracts, then the admin, member, and
   landing clients.
3. Keep the pilot unpublished until the real region, gyms, legal documents,
   public image, public terms, and reward approval digest are supplied through
   the operator environment.
4. Run the September configurator in its existing preview mode, review the
   computed approval digest, then use the documented approval and apply flow
   only after accountable owners have approved the real values.

## Validation

- Unit and client-contract tests cover exact value/currency, validation,
  authoritative pending/fulfilled projections, truthful copy, and isolation
  from payment/provider behavior.
- Database integration tests cover the exact pilot/reward/draw/award chain,
  exact admin authorization, body-bound replay, expected version, concurrency,
  rollback, append-only audit, and invalid ownership/status/value paths.
- Generated OpenAPI and shared contracts must be current.
- Source, dependency, privacy, artifact, and secret audits must prove that no
  payment rails or private fulfillment notes reach member/public projections.

## Recovery

Before any handoff is recorded, roll back clients/API first and then the
migration if necessary; the down migration retains existing general reward
data while removing the new cash policy fields and guards. After a handoff is
recorded, do not delete or mutate the fulfillment or audit evidence. Disable
the operator action and investigate with a forward-only corrective migration;
the append-only record is the truthful history of an already-completed manual
event.

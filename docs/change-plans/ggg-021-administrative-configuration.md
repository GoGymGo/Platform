# GGG-021 administrative configuration hardening

## Outcome

An authorized GoGymGo platform administrator can reach the Contest, region,
reward, legal, Creator-workout, and Partner-gym configuration workflows from
the production admin application. Stateful commands use the authoritative
database version, body-bound idempotency, bounded reasons, transactional audit
evidence, and server-evaluated Contest publication prerequisites. Legal
publication remains restricted to the configured owner and Creator mutations
remain unavailable while the server feature flag is disabled.

## Boundaries

This change coordinates the admin application, API configuration modules,
PostgreSQL schema, generated contracts, and operational documentation because
those layers jointly define the same administrative commands. It does not
change member competition, reward, legal-receipt, region-verification, draw,
or QR enrollment policy. It does not create real pilot records, approve legal
or reward assets, access cloud providers, deploy, or alter the coordinator-owned
feature delivery ledger.

## Rollout

Apply the forward-only configuration-version migration before promoting the API
and admin application from the same commit. Keep Creator configuration disabled
unless the independently approved API and admin release flags are both enabled.
After staging authentication succeeds, verify an owner legal action and a
non-owner denial, create and deactivate a disposable Partner gym, inspect the
persisted before/after audit projection, and run Contest publication preflight
before any staging publication attempt.

## Validation

Run focused API and admin unit tests, generated-contract drift checks, workspace
checks and builds, repository governance/dependency/source/artifact/security
audits, and the root non-database integration check serially. Database-backed
or Testcontainers validation requires a separate fresh authorization before any
Docker command is run.

## Recovery

The migration is additive and existing rows receive version `1`. If rollout
must be stopped, leave the additive columns in place, revert the application
release, and investigate through append-only operator audit events. Do not
rewrite audit, legal-receipt, reward-award, enrollment, QR-history, or Contest
settlement evidence. Resume with a forward fix and the original idempotency key
for any mutation whose response was lost.

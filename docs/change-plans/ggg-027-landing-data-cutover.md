# GGG-027 landing data cutover

## Outcome

New regional-update and partnership submissions reach one authoritative
PostgreSQL transaction through the API. The landing application validates a
bounded same-origin request, assigns a replay key, and forwards through a
disabled-by-default authenticated channel with a bounded retry. It never writes
the legacy D1 table and never reports success when the API is unavailable.

Historical D1 interest rows remain read-only and can be downloaded only by the
configured exact Sites owner in bounded pages at one frozen cutoff. An offline
tool validates and assembles those pages into one versioned artifact with exact
counts and deterministic digests. The API importer validates that artifact
before opening PostgreSQL, maps every source row to a stable destination under
one transaction, preserves newer authoritative duplicates, verifies the
mapping count and digest, and is safe to rerun.

## Boundaries

This change spans landing, API/worker, admin, generated contracts, migration
tooling, and operations because they jointly define the intake and migration
boundary. The API is the only live submission authority. Admin surfaces show
bounded intake provenance alongside the contact already required for review;
they do not expose source hashes, export digests, operator credentials, private
headers, or raw analytics.

The legacy D1 binding is deliberately retained. This repository task does not
contact Sites, Cloudflare, D1, PostgreSQL, or any deployment environment; read
credentials or real records; export/import live data; enable gates; deploy;
remove bindings; or claim the historical cutover completed. The coordinator
ledger is not edited by this branch.

## Rollout

1. Apply the forward-only API migration before deploying the API or landing
   application. Keep public intake disabled until the exact forwarding secret
   and an approved bounded retention duration are configured in both runtimes.
2. Promote the API first, then the landing application from the same reviewed
   commit. Verify unavailable, invalid, replay, rate-limit, and successful form
   states without enabling the legacy export.
3. Under separate data-owner and provider authorization, freeze an exact UTC
   cutoff and export ID, enable the owner-only D1 export briefly, download every
   bounded page, disable the route, and assemble the offline artifact.
4. Validate the artifact offline. Rehearse a database dry run against a
   disposable/staging target, review duplicate mappings and reconciliation
   digest, then commit only with the exact artifact digest authorization.
5. Reconcile source count, provenance count, distinct destination count, and
   mapping digest. A separately authorized release may then disable/remove the
   legacy binding after rollback rehearsal.

## Validation

Run focused landing request/export/form tests; API policy, intake, importer,
privacy, retention, admin decoder/rendering, OpenAPI, and migration compilation
tests; then the workspace type, lint, build, contract, source, artifact,
governance, dependency, secret, and diff gates serially with reduced
concurrency. Disposable PostgreSQL/Testcontainers proof is required for the
transactional import and forward migration, but no Docker command or inspection
may occur until all non-Docker work is complete and fresh authorization is
received with resource estimates.

## Recovery

Public intake fails closed when either runtime lacks the enable flag, exact
forwarding secret, API origin, or approved retention duration. A failed
forwarding attempt creates no D1 fallback. Artifact validation errors occur
before database access; database dry runs and failed imports explicitly roll
back. Reruns require the same artifact digest and reject any changed source ID
or source-row hash.

If an application release must be reverted, leave the additive PostgreSQL
schema in place, disable intake/export gates, and restore the prior application
version. Do not delete D1 rows, provenance mappings, or authoritative intake
records during incident response. Any cleanup, binding removal, or committed
data reversal requires a separately reviewed operation using the preserved
artifact, reconciliation output, database backup, and exact release commits.

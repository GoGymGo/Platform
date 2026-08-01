# Backend deployment runbook

The same immutable image supplies three workloads:

1. migration job: `node node_modules/node-pg-migrate/bin/node-pg-migrate.js up
   --migrations-dir dist/migrations --database-url-var DATABASE_URL`;
2. operations worker: `node --require ./dist/observability/instrumentation.js dist/worker.js`;
3. API: `node dist/main.js`.

Run migrations before the worker and before moving traffic to the API revision.
Never run down migrations in production.

## Preproduction baseline

The migration history was cleaned before the first production deployment. At
the July 30, 2026 audit, the target Google Cloud project had neither Cloud Run
nor Cloud SQL APIs enabled, so there was no deployed production database to
upgrade. A fresh database never creates the retired demo-verification or
payment schema.

Any local or staging database created from the earlier preproduction migration
set must be rebuilt from an empty database before using this baseline. Do not
apply the rewritten baseline over an existing production migration ledger.

## Required resources and secrets

- private PostgreSQL 17/PostGIS with backups and point-in-time recovery;
- Cloud Run API, private worker pool, and one-shot migration job;
- Firebase applications and workload identity;
- private user-content and privacy-export buckets;
- Secret Manager versions for `DATABASE_URL`, a random 32-byte base64
  `REWARD_CODE_ENCRYPTION_KEY`, and optional enabled-feature secrets;
- TLS domain, monitoring channels, and allowlisted origins.

Coupon encryption keys are API-only. Never place them in `.env` files committed
to Git, Expo variables, Terraform state, container images, or logs.

## Release order

1. Build and scan `backend/Dockerfile`; record the image digest.
2. Run Backend CI, Terraform validation, and the PostGIS integration suite.
3. Confirm a fresh backup and validate that the target migration ledger matches
   the clean release baseline.
4. Execute the migration job with the new digest and wait for success.
5. Update the private worker pool with the same digest.
6. Deploy an API candidate at zero traffic.
7. Verify `/v1/health`, `/v1/health/ready`, reward catalog reads, coupon secrecy,
   operator authorization, and a staging claim.
8. Shift traffic gradually while monitoring API failures, worker heartbeat,
   database saturation, reward-claim failures, notifications, and privacy work.

The protected GitHub workflow enforces migration, worker, candidate, readiness,
and promotion order. Terraform ignores image-only drift so an infrastructure
apply cannot bypass it.

## Reward incident rule

If coupon inventory or disclosure may be compromised, archive the affected
catalog item, stop its competition before settlement when possible, rotate the
coupon encryption key only through an approved re-encryption or invalidation
plan, and coordinate replacement codes with the sponsor. Never paste codes into
logs, tickets, chat, or audit reasons. Preserve catalog versions, awards, code
fingerprints, and operator audit events.

For fulfillment failures, keep the award record, contact the sponsor through the
approved support channel, and record status changes through audited operator
workflows. Do not invent cash substitutions or collect banking information.

## Privacy controls

Enable privacy operations only after bucket, IAM, signing, retention, media,
audit-log, and restore tests pass. The worker removes direct identity/content
but preserves pseudonymous contest, reward, fraud, ledger, legal-receipt, and
operator-audit records required for integrity or approved retention. Coupon
ciphertext and codes not assigned to the user are excluded from privacy exports.

## Backup and rollback

- Verify a backup and recovery window before every migration.
- Never use a down migration as a production rollback; use a verified
  pre-migration restore or a reviewed forward fix.
- Roll API/worker traffic back only when the schema remains compatible.
- Otherwise fix forward while preserving append-only draw, reward, ledger,
  privacy, and operator-audit evidence.

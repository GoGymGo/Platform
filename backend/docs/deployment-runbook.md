# Backend deployment runbook

The same immutable image supplies three workloads:

1. migration job: `npm run migrate:deploy`;
2. operations worker: `node --require ./dist/observability/instrumentation.js dist/worker.js`;
3. API: `node dist/main.js`.

Run migrations before the worker and before moving traffic to the API revision.
Never run down migrations in production.

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
3. Confirm a fresh backup. For the rewards decommission migration, also confirm
   any required legacy financial archive has been exported and approved.
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
- The brand-rewards decommission migration is intentionally irreversible; use a
  pre-migration database restore if rollback is required.
- Roll API/worker traffic back only when the schema remains compatible.
- Otherwise fix forward while preserving append-only draw, reward, ledger,
  privacy, and operator-audit evidence.

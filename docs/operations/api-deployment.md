# Backend deployment runbook

The same immutable image supplies three workloads:

1. one-shot ECS migration task: `node node_modules/node-pg-migrate/bin/node-pg-migrate.js up
--migrations-dir dist/migrations --database-url-var DATABASE_URL`;
2. ECS operations worker: `node --require ./dist/observability/instrumentation.js dist/worker.js`;
3. ECS API service: `node dist/main.js`.

Run migrations before the worker and before moving traffic to the API revision.
Never run down migrations in production.

## Preproduction baseline

The migration history was cleaned before the first production deployment. At
the July 30, 2026 audit, there was no deployed production database to upgrade.
A fresh database never creates the retired demo-verification or payment schema.

Any local or staging database created from the earlier preproduction migration
set must be rebuilt from an empty database before using this baseline. Do not
apply the rewritten baseline over an existing production migration ledger.

## Required resources and secrets

- dedicated staging and production AWS member accounts with separate state;
- private RDS PostgreSQL 17/PostGIS with backups and point-in-time recovery;
- ECS Fargate API, worker service, and one-shot migration task;
- environment-specific Firebase applications and GitHub OIDC;
- private KMS-encrypted user-content and privacy-export S3 buckets;
- AWS Secrets Manager values for `DATABASE_URL`, the Firebase AWS
  external-account configuration, a random 32-byte base64
  `REWARD_CODE_ENCRYPTION_KEY`, and optional enabled-feature secrets;
- a `DATABASE_URL` that uses `sslmode=verify-full` with the image's
  checksum-pinned Amazon RDS root CA bundle;
- TLS domain, monitoring channels, and allowlisted origins.

Coupon encryption keys are API-only. Never place them in `.env` files committed
to Git, Expo variables, Terraform state, container images, or logs.

## Release order

1. Record the full 40-character Git commit SHA approved for the release.
2. Run Backend CI, Terraform validation, and the PostGIS integration suite.
3. Confirm a fresh backup and validate that the target migration ledger matches
   the clean release baseline.
4. Manually dispatch the protected deployment workflow. It checks out that exact
   commit, builds and scans the image, pushes it to the environment's immutable
   ECR repository, and records its digest.
5. Execute the migration task with the new digest and wait for success.
6. Update the worker service with the same digest.
7. Deploy the API with ECS circuit-breaker rollback and ALB health checks.
8. Verify `/v1/health`, `/v1/health/ready`, reward catalog reads, coupon secrecy,
   operator authorization, and a staging claim.
9. Complete the rolling replacement while monitoring API failures, worker heartbeat,
   database saturation, reward-claim failures, notifications, and privacy work.

## Staging pilot configuration

After deploying the exact reviewed API commit, dispatch `Platform Deployment`
with scope `pilot-configuration`, environment `staging`, and the same full
source commit. The job refuses production, verifies the isolated AWS account and
the immutable deployed image, then runs the idempotent Vancouver Island pilot
configuration as a one-shot ECS task. It does not publish the draft competition.
The final gate requires the active `2026-09-pilot-v1` policy to appear through
`GET /v1/regions`.

The protected GitHub workflow enforces migration, worker, rolling API, and
readiness order. Terraform ignores image-only drift so an infrastructure apply
cannot bypass it.

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

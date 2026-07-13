# Backend deployment runbook

This service deploys as three independently controlled workloads built from the same image:

1. a one-shot migration job running `npm run migrate:deploy`;
2. the HTTP API running `node dist/main.js`;
3. a worker running `node dist/worker.js`.

Run migrations before shifting traffic to a new API revision. Never run destructive down migrations in production. The API and worker must use the same image digest and environment configuration.

## Required managed resources

- Cloud SQL for PostgreSQL 17 with PostGIS enabled, private connectivity, automated backups, point-in-time recovery, and separate development/staging/production instances.
- Cloud Run services for the API and worker, plus a Cloud Run job for migrations.
- Secret Manager entries for Hyperwallet API credentials, Hyperwallet webhook credentials, and the optional Expo access token.
- Firebase production applications and Application Default Credentials on the API/worker service accounts.
- A custom API domain with TLS and a single allowlisted mobile/web origin configuration.

## Release order

1. Build once from `backend/Dockerfile`, scan the image, and record its immutable digest.
2. Execute Backend CI, including the real PostGIS migration suite.
3. Deploy the migration job with the new digest and wait for a successful exit.
4. Deploy the worker with no public ingress.
5. Deploy the API with `GET /v1/health` as liveness and `GET /v1/health/ready` as readiness.
6. Run staging contract tests and a Hyperwallet UAT payout before production promotion.
7. Shift traffic gradually and monitor 5xx rate, database saturation, webhook failures, uncertain payments, and notification failures.

## Secret and environment policy

Use `backend/.env.example` only as a key inventory. Do not upload an `.env` file, Firebase service-account JSON, or Hyperwallet credential into the repository, Expo variables, container image, or CI logs. Production must set `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, `DATABASE_URL`, and the explicitly enabled provider settings.

## Payout incident rule

Never retry an uncertain payout by creating a new client payment ID. The claim ID is the immutable `clientPaymentId`; the worker reconciles it against Hyperwallet. If reconciliation still returns no payment, pause the claim for operator review before any manual retry.

## Backup and rollback

- Verify a recent Cloud SQL backup and point-in-time recovery window before each migration.
- Roll back API/worker traffic to the previous image only when the schema remains backward compatible.
- Fix forward when a migration has committed. Do not use `migrate:down` against production data.
- Preserve append-only draw, ledger, payout-state, and operator-audit records during every incident response.

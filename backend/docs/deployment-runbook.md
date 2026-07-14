# Backend deployment runbook

This service deploys as three independently controlled workloads built from the same image:

1. a one-shot migration job running `npm run migrate:deploy`;
2. the HTTP API running `node dist/main.js`;
3. a continuous Cloud Run worker pool running `node --require ./dist/observability/instrumentation.js dist/worker.js`.

Run migrations before updating the worker and before shifting traffic to a new API revision. Never run destructive down migrations in production. The API, worker, and migration job must use the same immutable image digest. Runtime configuration is workload-specific and owned by Terraform.

## Required managed resources

- Cloud SQL for PostgreSQL 17 with PostGIS enabled, private connectivity, automated backups, point-in-time recovery, and separate development/staging/production instances.
- A Cloud Run service for the API, a Cloud Run worker pool for continuous polling, and a Cloud Run job for migrations. A worker pool has no public endpoint and does not need to listen on `PORT`.
- Secret Manager entries for Hyperwallet API credentials, Hyperwallet webhook credentials, and the optional Expo access token.
- Secret Manager entries for `PRIVACY_PSEUDONYMIZATION_KEY` and every other enabled provider secret.
- Firebase production applications and Application Default Credentials on the API/worker service accounts.
- A private user-content bucket and a separate private privacy-export bucket. Enforce uniform bucket-level access and public access prevention on both.
- A seven-day delete lifecycle on the privacy-export bucket. Disable soft delete on that short-lived bucket so a user deletion removes an export immediately; exports are reproducible and must not become archival records.
- A custom API domain with TLS and a single allowlisted mobile/web origin configuration.

## Release order

1. Build once from `backend/Dockerfile`, scan the image, and record its immutable digest.
2. Execute Backend CI, including Terraform validation and the real PostGIS migration suite.
3. Deploy the migration job with the new digest and wait for a successful exit.
4. Deploy the private operations worker pool with the same digest.
5. Deploy the API with `GET /v1/health` as its Cloud Run startup/liveness probe.
6. Verify `GET /v1/health/ready`; it returns success only when PostgreSQL responds and the durable worker heartbeat is healthy or still within its startup grace period.
7. Run staging contract tests and a Hyperwallet UAT payout before production promotion.
8. Shift traffic gradually and monitor 5xx rate, worker heartbeat/failures, database saturation, webhook failures, uncertain payments, and notification failures.

The protected manual workflow at `.github/workflows/backend-deploy.yml` enforces steps 3-6 for an image pinned to `@sha256:`. The API first deploys as a tagged zero-traffic candidate and receives user traffic only after readiness succeeds. Terraform ignores image-only drift so an infrastructure apply cannot bypass this ordering. See [the Terraform foundation](../infra/terraform/README.md) for provisioning, remote-state, and secret-bootstrap instructions.

## Secret and environment policy

Use `backend/.env.example` only as a key inventory. Do not upload an `.env` file, Firebase service-account JSON, or Hyperwallet credential into the repository, Expo variables, container image, or CI logs. Production must set `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, `DATABASE_URL`, and the explicitly enabled provider settings.

Terraform creates secret containers but never secret versions, preventing secret payloads from being retained in Terraform state. Populate versions through a protected operator or CI identity before enabling the corresponding feature flag. Production GitHub deployment uses Workload Identity Federation and must not store a service-account JSON key.

## Health and incident signals

- Cloud Run restarts the API only when the dependency-free `/v1/health` liveness probe fails.
- The external `/v1/health/ready` check covers PostgreSQL and a database-backed worker heartbeat without coupling worker failure to API process restarts.
- `GET /v1/operator/system-health` requires a database-backed operator and adds queue depths, uncertain payments, pending webhooks, profile-media cleanup, privacy work, and the last safe worker failure code.
- Application logs contain request/trace correlation fields and safe error types, never exception messages. Log-based metrics alert on API 5xx responses and worker batch failures.
- When OTLP is enabled, HTTP, Express, PostgreSQL, worker spans, batch duration, result counts, and failure counters export to the configured collector. Keep OTLP disabled unless an HTTPS collector endpoint is configured.

## Privacy operation controls

Enable `PRIVACY_OPERATIONS_ENABLED` only after all of the following are true:

- `PRIVACY_EXPORT_BUCKET` names the dedicated private export bucket.
- `PRIVACY_PSEUDONYMIZATION_KEY` is a random secret of at least 32 characters stored only in Secret Manager. Rotating this key requires a written migration plan because it changes deterministic deleted-account identifiers.
- The worker service account has only object create/get/delete permissions on the export bucket and delete permission on user-content objects.
- The identity used to create V4 signed URLs can perform the requested object read and has `iam.serviceAccounts.signBlob`. Signed URLs expire after at most 15 minutes; the default is five minutes.
- Profile-media upload actions are restricted to exact-size create-only writes under `avatars/`; verify the API has only conditional object creator/viewer grants and the worker owns deletion.
- Bucket logs, Cloud Audit Logs, lifecycle deletion, public access prevention, and uniform bucket-level access have been verified in staging.

The worker runs only operator-approved requests in `processing`. It uses PostgreSQL leases and append-only request events, retries failures without storing exception text or personal data, and never deletes competition, payout, fraud, or operator-audit records. Account deletion instead removes direct identifiers and pseudonymizes the retained record graph. See [privacy operations](privacy-operations.md).

## Payout incident rule

Pause new release reservations first with `POST /v1/operator/payout-release-control/status-action`, using the version from `GET /v1/operator/payout-release-control`, an incident-specific idempotency key, and the approved incident reason. Confirm the returned state is paused before rotating credentials, disabling Hyperwallet, or changing provider connectivity. The pause serializes against new reservations but does not cancel a reservation that already committed.

Never retry an uncertain payout by creating a new client payment ID. The claim ID is the immutable `clientPaymentId`; the worker reconciles it against Hyperwallet. If reconciliation still returns no payment, keep global releases paused and hold the claim for operator review before any manual provider action. Do not resume until every already-processing or uncertain payment is accounted for and the incident owner approves the exact versioned resume action.

## Backup and rollback

- Verify a recent Cloud SQL backup and point-in-time recovery window before each migration.
- Roll back API/worker traffic to the previous image only when the schema remains backward compatible.
- Fix forward when a migration has committed. Do not use `migrate:down` against production data.
- Preserve append-only draw, ledger, payout-state, privacy-state, and operator-audit records during every incident response.

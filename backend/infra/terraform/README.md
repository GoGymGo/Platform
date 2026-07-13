# GoGymGo Google Cloud foundation

This root codifies one isolated environment of the GoGymGo backend. Use a separate Google Cloud project and Terraform state bucket for staging and production. It creates:

- private PostgreSQL 17 Cloud SQL with point-in-time recovery and PostGIS enabled by the application migration;
- Firebase enabled in the same isolated project so token verification and account-erasure IAM cannot drift across projects;
- a public Cloud Run API protected at the application layer by Firebase bearer tokens and dedicated Hyperwallet webhook authentication;
- a private, continuously running Cloud Run worker pool;
- a one-shot Cloud Run migration job;
- private content and seven-day privacy-export buckets, with optional exact-size avatar upload permissions restricted to the `avatars/` prefix;
- one service account per workload, per-secret IAM, durable readiness monitoring, and failure alerts;
- an immutable Artifact Registry repository.

The configuration uses the same digest-pinned image to bootstrap all three workloads. Terraform intentionally ignores subsequent image-only drift: the release workflow updates migration, worker, then API in that order so a Terraform apply cannot accidentally put new application code ahead of its schema.

## Prerequisites

1. Create an isolated Google Cloud project and a separate versioned, access-logged GCS bucket for Terraform state. Restrict the state bucket to the infrastructure deployment identity.
2. Configure Workload Identity Federation for GitHub; do not create a long-lived service-account key.
3. Build and push `backend/Dockerfile`, then resolve the image to an Artifact Registry `@sha256:` digest.
4. Copy `terraform.tfvars.example` to a non-committed environment file outside the repository and replace every placeholder.

If Firebase was enabled before Terraform adopted the project, import the existing Firebase project into `google_firebase_project.current` before applying; do not create a second identity boundary.

Initialize remote state:

```sh
terraform init \
  -backend-config="bucket=REPLACE_STATE_BUCKET" \
  -backend-config="prefix=gogymgo/ENVIRONMENT"
```

Then format, validate, review the saved plan, and apply it:

```sh
terraform fmt -check -recursive
terraform validate
terraform plan -out=reviewed.tfplan -var-file=/secure/path/ENVIRONMENT.tfvars
terraform apply reviewed.tfplan
```

Never use `-auto-approve` for production. Store the reviewed plan only in a protected CI workspace and delete it after applying.

## Secrets and database bootstrap

Terraform creates Secret Manager containers and grants only the workloads that consume them. It deliberately does not create secret versions because secret payloads placed in Terraform resources are retained in Terraform state.

Before the first workload deployment:

1. Create a least-privilege PostgreSQL login outside Terraform and grant it only the application database privileges required by migrations/runtime.
2. Build `DATABASE_URL` with the Cloud SQL private IP from `terraform output cloud_sql_private_ip`, require TLS, and add it as the first version of the output secret ID `DATABASE_URL`.
3. Add at least 32 random characters to the pseudonymization-key secret before enabling privacy operations.
4. Add Hyperwallet and Expo credentials only in their environment-specific projects. Never copy UAT credentials into production or vice versa.
5. Grant the release identity Cloud Run developer, job executor, Artifact Registry reader, and service-account user permissions only on this environment's resources. The API and worker use separate runtime roles and receive different secret mounts; do not merge their service accounts for convenience.

Enabling `hyperwallet_enabled`, `privacy_operations_enabled`, `profile_media_enabled`, or `push_notifications_enabled` adds the corresponding secret mounts or access grants. Keep each flag false until the feature's staging/UAT checklist passes. Profile media grants the API conditional object-create and object-read roles only under the `avatars/` prefix; cleanup remains worker-only.

## Release ownership

Terraform owns resource topology, IAM, non-secret configuration, probes, and alerts. `.github/workflows/backend-deploy.yml` owns image-only revisions and enforces this sequence:

1. update the migration job to the reviewed digest and execute it to completion;
2. update the operations worker pool to that digest;
3. deploy a tagged API candidate at zero user traffic;
4. verify candidate readiness, which checks both PostgreSQL and the worker heartbeat;
5. promote the verified revision to user traffic and verify the default URL again.

The GitHub environment must require approval for production and define `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, and optionally `BACKEND_NAME_PREFIX`.

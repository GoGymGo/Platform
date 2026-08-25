# GGG-030 AWS foundation repository readiness

## Outcome

Make the checked-in AWS foundation and protected release path fail closed from
an exact reviewed commit. The delivery aligns runtime configuration with the
current API, preserves exact private-object versions, limits role-scoped
secrets, requires production alert destinations, and makes a failed service
release request the complete prior API and worker baseline.

This is repository readiness only. It does not assert that an AWS account,
resource, secret value, alarm subscription, backup, domain, deployed digest, or
cost state exists or is healthy.

## Boundaries

- Infrastructure remains restricted to dedicated staging and production member
  accounts in `ca-central-1`, with a unique remote state and protected GitHub
  environment for each.
- Terraform creates secret containers, never secret values. Runtime roles
  and distinct execution roles receive only the mappings they consume; the
  reward encryption key is API-only.
- Existing shared-role environments retain that role and policy behind
  `prevent_destroy` and explicit state moves until a protected deployment proves
  both active and rollback task-definition revisions use the new scoped roles.
- The operations worker remains a singleton. API autoscaling, RDS Proxy,
  Multi-AZ production capacity, and alert thresholds beyond the existing source
  are separate load, availability, and cost decisions.
- No AWS, Firebase, Cloudflare, DNS, credential, provider, database, or real-data
  operation is part of this change.

## Rollout

1. Pass repository CI, including backend-disabled Terraform validation/tests,
   source-policy tests, API tests, configuration scanning, and the production
   image audit.
2. In a separately authorized infrastructure session, reconcile the dedicated
   account, remote backend, protected environment variables, secret mappings,
   alarm destinations, backups, and the reviewed Terraform plan. Do not infer
   those facts from this merge.
3. Populate or rotate secret values out of band, then prove a fresh backup and
   restore point before dispatching the exact-green merged-main commit.
4. Run the protected order: migration, singleton worker, API, dependency
   readiness. Preserve the release record and sanitized evidence.
5. Enable optional creator, landing intake, media, privacy, or push controls only
   after each feature's separate retention, provider, data, and UAT gates pass.

## Validation

- Terraform formatting, initialization with `-backend=false`, validation, mock
  plans, tests, and HIGH/CRITICAL configuration scanning.
- API formatting, typecheck, lint, unit/E2E/integration tests, contracts, source
  audit, build, and production-image checks.
- Offline deployment policy tests proving all PR-required checks, both always-on
  exact-main checks, and every emitted path-scoped exact-main check are green.
- Workflow policy checks for immutable checkout, serialized environment release,
  role-scoped secrets, captured rollback baselines, and full API/worker recovery.
- An authorized staging rehearsal must still prove migration idempotency,
  readiness, rollback, alarm delivery, backup restore, secret rotation, and
  incident ownership.

## Recovery

The deployment workflow records the active API and worker task definition and
desired count before replacement. A worker, API, or readiness failure requests
both prior service baselines and fails the release. Migrations are never rolled
down. If the forward schema is not compatible with the prior runtime, stop
traffic and use a reviewed forward fix or an authorized point-in-time restore
into a new database target. Follow the AWS runtime recovery runbook; never edit
Terraform state, task definitions, secret values, or database rows ad hoc.

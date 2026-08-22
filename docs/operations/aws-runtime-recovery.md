# AWS runtime release and recovery evidence

Status: repository procedure. It is not deployed-resource evidence and does not
authorize an AWS, credential, DNS, provider, database, backup, or data operation.
Every environment action below requires the protected environment owner and an
approved change window. Read-only AWS reconciliation is a separate task.

## Release evidence record

Before requesting AWS credentials, record:

- environment, dedicated expected account, and `ca-central-1` region;
- exact 40-character merged-main commit and its merged pull request;
- successful PR-required checks plus successful always-on and emitted
  path-scoped checks on that exact merge commit;
- reviewed Terraform plan digest and remote state bucket/key identity;
- immutable prior API and worker task definitions and desired counts;
- proposed ECR image digest and scanner result;
- RDS backup/PITR window, migration-ledger digest, and restoration owner;
- configured alarm topic ownership and a confirmed notification test;
- approved feature flags, retention values, and present secret versions without
  copying any secret value; and
- start/end time, operator, approver, outcome, and sanitized incident links.

An unknown or mismatched item blocks the release. Repository defaults, outputs,
old tickets, and this document are not evidence of deployed truth.

## Infrastructure reconciliation gate

Use a dedicated environment identity and the account-specific remote backend.
Confirm the provider account guard before reviewing a saved plan. The plan must
not create resources outside `ca-central-1`, share staging/production state, make
RDS or private buckets public, disable KMS or backup controls, remove production
deletion protection, broaden runtime ingress, or replace persistent resources
without an approved recovery record.

The checked-in provider and CLI range are bounded. Local repository validation
uses `terraform init -backend=false`; it never proves remote state, drift, or an
account. A credential-bearing plan is a separate authorized operation.

Terraform task-definition revisions carry reviewed runtime configuration while
the protected deployment workflow overlays only the exact scanned image. Supply
the current approved image digest when preparing an infrastructure revision and
inspect the resulting task definition before a release. Do not use an all-zero
bootstrap digest after initial provisioning.

## Capacity and connectivity

The cost-controlled baseline uses public-IP Fargate egress with security groups
that permit API ingress only from the ALB and PostgreSQL only from the API,
worker, and migration groups. The database remains private. Verify those facts
in the target account; source code alone cannot attest them.

The worker must remain at one task because its durable heartbeat has one current
process owner. API autoscaling is intentionally absent until load tests approve
request, CPU, memory, and database-connection budgets. RDS Proxy is likewise
deferred until measured connection pressure justifies its cost and added failure
mode. Production Multi-AZ, task count, database class, and budget require an
explicit availability/cost approval; do not copy staging values by inference.

## Migration and service release

1. Prove a restorable backup/PITR point and compare the target migration ledger
   with the exact image's forward migration inventory.
2. Run one digest-pinned migration task. Require one started task and exit code
   zero. Never run a down migration in staging or production.
3. Capture the active worker baseline, deploy the same digest to one worker, and
   require the requested revision, desired count one, running count one, and a
   completed rollout.
4. Capture the active API baseline, deploy the same digest with the circuit
   breaker, and require the requested revision and completed rollout.
5. Require `/v1/health/ready`; then complete the authenticated and operator
   checks in the backend deployment runbook.

The workflow fails closed and requests both prior service baselines when worker,
API, or readiness verification fails. That is application rollback only. The
forward migration must remain backward compatible. If it is not, isolate the
environment and use the database recovery path rather than declaring rollback.

## Database backup and restore rehearsal

At an approved interval and before a risky migration, restore the selected
snapshot/PITR point into a new isolated database target. Never overwrite the
source database. Restrict connectivity to the approved rehearsal task, create a
least-privilege temporary application login, and verify PostGIS, migration
ledger, constraints, representative integrity counts, and application readiness
without copying personal rows into tickets or logs.

Record timestamps, source recovery point, restored target identifier, encrypted
status, duration, checks, sanitized outcome, and deletion approval. Destroying a
rehearsal target is a separately reviewed data action. A configured retention
window or successful snapshot API response is not proof that restore works.

## Private object recovery

User content and privacy exports are private, KMS-encrypted, and versioned.
Application cleanup targets captured object versions and the worker role alone
may delete them. Do not restore an expired privacy export or deleted user media
without privacy/security authorization. For accidental deletion investigation,
preserve bucket/version evidence, determine the approved record disposition,
and use an exact version operation only in the owning account. Lifecycle rules
remain defense in depth, not a substitute for worker reconciliation.

## Secret rotation

Secrets Manager containers do not imply populated or current values. Rotate by
creating a new staged version out of band, validating it with the consuming role,
deploying the reviewed task definition, and promoting it only after readiness.
Retire the prior version after the rollback window.

- Database credentials require coordinated login and connection rotation.
- Firebase federation configuration must remain keyless unless a documented
  exception approves a service-account key and rotation plan.
- Landing forwarding secrets require coordinated API and landing-worker
  cutover; do not dual-write or leave an unbounded overlap.
- Reward encryption-key rotation requires a reviewed re-encryption or inventory
  invalidation plan. Never rotate it as a generic incident reflex.
- Privacy pseudonymization-key loss or compromise requires privacy/security
  incident review because replacing it changes retained-identity semantics.

Never log secret values, version payloads, presigned URLs, tokens, or database
connection strings.

## Alarms and incident response

Production Terraform refuses an empty budget email or alarm-topic list. That
only proves configuration input, not subscription confirmation or delivery.
Before release, test alarm routing with the approved notification mechanism and
record the owner/escalation path. Existing source alarms cover API server errors,
worker batch failures, database CPU/storage, and unhealthy targets. Continuous
worker-heartbeat probing and approved SLOs remain external gates; readiness and
operator health are not a substitute for an owned synthetic monitor.

For an incident:

1. stop promotion and preserve the exact source, image digest, task revisions,
   migration result, alarm timeline, and bounded logs;
2. revoke or rotate exposed credentials without pasting them into the record;
3. use the complete prior service baselines only when schema compatibility is
   established;
4. otherwise isolate traffic and choose a forward fix or new-target PITR restore;
5. preserve append-only contest, reward, privacy, and audit evidence; and
6. obtain privacy/security approval before restoring, exporting, or deleting
   member data.

Repository completion remains `BLOCKED` for deployment until account isolation,
remote state, drift, cost, backups, restore, secret versions, alarms, DNS/TLS,
provider integrations, protected approvals, and staging UAT are independently
verified.

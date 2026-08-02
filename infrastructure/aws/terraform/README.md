# GoGymGo AWS environment

This Terraform root creates one isolated GoGymGo environment in one dedicated
AWS member account. Run it independently in `GoGymGo-Staging` and
`GoGymGo-Production`; never point both environments at one account or state.

The account boundary is enforced twice: the AWS provider permits only
`account_id`, and the RDS resource refuses to plan when the signed-in account
does not match it. Nothing here references or shares Souvenote resources.

## What it creates

- one VPC in Canada Central with two public runtime subnets and two private
  database subnets;
- private PostgreSQL 17 RDS with AWS-managed master credentials, encryption,
  backups, point-in-time recovery, and no public address;
- an ECS Fargate API, continuous worker, and one-shot migration task using the
  same digest-pinned image;
- an internet-facing TLS Application Load Balancer whose API target is reachable
  only from its security group;
- private KMS-encrypted content and seven-day privacy-export S3 buckets;
- immutable ECR images, encrypted Secrets Manager containers, CloudWatch logs,
  alarms, and a per-account budget;
- separate least-privilege API, worker, migration, and execution roles;
- a GitHub OIDC deployment role restricted to the matching protected GitHub
  environment. No long-lived AWS deployment key is required.

The cost-controlled pilot intentionally gives Fargate tasks public egress while
their security groups allow no direct inbound traffic. This avoids NAT Gateway
hourly charges. RDS remains private. Moving tasks into private subnets with one
or two NAT Gateways is a later, separately priced HA decision.

## Account and state prerequisites

1. Create two member accounts in the existing AWS Organization:
   `GoGymGo-Staging` and `GoGymGo-Production`. Use distinct root email aliases.
2. Put them in a `GoGymGo` OU and apply region, root-user, and logging guardrails.
3. Confirm credit sharing is active for both accounts.
4. In each account, create a unique private S3 Terraform-state bucket with
   versioning, encryption, public-access blocking, and a bucket policy restricted
   to the infrastructure administrator. Do not share a state bucket or key.
5. Bootstrap with the documented all-zero digest and both desired counts at
   zero. The protected release workflow builds the first real image only after
   the reviewed apply has created the environment's ECR repository.

Initialize with account-specific backend configuration:

```sh
terraform init \
  -backend-config="bucket=REPLACE_ACCOUNT_STATE_BUCKET" \
  -backend-config="key=gogymgo/ENVIRONMENT/terraform.tfstate" \
  -backend-config="region=ca-central-1"
```

Copy `terraform.tfvars.example` to a secure, uncommitted file outside the
repository. A staging plan uses `db.t4g.micro` and zero running tasks until UAT.
Production should use `db.t4g.small`, zero bootstrap tasks, deletion protection,
and at least a $150 budget; its first approved deployment scales the API and
worker to one. Keep Multi-AZ false for the pilot only after accepting the
documented availability tradeoff.

Always save and review the exact plan before applying:

```sh
terraform fmt -check -recursive
terraform validate
terraform test
terraform plan -out=reviewed.tfplan -var-file=/secure/path/ENVIRONMENT.tfvars
terraform show reviewed.tfplan
terraform apply reviewed.tfplan
```

Never use `-auto-approve` for production.

## Secrets and database bootstrap

Terraform creates secret containers but no secret values. Payloads must never be
placed in Terraform variables or state. Before starting ECS tasks:

1. Use the AWS-managed RDS master secret only from a one-off operator session to
   create a least-privilege application login and enable `postgis`.
2. Store an SSL-required `DATABASE_URL` for that login in the output
   `DATABASE_URL` secret.
3. Store a random base64-encoded 32-byte value in
   `REWARD_CODE_ENCRYPTION_KEY`.
4. Prefer Google workload identity federation for Firebase access from AWS.
   The current compatibility path accepts a least-privilege service-account JSON
   in `FIREBASE_SERVICE_ACCOUNT_JSON`, injected only into the API and worker, but
   creating that long-lived key requires an explicit exception approval and a
   rotation plan.
5. Populate optional worker secrets only when the related feature is approved.

The application continues using environment-specific Firebase Authentication
for the first AWS release. Migrating identities to Cognito is explicitly out of
scope for this infrastructure move.

## TLS and Cloudflare

Request an ACM certificate in the environment's AWS account. Adding its DNS
validation record and pointing the API hostname at the load balancer are separate
Cloudflare approval gates. Until an issued `api_certificate_arn` is supplied,
the load balancer has no listener and cannot forward application traffic.

## Ordered release

The protected GitHub workflow checks out an exact 40-character commit, verifies
the environment account, builds and vulnerability-scans the API image, pushes it
to the environment's immutable ECR repository, runs the migration task, updates
the worker, then performs an ECS rolling API deployment with circuit-breaker
rollback and load-balancer health checks. ECR publishing and deployment both use
the same short-lived environment-scoped OIDC role; no registry password or AWS
access key is stored in GitHub.
For the pilot, each deployment explicitly scales the API and worker to one task;
this wakes a staging environment whose initial desired counts were zero.
Production must have required reviewers configured on the GitHub environment.

Terraform ignores image-only task-definition and service drift so an
infrastructure apply cannot silently move application code ahead of migrations.

## Staging cost control

Keep staging API and worker desired counts at zero outside approved UAT windows.
RDS can be stopped temporarily, but AWS automatically restarts it after seven
days, so the operator checklist must re-stop it or schedule the next UAT window.
Storage, secrets, KMS, the load balancer, and public IPv4 addresses continue to
incur charges while compute is stopped. Destroying and recreating the staging
load balancer can reduce that floor, but requires a reviewed Terraform plan and
a Cloudflare DNS update.

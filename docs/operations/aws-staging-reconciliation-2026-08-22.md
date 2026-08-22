# AWS staging reconciliation — 2026-08-22

## Executive summary

An explicitly approved, non-root IAM Identity Center permission set was created
for metadata-only reconciliation of the existing GoGymGo-Staging member account.
The account is active, belongs to the Souvenote organization, uses the expected
account ending **9877**, and is operating in ca-central-1.

The existing staging release is publicly healthy: the API and worker are steady,
the load-balancer target is healthy, health/readiness routes respond, browser
routes load, and browser CORS is correct. It is not current-main ready. The live
image is 78 commits behind the reconciled repository baseline, two private-data
buckets have versioning suspended, runtime secret isolation is broader than the
current Terraform, and all five runtime alarms have no notification actions.

August 1–22 gross staging usage was approximately **$63.55**. AWS applied
approximately **$63.55** in credits, leaving approximately **$0** of eligible
usage after credits. A simple calendar projection is approximately **$90** for
August. The remaining credit balance and sharing configuration could not be
retrieved because the payer account reports that IAM billing access is not
activated. Credits are applying now, but future coverage is not guaranteed.

No Terraform plan, deployment, secret value read, S3 object read, database
connection, log-content query, restore, rotation, scaling change, or application
resource mutation occurred.

## Verified target and method

| Item | Verified value |
| --- | --- |
| Environment | staging |
| AWS account | GoGymGo-Staging ending **9877** |
| Organization management account | Souvenote ending **6665** |
| Region | ca-central-1 |
| Repository baseline | e7faf79b7d9e669bcd34ed9b9ef84845b37d5814 |
| Authentication | IAM Identity Center / SSO, non-root |
| Reconciliation permission set | GoGymGoStagingReconcile |
| Session duration | Two hours |
| Restrictions | No AWS mutations, secret values, object contents, log events, database log download, decryption, or interactive execution |

The access portal now exposes the existing staging account to the existing
workforce identity. The permission set has one account assignment, 95 allowed
metadata/cost actions, and 26 explicit sensitive-data/execution denies.

## Gate classification

| Gate | Observed live state | Classification | Risk | Required next action |
| --- | --- | --- | --- | --- |
| Account isolation | Existing active member account ending 9877; caller and region match | VERIFIED | None | Preserve account guardrails |
| Non-root access | Restricted two-hour SSO role is assigned and usable | VERIFIED | Low | Retain; tighten unused list permissions |
| Root protection | No IAM users or account keys, but root MFA is disabled | GAP FOUND | High | Account owner enables root MFA outside this non-root workflow |
| Remote backend | Expected state key and versions exist; public access blocked; no current lock | VERIFIED | Low | Preserve backend and default workspace |
| Backend encryption | Repository requires encryption; live configuration read denied | BLOCKED BY PERMISSIONS | High | Add only the missing configuration-read permission |
| Exact Terraform drift | State predates three material Terraform commits; exact plan unsafe now | NOT YET TESTED | High | Supply exact variables and separately approve state/lock procedure |
| Network | Expected VPC, subnet, IGW, no-NAT, and security-group shape | VERIFIED | Low | No immediate action |
| ECS runtime | API 1/1 and worker 1/1, steady, no pending tasks | VERIFIED | Medium | Confirm active-cost window is intentional |
| Deployed source | Running commit is 78 commits behind current main | GAP FOUND | High | Build, scan, plan, and deploy an approved current-main digest later |
| ECR assurance | Immutable and scan-on-push; image detail/scan reads denied | BLOCKED BY PERMISSIONS | High | Add narrow ECR metadata/scan reads |
| Load balancer/readiness | Active TLS listener, healthy target, health/readiness HTTP 200 | VERIFIED | Low | Re-run after deployment |
| Member web | Private-origin CloudFront; public routes HTTP 200; CORS correct | VERIFIED | Low | Authenticated UAT remains separate |
| RDS protection | Private, encrypted, forced SSL, 14-day PITR, daily automated snapshots | VERIFIED | Medium | Rehearse restore under separate approval |
| RDS deletion safety | Deletion protection disabled; no manual snapshot | GAP FOUND | Medium | Decide whether staging policy should change |
| Private S3 versioning | User-content and privacy-export versioning suspended | GAP FOUND | High | Restore versioning through reviewed Terraform |
| S3 public access | All relevant buckets individually block public access | VERIFIED | Low | Consider account-level defense in depth |
| S3 encryption/lifecycle | Configuration reads denied; privacy lifecycle unverified | BLOCKED BY PERMISSIONS | High | Add narrow configuration reads before release |
| KMS | Customer key enabled with annual rotation | VERIFIED | Low | No immediate action |
| Secret containers | Six app containers plus managed DB secret; no values read | VERIFIED | Low | Preserve out-of-band value handling |
| Runtime secret isolation | One shared execution role; worker receives reward key | GAP FOUND | High | Apply current role/task-definition scoping |
| Optional features | Privacy/push secrets empty and matching flags disabled | VERIFIED | Low | Populate only with separate approval |
| Runtime alarms | Five alarms are OK but all alarm/OK actions are empty | GAP FOUND | High | Add and validate an incident destination |
| Budget notifications | $100 budget; thresholds have redacted email subscribers | VERIFIED | Medium | Confirm delivery with an authorized test |
| SNS routing | Topic/subscription inspection denied | BLOCKED BY PERMISSIONS | Medium | Add narrow SNS metadata reads |
| Backup inventory | RDS backups verified; Backup inventory denied; restore untested | BLOCKED BY PERMISSIONS | High | Add Backup reads, then separately approve restore rehearsal |
| DNS/TLS | Cloudflare owns DNS; expected certificates issued/in use/renewable | VERIFIED | Low | Preserve ownership and recheck after ALB changes |
| Current costs | Gross $63.55, credits -$63.55, net about $0 for August 1–22 | VERIFIED | Medium | Continue monitoring; investigate CloudWatch spend |
| Credit balance/sharing | Payer Billing API denied because IAM billing access is inactive | BLOCKED BY PERMISSIONS | Medium | Do not promise future all-credit coverage |
| Protected deployment | Current release is older; no new plan/deployment authorized | REQUIRES MUTATION APPROVAL | High | Complete evidence gaps and review exact plan |
| Authenticated UAT | Public routing only was tested | NOT YET TESTED | High | Run after approved current-main staging release |

## Terraform backend and drift

The backend is a staging-only S3 bucket in ca-central-1 with the expected
gogymgo/staging/terraform.tfstate key. Tags identify the GoGymGo staging
environment and Terraform-state purpose. Versioning is enabled, all four public
access controls are enabled, and the bucket policy is non-public. There is no
current .tflock object. The object layout supports the default workspace.

An exact refresh-only plan was deliberately skipped:

- the approved role cannot read the state object;
- a normal plan lock would create and remove an S3 .tflock object;
- disabling locking would remove concurrency safety without solving state access;
- exact staging image, Firebase, CORS, and optional values are unavailable;
- raw Terraform state may contain sensitive configuration and was never fetched.

The state object was last updated August 11. Three later commits materially
changed 11 AWS Terraform files (+339/-80), including execution-role and secret
scoping, task inputs, alarm actions, retention controls, and release
preconditions. This is strong evidence of likely unapplied configuration, not a
substitute for a protected plan.

The selected AWS provider is correctly pinned at 6.57.1. The lockfile retains a
broader historical constraint even though the selected version and hashes are
correct; this is repository hygiene rather than live drift.

## Runtime health

- API and worker are each one desired / one running with completed rollouts.
- Both services use the same immutable deployed digest.
- The ALB is active with an HTTPS listener and one healthy target.
- /v1/health and /v1/health/ready return HTTP 200.
- Member web /, /sign-up, and /join return HTTP 200.
- Browser preflight from the configured member origin returns HTTP 204 with the
  expected allow-origin.

The healthy deployment is an older baseline. Its source commit is an ancestor
of current main and is 78 commits behind it. Current-main functionality is not
deployed or UAT-attested.

## Security and data protection

Confirmed controls:

- no IAM users or account access keys;
- GitHub OIDC restricted to the expected audience, immutable organization and
  repository identifiers, and protected staging environment;
- member-web deployment restricted to its bucket and CloudFront distribution;
- private encrypted RDS, forced SSL, and active rotating managed master secret;
- enabled application KMS key with annual rotation;
- bucket-owner-enforced ownership and individual public-access blocking;
- no cross-account resource policy on application secrets.

Gaps:

- root MFA is disabled;
- account-level S3 public-access blocking is not configured;
- API, worker, and migration share one execution role that can retrieve all six
  application secrets;
- the live worker receives REWARD_CODE_ENCRYPTION_KEY, while current Terraform
  reserves it for the API;
- the backend deployment role retains broad ECS actions, although iam:PassRole
  is limited to GoGymGo runtime roles.

OrganizationAccountAccessRole exists and trusts the Souvenote management
account. It confirms the original linked-account administration path exists,
but it carries AdministratorAccess. The restricted SSO role is the appropriate
inspection path.

## Backup and PITR readiness

RDS automated backups are active and encrypted. The observed recovery window
covers 14 days, with daily automated snapshots. This verifies configuration and
PITR eligibility, not recoverability. No manual snapshot or restore-rehearsal
evidence exists. AWS Backup inventory was permission blocked.

## Observability and alerting

The application log group has 30-day retention, KMS metadata, two metric
filters, and approximately 68 MB stored. Five expected alarms exist and are
currently OK. Every alarm has empty alarm and OK actions, so there is no runtime
incident notification routing. Budget email notifications are separate.

## DNS, TLS, and integrations

Route 53 contains no hosted zones, consistent with Cloudflare owning DNS. Both
expected ACM certificates are issued, in use, successfully validated, and
renewal eligible.

Firebase configuration metadata is present, but no external credential was
retrieved and no provider call was made. Authenticated integration behavior
remains untested.

## Cost and credits

Exactly two Cost Explorer API requests were attempted, for a maximum request
charge of **$0.02**. One actual-cost request succeeded; AWS forecast failed
because there was insufficient history.

| Service | Gross usage, August 1–22 |
| --- | ---: |
| ECS/Fargate | $18.77 |
| Load Balancing | $11.39 |
| CloudWatch | $11.24 |
| RDS | $10.25 |
| VPC/public IPv4 | $9.22 |
| Secrets Manager | $1.62 |
| KMS | $0.62 |
| ECR | $0.44 |
| Other | ~$0.01 |
| **Total** | **$63.55** |

Credits offset approximately the full $63.55, leaving approximately $0 of
eligible usage after rounding. This proves credits are currently applying. It
does not prove the remaining balance or guarantee future, expired, exhausted,
taxed, or ineligible charges.

The budget reports $63.984 of a $100 gross monthly limit. The 25% and 50%
thresholds are in ALARM; 80% and 100% remain OK. Simple calendar projection is
approximately $90. CloudWatch alone is already $11.24, above the prior $3–$10
combined allowance for logs, alarms, backups, and low-volume services.

## Permission gaps

These metadata reads were denied and remain unknown:

- s3:GetEncryptionConfiguration
- s3:GetLifecycleConfiguration
- ssm:DescribeParameters
- ecr:DescribeImages
- ecr:DescribeImageScanFindings
- SNS topic/subscription inspection
- AWS Backup plan/vault/recovery-point inspection
- access-analyzer:ListAnalyzers
- payer billing:GetCredits because IAM billing access is not activated

The role grants S3 bucket listing actions. They were used only on the dedicated
Terraform backend to verify the expected state key and lock metadata;
application-data buckets were not listed because object names can expose
customer context. Remove those actions if they are no longer needed when the
narrow configuration reads are added.

## Representative commands

The explicitly approved access mutation used sanitized forms of:

~~~powershell
aws sso-admin create-permission-set <instance> --name GoGymGoStagingReconcile --session-duration PT2H
aws sso-admin put-inline-policy-to-permission-set <instance> <permission-set> --inline-policy <approved-policy>
aws sso-admin create-account-assignment <instance> --target-id <STAGING_ACCOUNT> --permission-set-arn <permission-set> --principal-type USER --principal-id <WORKFORCE_USER>
~~~

Representative read-only commands:

~~~powershell
aws sts get-caller-identity --profile gogymgo-staging-reconcile --region ca-central-1
aws ecs describe-services --cluster gogymgo-staging --services gogymgo-staging-api gogymgo-staging-worker --profile gogymgo-staging-reconcile --region ca-central-1
aws elbv2 describe-target-health --target-group-arn <REDACTED> --profile gogymgo-staging-reconcile --region ca-central-1
aws rds describe-db-instances --profile gogymgo-staging-reconcile --region ca-central-1
aws s3api get-bucket-versioning --bucket <REDACTED> --profile gogymgo-staging-reconcile --region ca-central-1
aws ce get-cost-and-usage --time-period Start=2026-08-01,End=2026-08-23 --granularity MONTHLY --metrics UnblendedCost NetUnblendedCost --profile gogymgo-staging-reconcile --region us-east-1
~~~

Every regional command used an explicit profile and region. A host-level AWS
environment default points elsewhere, so explicit ca-central-1 remains
mandatory.

## Known unknowns

- Exact Terraform drift and complete proposed resource plan.
- Backend and private-data bucket encryption/lifecycle configuration.
- Deployed ECR image scan result.
- SSM parameter inventory.
- SNS subscription status and deliverability.
- AWS Backup vaults, recovery points, and restore readiness.
- Remaining AWS credit balance and current sharing configuration.
- Authenticated member, operator, and external-provider behavior.
- Whether the current API/worker run is an approved UAT window.

## Proposed remediation phases

### Phase 0 — owner account security

The staging account owner enables root MFA, then returns to non-root operations.
The coordinator will not use root.

### Phase 1 — complete metadata-only evidence

Update the reconciliation permission set with only the missing S3
configuration, SSM inventory, ECR image/scan, SNS, Backup, and Access Analyzer
metadata actions. Remove unused S3 object-name listing actions. Re-run only the
blocked metadata checks.

### Phase 2 — protected Terraform plan

Supply authoritative staging variables. Separately review and approve a
state-access and lock procedure that reads only the staging state key and
creates/removes only its lock object. Run a saved exact-main plan; never apply
it in this phase.

### Phase 3 — infrastructure and least-privilege remediation

Review the Phase 2 plan for:

- restoring versioning on both private-data buckets;
- confirming or repairing bucket encryption and lifecycle rules;
- splitting API, worker, and migration execution roles;
- removing the reward encryption key from the worker;
- attaching and validating runtime alarm actions;
- considering account-level S3 public-access blocking;
- resolving any additional exact-plan drift.

Apply only after a separate exact-resource approval, with rollback and
post-apply validation documented.

### Phase 4 — current-main staging release

Build and scan the exact approved digest, run the protected migration, deploy
worker and API, verify rollback baselines, and repeat health/readiness, TLS,
CORS, alarm, and cost checks. This is a separate deployment approval.

### Phase 5 — UAT and recovery proof

Run authenticated member/operator journeys, provider checks, notification
delivery, migration idempotency, and an approved restore rehearsal. Production
remains out of scope.

## Next approval boundary

The next recommended mutation is limited to the existing
GoGymGoStagingReconcile inline policy for account **…9877**:

- remove s3:ListBucket and s3:ListBucketVersions;
- add s3:GetEncryptionConfiguration and s3:GetLifecycleConfiguration;
- add ssm:DescribeParameters;
- add ecr:DescribeImages and ecr:DescribeImageScanFindings;
- add SNS list/get metadata actions;
- add AWS Backup list/get/describe metadata actions;
- add Access Analyzer list/get metadata actions;
- preserve every explicit deny and all mutation exclusions.

Expected result: close metadata gaps without accessing object contents, secret
values, log events, or decrypted data.

- Direct AWS cost: none.
- Availability effect: none.
- Data-loss effect: none.
- Security effect: slightly broader configuration metadata visibility, offset
  by removing object-name listing and retaining explicit denies.
- Rollback: restore the currently verified inline policy and reprovision.
- Validation: retrieve the saved policy metadata, confirm the deny list, and
  re-run only the previously blocked metadata calls.

No Phase 1 change has been performed.

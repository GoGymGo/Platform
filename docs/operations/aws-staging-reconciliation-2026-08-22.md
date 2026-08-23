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

An explicitly approved Phase 1 policy revision then closed the narrow metadata
gaps. The state bucket is SSE-S3 encrypted; private application buckets use the
GoGymGo KMS key and bucket keys; the deployed image's push scan completed with
no reported findings; Parameter Store is empty; and no SNS topic, subscription,
or regional IAM Access Analyzer exists. AWS Backup metadata remains blocked by
an organization service-control policy rather than this role.

The separately approved protected-plan procedure then initialized an isolated
copy of repository commit 5bc18c8 against the exact staging backend and started
one normal refresh-enabled plan. Refresh stopped safely before producing a plan
because two tag metadata reads and one deployed CloudFront Function code read
were not allowed. The temporary directory was deleted and the role was restored.

After exact approval, a second isolated attempt temporarily added only those
three resource-scoped reads. Terraform completed the plan with detailed exit
code 2, confirming changes are present, but the local post-plan
`terraform show -json` sanitizer could not reopen the saved plan. The fail-closed
cleanup deleted the unsanitized plan and temporary directory. No action list was
retained or inferred. The state ETag and modification time were unchanged, no
lock remains, and the Phase 1 role policy was restored again.

An exactly approved third attempt used the locally validated streaming JSON
sanitizer and completed safely. It retained 48 address/action events: 9 creates,
2 deletes, 22 replacements, 8 updates, and 7 data reads. Three reported bucket
deletions were false refresh signals: all three buckets remain live, but
`HeadBucket` is denied because the role lacks `s3:ListBucket` on application
buckets. The corresponding 3 bucket creates and 19 dependent S3 replacements
are therefore permission artifacts and must not be applied. The remaining 19
non-S3 mutation events are useful but still speculative. State and lock checks,
temporary cleanup, and Phase 1 policy restoration all passed.

After exact approval, a fourth attempt temporarily added `s3:ListBucket` only
on those three application buckets. Direct `HeadBucket` checks then succeeded,
but Terraform stopped before producing a plan because its S3 bucket refresh also
requires `s3:GetAccelerateConfiguration`. The state was unchanged, no lock
remained, the temporary directory was deleted, and the Phase 1 role was restored
with 111 allowed actions, 26 explicit denies, and no temporary Phase 2 markers.
No plan or action list was produced by this attempt.

A fifth exactly approved attempt added that one remaining metadata read on only
the same three buckets. Direct `HeadBucket` and acceleration-configuration checks
all succeeded, and Terraform advanced past the prior S3 authorization barrier.
The streaming sanitizer then encountered a diagnostic event with no `detail`
field and stopped its pipe with exit code 1. Seven early address/action events
were incomplete and discarded from decision-making; no exact plan summary was
claimed. The null-diagnostic parser is now corrected and locally validated. The
state was unchanged, no lock existed before or after, no manual lock cleanup was
needed, both temporary state and application-bucket access were removed, the
isolated directory was deleted, and the Phase 1 role was fully restored.

A sixth exactly approved attempt used the corrected null-safe sanitizer with the
same nine temporary Phase 2 statements and no new AWS action. Terraform 1.15.8
initialized and streamed seven early planned-change events before the plan itself
exited 1 with four diagnostics. The sanitizer completed normally and found no
IAM action token in the diagnostic details, but it intentionally retained no raw
diagnostic text. The event stream is incomplete and was discarded again. State,
lock, access-removal, role-restoration, and temporary-directory checks all
passed. The next diagnostic sanitizer will retain only redacted diagnostic
category/API-operation labels so a further failure can be classified safely.

A seventh exactly approved attempt repeated those same permissions and added the
approved fixed diagnostic labels. Terraform again exited 1 after the same seven
early planned-change events and four error diagnostics. All four labels were
`detail-free-diagnostic`: Terraform supplied no `detail`, API operation, HTTP
status, or IAM action token. The classifier did not inspect `summary` for a
category, so the cause remains unknown and the incomplete events were discarded.
All state, lock, access-removal, role-restoration, and cleanup checks passed. The
next classifier will derive the same fixed labels from both `summary` and
`detail` in memory while retaining neither raw field.

An eighth exactly approved attempt used that classifier. Terraform again exited
1 after seven incomplete planned-change events, but the four fixed labels now
identified the exact causes: three S3 `GetBucketReplication` reads returned 403
because IAM action `s3:GetReplicationConfiguration` was absent, and one ECR
`ListTagsForResource` read returned 400 because the temporary statement targeted
a nonexistent `/api` repository suffix. Live ECR metadata confirms the exact
Terraform repository is `gogymgo-staging-backend`. The partial events were
discarded. State, lock, access-removal, role-restoration, and cleanup checks all
passed.

The ninth exactly approved attempt added only those two corrections. Direct
checks proved ECR tag metadata and all three bucket replication configurations
were readable. Terraform 1.15.8 then completed with detailed exit code 2 and
zero diagnostics. The corrected exact plan contains 22 sanitized events: 6
creates, 2 deletes, 3 replacements, 10 updates, and 1 data read. There are no
bucket creates or broad S3 replacements. State and lock checks, permission
restoration, access removal, and temporary-directory cleanup all passed.

No apply, deployment, secret value read, application-object read, database
connection, log-content query, restore, rotation, scaling change, or
application-resource mutation occurred. Terraform state access was limited to
the exact staging state object and was never printed or retained outside the
deleted temporary working directory. The explicitly approved CloudFront read
was limited to the deployed member-web function code used for drift comparison.

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
| Restrictions | No application-resource mutation, secret values, application-object contents, log events, database log download, decryption, or interactive execution; the approved permission-set reprovision and transient lock procedure are the only control-plane mutations |

The access portal now exposes the existing staging account to the existing
workforce identity. After the approved Phase 1 revision, the permission set has
one account assignment, 111 allowed metadata/cost actions, and 26 explicit
sensitive-data/execution denies.

## Gate classification

| Gate | Observed live state | Classification | Risk | Required next action |
| --- | --- | --- | --- | --- |
| Account isolation | Existing active member account ending 9877; caller and region match | VERIFIED | None | Preserve account guardrails |
| Non-root access | Restricted two-hour SSO role is assigned and usable | VERIFIED | Low | Retain; tighten unused list permissions |
| Root protection | No IAM users or account keys, but root MFA is disabled | GAP FOUND | High | Account owner enables root MFA outside this non-root workflow |
| Remote backend | Expected state key and versions exist; public access blocked; no current lock | VERIFIED | Low | Preserve backend and default workspace |
| Backend encryption | State bucket uses SSE-S3; versioning remains enabled | VERIFIED | Low | Preserve |
| Exact Terraform drift | Corrected Terraform 1.15.8 plan completed with 21 mutation events and 1 data read; zero diagnostics or permission artifacts | VERIFIED | High | Stage remediation; do not apply the full plan while services still reference the legacy execution role |
| Network | Expected VPC, subnet, IGW, no-NAT, and security-group shape | VERIFIED | Low | No immediate action |
| ECS runtime | API 1/1 and worker 1/1, steady, no pending tasks | VERIFIED | Medium | Confirm active-cost window is intentional |
| Deployed source | Running commit is 78 commits behind current main | GAP FOUND | High | Build, scan, plan, and deploy an approved current-main digest later |
| ECR assurance | Immutable and scan-on-push; deployed image push scan completed with no reported findings | VERIFIED | Medium | Require a fresh scan for a current-main digest |
| Load balancer/readiness | Active TLS listener, healthy target, health/readiness HTTP 200 | VERIFIED | Low | Re-run after deployment |
| Member web | Private-origin CloudFront; public routes HTTP 200; CORS correct | VERIFIED | Low | Authenticated UAT remains separate |
| RDS protection | Private, encrypted, forced SSL, 14-day PITR, daily automated snapshots | VERIFIED | Medium | Rehearse restore under separate approval |
| RDS deletion safety | Deletion protection disabled; no manual snapshot | GAP FOUND | Medium | Decide whether staging policy should change |
| Private S3 versioning | User-content and privacy-export versioning suspended | GAP FOUND | High | Restore versioning through reviewed Terraform |
| S3 public access | All relevant buckets individually block public access | VERIFIED | Low | Consider account-level defense in depth |
| S3 encryption/lifecycle | Private buckets use the GoGymGo KMS key; privacy current expiry is seven days, but both buckets lack current Terraform's noncurrent-version rules | GAP FOUND | High | Restore versioning and lifecycle rules through reviewed Terraform |
| KMS | Customer key enabled with annual rotation | VERIFIED | Low | No immediate action |
| Secret containers | Six app containers plus managed DB secret; no values read | VERIFIED | Low | Preserve out-of-band value handling |
| Runtime secret isolation | One shared execution role; worker receives reward key | GAP FOUND | High | Apply current role/task-definition scoping |
| Optional features | Privacy/push secrets empty and matching flags disabled | VERIFIED | Low | Populate only with separate approval |
| Runtime alarms | Five alarms are OK but all alarm/OK actions are empty | GAP FOUND | High | Add and validate an incident destination |
| Budget notifications | $100 budget; thresholds have redacted email subscribers | VERIFIED | Medium | Confirm delivery with an authorized test |
| SNS routing | No topics or subscriptions exist | GAP FOUND | High | Create, confirm, attach, and test an approved incident destination |
| Backup inventory | RDS backups verified; organization SCP explicitly denies AWS Backup inventory; restore untested | BLOCKED BY PERMISSIONS | High | Review the SCP before any Backup inspection; separately approve restore rehearsal |
| DNS/TLS | Cloudflare owns DNS; expected certificates issued/in use/renewable | VERIFIED | Low | Preserve ownership and recheck after ALB changes |
| Current costs | Gross $63.55, credits -$63.55, net about $0 for August 1–22 | VERIFIED | Medium | Continue monitoring; investigate CloudWatch spend |
| Credit balance/sharing | Payer Billing API denied because IAM billing access is inactive | BLOCKED BY PERMISSIONS | Medium | Do not promise future all-credit coverage |
| Protected deployment | Current release is older; exact infrastructure plan is verified, but full apply has a legacy execution-role cutover hazard | REQUIRES MUTATION APPROVAL | High | Stage bucket versioning, implement two-phase role cutover, then approve exact deployment |
| Authenticated UAT | Public routing only was tested | NOT YET TESTED | High | Run after approved current-main staging release |

## Terraform backend and drift

The backend is a staging-only S3 bucket in ca-central-1 with the expected
gogymgo/staging/terraform.tfstate key. Tags identify the GoGymGo staging
environment and Terraform-state purpose. Versioning is enabled, all four public
access controls are enabled, and the bucket policy is non-public. There is no
current .tflock object. The object layout supports the default workspace. Phase
1 verified SSE-S3 encryption and no lifecycle configuration on the state
bucket.

The approved Phase 2 procedure temporarily allowed read access to only the exact
state object, read/write/delete access to only its exact .tflock object, and
bucket listing only for those keys. Required non-secret inputs were derived in
process from ECS, RDS, ALB/ACM, CloudFront, CloudWatch, and Budgets metadata.
Feature flags absent from the 78-commit-old task definition used the committed
safe default of false.

Terraform 1.15.8 successfully initialized a fresh temporary copy of commit
5bc18c8 against the verified backend. A normal refresh-enabled plan then exited
1 before producing a plan because three read operations were denied:

- budgets:ListTagsForResource;
- cloudfront:GetFunction, which reads the deployed CloudFront Function code for
  drift comparison;
- ecr:ListTagsForResource.

No raw state or plan was printed or committed. The temporary working directory
and any partial plan material were deleted. Terraform released its native lock;
an exact post-run check found no .tflock object. The state object's modification
time remained August 11, and the target role was restored to the Phase 1 policy
with 111 metadata actions and all 26 explicit sensitive-data/execution denies.

The separately approved retry scoped those three reads to the exact staging
budget, ECR repository, and Terraform-managed member-web CloudFront Function.
Terraform initialized an isolated copy of commit 36144c2 and completed a normal
refresh-enabled plan with detailed exit code 2. This proves the committed
configuration and refreshed staging state are not identical. The saved plan was
not applied. Its local `terraform show -json` sanitization step failed, so the
fail-closed helper deleted the plan rather than printing, committing, or
retaining unsanitized content. The state ETag and last-modified value matched
their pre-plan values, no lock remained, the temporary directory was deleted,
and the target role was restored to 111 allows and 26 denies. Exact resource
actions therefore remain unknown.

The exactly approved streaming-JSON retry initialized an isolated copy of
commit 75dbfca and completed with detailed exit code 2. It retained only resource
addresses and action types:

- 9 creates;
- 2 deletes;
- 22 replacements;
- 8 updates;
- 7 data reads.

The 22 S3 mutations are not trustworthy. Refresh reported the three live
application buckets as deleted, which cascaded into 3 bucket creates and 19
replacements of CORS, lifecycle, ownership, policy, public-access, encryption,
and versioning resources. Direct checks confirmed that `HeadBucket` is denied on
all three buckets because the role lacks `s3:ListBucket`; prior reconciliation
already verified the buckets are live. These events are permission artifacts,
not an apply candidate.

Excluding those S3 artifacts, the sanitized plan contains 19 non-S3 mutation
events:

- create three role-scoped ECS execution roles and their three policies;
- delete the old shared ECS execution role and policy;
- replace the API, worker, and migration task definitions;
- update the monthly budget, member-web CloudFront distribution and function,
  worker service, and four IAM role policies.

| Non-S3 resource address | Action |
| --- | --- |
| aws_budgets_budget.monthly | update |
| aws_cloudfront_distribution.member_web | update |
| aws_cloudfront_function.member_web_spa | update |
| aws_ecs_service.worker | update |
| aws_ecs_task_definition.api | replace |
| aws_ecs_task_definition.migration | replace |
| aws_ecs_task_definition.worker | replace |
| aws_iam_role.ecs_execution | delete |
| aws_iam_role.ecs_execution["api"] | create |
| aws_iam_role.ecs_execution["migration"] | create |
| aws_iam_role.ecs_execution["worker"] | create |
| aws_iam_role_policy.api | update |
| aws_iam_role_policy.ecs_execution | delete |
| aws_iam_role_policy.ecs_execution["api"] | create |
| aws_iam_role_policy.ecs_execution["migration"] | create |
| aws_iam_role_policy.ecs_execution["worker"] | create |
| aws_iam_role_policy.github_deploy | update |
| aws_iam_role_policy.github_member_web_deploy | update |
| aws_iam_role_policy.worker | update |

Seven IAM policy-document data reads are non-mutating. Refresh also identified
non-S3 drift addresses for the member-web distribution/function, database,
API/worker services, API task definition, shared execution role, and owner-email
secret metadata. Attribute values were intentionally not retained, so these
addresses are evidence for a corrected plan, not an exact mutation approval.

The state ETag and last-modified value again matched their pre-plan values,
Terraform removed its lock without manual cleanup, the temporary plan and
directory were deleted, and the target role was restored to 111 allows and 26
denies. No apply occurred.

The fourth exactly approved attempt initialized an isolated copy of commit
f17b216 after temporarily adding `s3:ListBucket` only on the exact content,
privacy, and member-web buckets. All three direct `HeadBucket` checks succeeded.
Terraform initialization succeeded, but refresh stopped with exit code 1 before
producing a plan because `s3:GetAccelerateConfiguration` was not allowed. The
state ETag and last-modified value were unchanged, Terraform left no lock, the
temporary directory was deleted, and the target role was restored to 111 allows,
26 denies, and zero Phase 2 markers. No apply occurred.

The exact-version [Terraform AWS Provider v6.57.1 bucket reader](https://github.com/hashicorp/terraform-provider-aws/blob/v6.57.1/internal/service/s3/bucket.go)
shows that `aws_s3_bucket` refresh calls `GetBucketAccelerateConfiguration` after
the bucket policy, ACL, CORS, website, and versioning reads. Comparing that
sequence with the Phase 1 policy shows `s3:GetAccelerateConfiguration` is the
remaining uncovered bucket-read action: the other calls are covered by
`s3:GetBucket*`, `s3:GetEncryptionConfiguration`, or
`s3:GetLifecycleConfiguration`. This source review bounds the next retry to one
additional action rather than another iterative permission-discovery run.

The fifth exactly approved invocation temporarily added
`s3:GetAccelerateConfiguration` only on the exact content, privacy, and
member-web buckets while repeating the prior exact Phase 2 statements. All three
`HeadBucket` and acceleration-configuration calls succeeded. Terraform 1.15.8
initialized successfully and began emitting sanitized planned-change events,
but its stream included a diagnostic event with no `detail` property. The local
sanitizer attempted to search that null value, terminated the pipe, and produced
exit code 1. Seven early address/action events and four drift events had already
passed the sanitizer, but the stream was incomplete, so they are not retained as
an exact plan or used to authorize remediation.

The sanitizer now treats a missing diagnostic detail as an empty value while
continuing to count the diagnostic. A synthetic local test passed both a
detail-free warning and an authorization diagnostic through that code, retaining
only the example action token. No further cloud run occurred. For the fifth
invocation, the state ETag and last-modified value matched their pre-plan values,
there were zero locks before and after, no manual cleanup was required, the
temporary directory was deleted, and post-rollback checks confirmed application
bucket `HeadBucket` and state `HeadObject` were denied again. The restored role
has 111 allows, 26 denies, and zero Phase 2 markers.

The sixth exactly approved invocation repeated the same exact permissions and
used that corrected sanitizer. Terraform 1.15.8 initialized successfully. The
sanitizer handled all diagnostic records without throwing, but Terraform itself
exited 1 after emitting four diagnostics. Seven planned-change events and four
drift events had appeared before the failure; because the stream did not
complete, they were discarded from decision-making and are not an exact plan.
No IAM action token was present in the retained diagnostic classification. Raw
diagnostic summaries and details were neither printed nor retained, so the error
category remains unknown.

The next sanitizer revision is limited to retaining a redacted diagnostic
summary category and AWS API-operation token, if present. It will remove account
IDs, ARNs, request IDs, host IDs, email-shaped values, and other free-form detail;
it will not retain raw diagnostic text or attribute values. For the sixth
invocation, the state fingerprint was unchanged, there were zero locks before
and after, no manual cleanup was needed, application-bucket and state access were
denied again after rollback, the isolated directory was deleted, and the role
returned to 111 allows, 26 denies, and zero temporary markers.

The seventh exactly approved invocation repeated the same permissions and added
only the fixed diagnostic label fields. Terraform again emitted seven
planned-change and four drift events before exiting 1 with four error
diagnostics. Each label reported `detail-free-diagnostic`; no API operation,
HTTP status, or IAM action token was present. The sanitizer intentionally did
not use or retain the diagnostic `summary`, so the underlying cause remains
unclassified. The partial change stream was discarded.

The next classifier will combine `summary` and `detail` only transiently in
memory, map them to the same fixed category/API-operation/status/action fields,
and discard both raw strings. This does not expand retained data. For the seventh
invocation, the state fingerprint remained unchanged, there were zero locks
before and after, no manual cleanup was needed, application-bucket and state
access were denied after rollback, the isolated directory was deleted, and the
role returned to 111 allows, 26 denies, and zero temporary markers.

The eighth exactly approved invocation used the combined classifier and produced
four useful fixed labels without retaining raw diagnostic text:

- three `provider-read-error` labels for `S3.GetBucketReplication`, HTTP 403,
  IAM action `s3:GetReplicationConfiguration`;
- one `provider-read-error` label for `ECR.ListTagsForResource`, HTTP 400, IAM
  action `ecr:ListTagsForResource`.

The three S3 failures correspond to the exact content, privacy, and member-web
buckets. The provider source calls `GetBucketReplication`, whose IAM action name
is not matched by the Phase 1 `s3:GetBucket*` pattern. The ECR permission action
was already approved, but its temporary resource ARN incorrectly appended
`/api`. Direct live metadata and current Terraform both identify the repository
as `gogymgo-staging-backend`; no repository named with that suffix exists.

The seven planned-change and four drift events preceding the failure remain
incomplete and were discarded. The state fingerprint was unchanged, zero locks
existed before and after, no manual cleanup was required, both temporary access
paths were denied again after rollback, the isolated directory was deleted, and
the role returned to 111 allows, 26 denies, and zero temporary markers.

The ninth exactly approved invocation temporarily added only
`s3:GetReplicationConfiguration` on the three application buckets and corrected
the ECR tag-read ARN to `gogymgo-staging-backend`. Direct authorization checks
passed. Terraform initialized and completed with detailed exit code 2, zero
diagnostics, and no denied actions. The exact sanitized plan is:

| Terraform address | Action |
| --- | --- |
| aws_cloudfront_function.member_web_spa | update |
| aws_cloudwatch_metric_alarm.unhealthy_targets | update |
| aws_ecs_service.worker | update |
| aws_ecs_task_definition.api | replace |
| aws_ecs_task_definition.migration | replace |
| aws_ecs_task_definition.worker | replace |
| aws_iam_role_policy.api | update |
| aws_iam_role_policy.ecs_execution | delete |
| aws_iam_role_policy.ecs_execution["api"] | create |
| aws_iam_role_policy.ecs_execution["migration"] | create |
| aws_iam_role_policy.ecs_execution["worker"] | create |
| aws_iam_role_policy.github_deploy | update |
| aws_iam_role_policy.worker | update |
| aws_iam_role.ecs_execution | delete |
| aws_iam_role.ecs_execution["api"] | create |
| aws_iam_role.ecs_execution["migration"] | create |
| aws_iam_role.ecs_execution["worker"] | create |
| aws_s3_bucket_lifecycle_configuration.content | update |
| aws_s3_bucket_lifecycle_configuration.privacy | update |
| aws_s3_bucket_versioning.content | update |
| aws_s3_bucket_versioning.privacy | update |
| data.aws_iam_policy_document.github_deploy | read |

The six creates and two deletes split the legacy shared ECS execution role and
policy into API, migration, and worker roles/policies. The three task-definition
replacements adopt that split. The remaining updates cover the member-web SPA
function, unhealthy-target alarm, worker service, API/worker/deployment IAM
policies, and private-bucket versioning/lifecycle controls. The one data read is
non-mutating.

Eight refreshed drift addresses were observed separately: the member-web
distribution/function, database, API/worker services, API task definition,
legacy execution role, and owner-email secret metadata. These describe changes
AWS reported during refresh; only the 22 planned-change events above are proposed
configuration actions.

The full plan is not safe to apply as an isolated step. Both live services still
reference legacy task-definition revisions, and Terraform intentionally ignores
service `task_definition` changes. A full apply would register the new split-role
task definitions while deleting the shared execution role without moving the
services. A later restart of an old revision could then fail to pull its image or
mount secrets. Role cutover must be staged with deployment or implemented as a
two-phase migration. The recommended first mutation is therefore limited to
enabling versioning on the two private-data buckets; lifecycle changes and the
runtime role cutover remain separate approvals.

For the ninth invocation, the state fingerprint was unchanged, there were zero
locks before and after, no manual cleanup was needed, both temporary access paths
were denied again after rollback, the isolated directory was deleted, and the
role returned to 111 allows, 26 denies, and zero temporary markers. No apply
occurred.

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

The deployed image was pushed August 12 and is approximately 346 MiB. Its basic
push scan completed successfully with no reported severity findings. This
attests that historical push scan, not a current continuous re-scan or a future
current-main image.

## Security and data protection

Confirmed controls:

- no IAM users or account access keys;
- GitHub OIDC restricted to the expected audience, immutable organization and
  repository identifiers, and protected staging environment;
- member-web deployment restricted to its bucket and CloudFront distribution;
- private encrypted RDS, forced SSL, and active rotating managed master secret;
- enabled application KMS key with annual rotation;
- KMS encryption and bucket keys on the private content/privacy buckets;
- SSE-S3 encryption on member-web and Terraform-state buckets;
- bucket-owner-enforced ownership and individual public-access blocking;
- no cross-account resource policy on application secrets;
- no Parameter Store parameters.

Gaps:

- root MFA is disabled;
- account-level S3 public-access blocking is not configured;
- API, worker, and migration share one execution role that can retrieve all six
  application secrets;
- the live worker receives REWARD_CODE_ENCRYPTION_KEY, while current Terraform
  reserves it for the API;
- the content and privacy buckets lack current Terraform's noncurrent-version
  expiry rules, while their versioning remains suspended;
- no regional IAM Access Analyzer exists;
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
The Phase 1 retry proved that the remaining denial is an explicit organization
service-control policy, so another Identity Center policy expansion cannot
resolve it.

## Observability and alerting

The application log group has 30-day retention, KMS metadata, two metric
filters, and approximately 68 MB stored. Five expected alarms exist and are
currently OK. Every alarm has empty alarm and OK actions, so there is no runtime
incident notification routing. Phase 1 confirmed that the account has zero SNS
topics and zero SNS subscriptions. Budget email notifications are separate.

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

The approved Phase 1 revision removed S3 bucket-listing permissions and added
only the previously blocked configuration reads. The revised policy was
reprovisioned to account 9877 and validated on the target role with all 26
explicit denies unchanged. Every expanded check succeeded except AWS Backup.

The approved retry proved that budgets:ListTagsForResource and
ecr:ListTagsForResource can be scoped to the exact staging resources and that
cloudfront:GetFunction can be scoped to the exact Terraform-managed member-web
function. The plan completed with those temporary reads; they were then removed.

Remaining access constraints:

- The approved temporary `s3:ListBucket` grant on the exact content, privacy,
  and member-web buckets made all three `HeadBucket` checks succeed. The fifth
  attempt also proved temporary `s3:GetAccelerateConfiguration` works on only
  those same three buckets and advanced Terraform past the prior S3 barrier. The
  classified eighth attempt found one further provider mapping:
  `GetBucketReplication` requires temporary `s3:GetReplicationConfiguration` on
  those same exact buckets. A retry must repeat all three grants;
  `s3:ListBucket` technically permits listing object key names, but object
  content reads remain explicitly denied.
- The approved ECR tag action was scoped to an incorrect repository ARN with an
  `/api` suffix. Live metadata confirms the corrected exact repository is
  `gogymgo-staging-backend`. The ninth attempt corrected and proved that scope;
  the temporary permission was then removed.
- The ninth attempt proved `s3:GetReplicationConfiguration` on the three exact
  application buckets. It was removed with every other Phase 2 statement after
  the completed plan. No permission blocker remains for the corrected plan.
- AWS Backup plan/vault/recovery-point listing is explicitly denied by an
  organization service-control policy. IAM Identity Center cannot override it.
- Payer billing:GetCredits remains unavailable because IAM billing access is not
  activated in the management account.

The original backend-only object listing verified the expected state key and
lock metadata. No application-data bucket was listed, and the listing actions
are no longer present.

## Representative commands

The explicitly approved access mutation used sanitized forms of:

~~~powershell
aws sso-admin create-permission-set <instance> --name GoGymGoStagingReconcile --session-duration PT2H
aws sso-admin put-inline-policy-to-permission-set <instance> <permission-set> --inline-policy <approved-policy>
aws sso-admin create-account-assignment <instance> --target-id <STAGING_ACCOUNT> --permission-set-arn <permission-set> --principal-type USER --principal-id <WORKFORCE_USER>
~~~

The separately approved Phase 1 revision used:

~~~powershell
aws sso-admin put-inline-policy-to-permission-set <instance> <permission-set> --inline-policy <APPROVED_PHASE_1_POLICY>
aws sso-admin provision-permission-set <instance> <permission-set> --target-type AWS_ACCOUNT --target-id <STAGING_ACCOUNT>
~~~

Representative read-only commands:

~~~powershell
aws sts get-caller-identity --profile gogymgo-staging-reconcile --region ca-central-1
aws ecs describe-services --cluster gogymgo-staging --services gogymgo-staging-api gogymgo-staging-worker --profile gogymgo-staging-reconcile --region ca-central-1
aws elbv2 describe-target-health --target-group-arn <REDACTED> --profile gogymgo-staging-reconcile --region ca-central-1
aws rds describe-db-instances --profile gogymgo-staging-reconcile --region ca-central-1
aws s3api get-bucket-versioning --bucket <REDACTED> --profile gogymgo-staging-reconcile --region ca-central-1
aws s3api get-bucket-encryption --bucket <REDACTED> --profile gogymgo-staging-reconcile --region ca-central-1
aws ecr describe-image-scan-findings --repository-name <REDACTED> --image-id imageDigest=sha256:<REDACTED> --profile gogymgo-staging-reconcile --region ca-central-1
aws sns list-topics --profile gogymgo-staging-reconcile --region ca-central-1
aws backup list-backup-vaults --profile gogymgo-staging-reconcile --region ca-central-1
aws ce get-cost-and-usage --time-period Start=2026-08-01,End=2026-08-23 --granularity MONTHLY --metrics UnblendedCost NetUnblendedCost --profile gogymgo-staging-reconcile --region us-east-1
~~~

Every regional command used an explicit profile and region. A host-level AWS
environment default points elsewhere, so explicit ca-central-1 remains
mandatory.

## Known unknowns

- Exact Terraform drift and complete proposed resource plan.
- AWS Backup vaults and recovery points because of the organization SCP.
- Restore readiness and notification delivery behavior.
- Remaining AWS credit balance and current sharing configuration.
- Authenticated member, operator, and external-provider behavior.
- Whether the current API/worker run is an approved UAT window.

## Proposed remediation phases

### Phase 0 — owner account security

The staging account owner enables root MFA, then returns to non-root operations.
The coordinator will not use root.

### Phase 1 — complete metadata-only evidence — completed

The explicitly approved policy revision added only the missing S3
configuration, SSM inventory, ECR image/scan, SNS, Backup, and Access Analyzer
metadata actions and removed the broad S3 bucket-listing actions. The policy
was reprovisioned and all target-role safeguards were validated. All checks
succeeded except AWS Backup, which is explicitly denied by an organization SCP.

### Phase 2 — protected Terraform plan — completed

The approved exact state-access and lock procedure was run from an isolated copy
with live non-secret inputs held in process. The first attempt identified three
missing reads. An exactly approved retry added them only for their staging
resources and completed with exit code 2. The post-plan JSON sanitizer then
failed, so no resource-action summary was retained. Both attempts passed role,
lock, state, and temporary-directory rollback checks. A further run requires new
approval; never apply in this phase.

A backend-disabled local probe then verified that Terraform 1.15.8 emits
`planned_change` events containing the resource address and action through
`terraform plan -json`. The probe returned detailed exit code 2, the sanitizer
retained only those two fields, and all local probe artifacts were removed.

The approved streaming retry then retained the 48 resource address/action events
described above. It exposed an S3 refresh-permission artifact: the three live
buckets appeared deleted because `HeadBucket` was denied. The 22 resulting S3
mutations are invalid. A fourth approved attempt temporarily added the exact
three-bucket `s3:ListBucket` grant and proved all three `HeadBucket` checks now
succeed, but Terraform stopped before producing a plan on
`s3:GetAccelerateConfiguration`. Cleanup and full role restoration passed. The
provider's exact-version bucket-reader source identifies that action as the
remaining uncovered bucket metadata read.

The fifth approved invocation added only that exact action and advanced past the
S3 barrier. Its streaming sanitizer then stopped on a Terraform diagnostic event
that omitted `detail`; seven early planned-change events were necessarily
incomplete and discarded. The null case is locally corrected and validated, all
rollback checks passed, and one further plan requires new exact approval.

The sixth approved invocation proved the null-safe parser itself now completes,
but Terraform emitted four unclassified diagnostics and exited 1 after seven
incomplete planned-change events. Those events were discarded. A further run
requires new approval and will retain only redacted diagnostic category and API
operation labels if Terraform fails again.

The seventh approved invocation retained those labels, but all four errors were
classified only as `detail-free-diagnostic` because Terraform populated no
`detail` field and the sanitizer did not inspect `summary`. The seven partial
events were discarded. A further run requires new approval to derive the same
fixed labels from both raw fields transiently without retaining either one.

The eighth approved invocation used both fields transiently and identified three
missing exact-bucket `s3:GetReplicationConfiguration` reads plus one ECR tag read
whose approved action was attached to the wrong repository ARN. The partial
events were discarded and all rollback checks passed. A further run requires new
approval for the additional S3 action and corrected ECR resource scope.

The ninth approved invocation applied only those temporary read corrections and
completed the exact sanitized plan with exit code 2 and zero diagnostics. Phase
2 is complete. Never apply the full plan directly: stage private-bucket
versioning first and coordinate the execution-role/task-definition cutover with
the protected deployment.

### Phase 3 — infrastructure and least-privilege remediation

Stage the Phase 2 plan rather than applying it as one operation:

- Phase 3A enables versioning only on both private-data buckets;
- Phase 3B separately reviews lifecycle retention before enabling noncurrent
  deletion;
- Phase 3C implements a two-phase API, worker, and migration execution-role
  cutover that preserves the legacy role until services use new task revisions;
- removing the reward encryption key from the worker;
- attaching and validating runtime alarm actions;
- considering account-level S3 public-access blocking;
- applying the member-web function and remaining exact-plan updates only in a
  reviewed order.

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

The next recommended mutation is Phase 3A: enable versioning only on the content
and privacy buckets in account **…9877**, ca-central-1. The completed full plan
shows both as exact updates. Lifecycle rules, IAM roles/policies, task
definitions, ECS services, alarms, and CloudFront remain out of scope for this
phase.

IAM Identity Center change:

- repeat the exact resource-scoped metadata reads that produced the successful
  corrected plan;
- temporarily allow `s3:PutBucketVersioning` only on the content and privacy
  bucket ARNs;
- allow s3:GetObject, s3:GetObjectVersion, and s3:PutObject only for the exact
  gogymgo/staging/terraform.tfstate object so Terraform can persist the approved
  apply result;
- allow s3:GetObject, s3:PutObject, and s3:DeleteObject only for the exact
  gogymgo/staging/terraform.tfstate.tflock object;
- allow s3:ListBucket only for that exact state/lock prefix;
- restructure the existing S3 object-read deny so every other object in every
  bucket remains explicitly denied;
- preserve all secret, application-object, log-event, decryption, and execution
  denies.

Terraform operation:

- copy the exact committed Terraform source to a fresh temporary directory;
- initialize that copy against the verified staging backend without migrating
  or replacing state;
- derive required non-secret variables from already authorized live metadata,
  holding private values only in process memory;
- create one saved, refresh-enabled plan targeted only to
  `aws_s3_bucket_versioning.content` and
  `aws_s3_bucket_versioning.privacy`;
- fail closed unless the saved plan contains exactly two updates and no other
  create, replace, delete, update, or read action;
- apply only that exact saved plan; never run a general apply or auto-approve;
- remove the saved plan and isolated directory after validation.

Expected AWS mutations are limited to updating/reprovisioning the reconciliation
role, Terraform's transient creation/deletion of the exact .tflock object,
updating the exact state object, and enabling versioning on the two named
private-data buckets.

- Direct AWS API cost: no material charge expected. Storage cost can rise as
  future overwritten/deleted objects retain versions; credit eligibility is not
  guaranteed.
- Availability effect: none.
- Data-loss effect: none expected; lifecycle rules are not changed and no object
  read, write, or delete is authorized. Existing and future versions are not
  deleted by this phase.
- Security effect: stronger recovery for future object changes; temporary write
  access to one versioned Terraform state object and versioning configuration on
  only two buckets.
- Rollback: if versioning validation fails, use the same exact
  `s3:PutBucketVersioning` scope to return the affected bucket to `Suspended`,
  then stop and record the resulting Terraform drift. Restore the Phase 1 role,
  confirm no lock remains, and delete the temporary directory. Versions created
  while enabled remain recoverable.
- Validation: verify caller/account/region and target role policy, confirm the
  backend and exact commit, verify the saved plan contains only the two approved
  updates, require both live bucket statuses to be `Enabled`, run a targeted
  post-apply plan expecting zero changes, confirm the state object gained only
  the expected version and no lock remains, restore the role, and verify the
  repository remains clean.

Nine Phase 2 plan invocations occurred. The first stopped on three read
denials. The second completed but its local post-plan sanitizer failed. The third
used the validated streaming sanitizer and exposed the S3 HeadBucket permission
artifact. The fourth proved the exact-bucket `s3:ListBucket` fix and stopped on
the one remaining uncovered provider bucket read,
`s3:GetAccelerateConfiguration`. The fifth proved that final metadata permission
but its streaming sanitizer stopped on a null-detail diagnostic, so its partial
events were discarded. The sixth proved the null-safe sanitizer, but Terraform
itself exited 1 with four unclassified diagnostics after seven incomplete
events. The seventh retained fixed labels, but all four were detail-free because
only `detail` was classified; `summary` was not inspected. The eighth classified
both fields and found three missing S3 replication reads plus the incorrect ECR
resource ARN. The ninth corrected those scopes and completed the exact plan with
zero diagnostics. All attempts rolled back completely and no apply occurred.

# AWS account and cost plan

Status: no-deploy migration prepared; no AWS resources or DNS changes have been
made. Account emails, the real Terraform plan, and the Firebase credential method
remain approval gates.

## Isolation gate

Keep the existing AWS Organizations management account named `Souvenote` as the
billing and governance account only. Create two member accounts with unique root
email aliases:

- `GoGymGo-Staging`
- `GoGymGo-Production`

Each environment gets a distinct account ID, Terraform state bucket, state lock,
GitHub environment, OIDC deployment role, Firebase project, VPC, database, ECR
repository, S3 buckets, KMS key, Secrets Manager secrets, logs, alarms, and budget.
Terraform requires the expected account ID and configures the AWS provider's
`allowed_account_ids` guard, so an apply fails before creating resources if the
operator is authenticated to Souvenote or the other GoGymGo environment.

AWS Organizations credit sharing may make management-account promotional credits
available to member accounts, subject to the credit's service and account
eligibility. Confirm coverage in Billing after the first staging usage appears;
budgets alert but do not stop resources automatically.

## Resources per active environment

- one VPC in `ca-central-1`, two public runtime subnets, two private database
  subnets, one internet gateway, and no NAT Gateway;
- one private encrypted PostgreSQL 17 RDS instance with an AWS-managed master
  credential, 20 GB GP3 storage, backups, and point-in-time recovery;
- one ECS Fargate API task, one Fargate worker task, and an on-demand migration
  task, with separate runtime roles and no direct inbound task access;
- one internet-facing HTTPS Application Load Balancer and ACM certificate;
- one immutable ECR repository, two private encrypted S3 buckets, one KMS key,
  five application secret containers plus the RDS-managed master secret;
- CloudWatch logs, five alarms, and one monthly AWS Budget;
- one GitHub OIDC provider and a deployment role restricted to the matching
  `GoGymGo/Platform` protected GitHub environment.

Cloudflare remains the DNS and admin-access edge. DNS is a separate approval gate.

## Approximate monthly cost

Estimate captured 2026-08-02 in USD, using 730 hours/month and AWS on-demand
prices for Canada Central. It excludes taxes, Cloudflare/Firebase charges,
meaningful internet egress, and unusual log, request, or storage volume.

| Component                                          | Active staging estimate | Basis                                          |
| -------------------------------------------------- | ----------------------: | ---------------------------------------------- |
| Two Fargate tasks                                  |                  $19.82 | 0.25 vCPU and 0.5 GB each                      |
| Application Load Balancer                          |     $18.07 plus LCU use | $0.02475/hour; pilot LCU use should be low     |
| Four public IPv4 addresses                         |                  $14.60 | two ALB plus two task addresses at $0.005/hour |
| RDS `db.t4g.micro`                                 |                  $13.14 | $0.018/hour                                    |
| 20 GB RDS GP3                                      |                   $2.54 | $0.127/GB-month                                |
| Six Secrets Manager secrets                        |             about $2.40 | five runtime plus one RDS-managed secret       |
| One customer-managed KMS key                       |             about $1.00 | requests are additional                        |
| ECR, S3, logs, alarms, requests, and backup growth |                  $3-$10 | low-volume pilot allowance                     |
| **Active staging total**                           | **about $75-$90/month** | before tax and material egress                 |

Starting production with `db.t4g.small`, one API task, and one worker task is
approximately **$90-$110/month**. Enabling Multi-AZ, NAT Gateways, more tasks, or
high traffic is a separate cost and availability decision.

Idle staging is not free. Scaling both tasks to zero leaves the ALB, its public
addresses, RDS, storage, secrets, and KMS at roughly **$45-$55/month**. Destroying
the staging ALB through a separately reviewed Terraform plan lowers the retained
floor to roughly **$22-$30/month**, but its Cloudflare DNS target must be reviewed
again when the ALB is recreated. RDS can be stopped temporarily, but AWS restarts
it after seven days.

At the observed credit balance of approximately $4,874.55 expiring 2028-03-31,
one active staging environment plus the planned production pilot fits within the
credit runway at these estimates, provided the credits apply to these services.
Review Cost Explorer and the member-account budgets after 24-48 hours of staging
usage before approving production.

Pricing references: [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/),
[Elastic Load Balancing pricing](https://aws.amazon.com/elasticloadbalancing/pricing/),
[Amazon VPC public IPv4 pricing](https://aws.amazon.com/vpc/pricing/),
[Amazon RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/),
[AWS Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/), and
[AWS KMS pricing](https://aws.amazon.com/kms/pricing/).

## Approval sequence

1. Supply the two unique account root email aliases. Never supply passwords,
   verification codes, or access keys.
2. Create the two member accounts and verify that Souvenote has no GoGymGo
   workloads, secrets, or Terraform state.
3. Bootstrap separate encrypted Terraform state in each member account.
4. Populate staging inputs and generate a real saved Terraform plan.
5. Review the exact plan and cost estimate; only then approve staging apply.
6. Choose and approve Firebase credential federation from AWS. Do not create a
   long-lived Firebase service-account key unless federation is proven
   impractical and the exception is explicitly approved.
7. Populate approved secret values outside Terraform state, issue ACM, and
   review the exact Cloudflare DNS change.
8. Run staging deployment and UAT. Production remains blocked on a separate
   account plan, legal/owner approvals, and explicit production approval.

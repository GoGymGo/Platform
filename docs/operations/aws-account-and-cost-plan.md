# AWS account and cost plan

Status: the isolated `GoGymGo-Staging` member account and its cost-controlled AWS
foundation are deployed in `ca-central-1`. The private database, application
login, PostGIS extension, runtime secrets, GitHub OIDC role, budget, alarms, ACM
certificate, HTTPS listener, and DNS-only `api-staging.gogymgo.com` record are
bootstrapped. API and worker desired counts remain zero. Google workload identity
setup, the first application deployment, migrations, and UAT remain gated.
Production is untouched.

## Isolation gate

Keep the existing AWS Organizations management account named `Souvenote` as the
billing and governance account only. The staging member account uses
`contact@gogymgo.com`; create a separate production member account only after the
production approval gate:

- `GoGymGo-Staging`
- `GoGymGo-Production`

Each environment gets a distinct account ID, Terraform state bucket, state lock,
GitHub environment, OIDC deployment role, Firebase project, VPC, database, ECR
repository, S3 buckets, KMS key, Secrets Manager secrets, logs, alarms, and budget.
Terraform requires the expected account ID and configures the AWS provider's
`allowed_account_ids` guard, so an apply fails before creating resources if the
operator is authenticated to Souvenote or the other GoGymGo environment.

AWS Organizations credit sharing is active, and the shared $5,000 AWS Activate
credit currently lists every service used by this foundation as eligible. Eligible
staging usage is therefore applied to the shared credit before the payment card.
Taxes, ineligible services, and usage after the credit expires or is exhausted can
still reach the card. Confirm the first staging line items in Billing after the
usual 24-48 hour reporting delay; budgets alert but do not stop resources
automatically.

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

1. The ACM validation and API hostname DNS gates are complete. Keep the API
   record DNS-only until the first healthy staging release is verified.
2. Configure a staging-only Google workload identity pool/provider and
   least-privilege Firebase service account. Do not create a long-lived Firebase
   service-account key unless federation is proven impractical and the exception
   is explicitly approved.
3. Store the generated non-secret AWS external-account configuration in the
   existing staging credential secret.
4. Review and deploy an exact application image digest, run the one-shot migration
   task, and scale the API and worker only for the approved UAT window.
5. Verify health, authentication, alarms, and credit application after billing
   data appears. Production remains blocked on a separate account plan,
   legal/owner approvals, and explicit production approval.

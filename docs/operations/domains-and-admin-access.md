# Production domains and admin access

This runbook is an owner-operated launch gate. Do not switch DNS until each
hosting provider reports the custom domain as verified and staging UAT passes.

## Required access

- Cloudflare account authoritative for `gogymgo.com`
- GoGymGo Sites workspace containing the preserved landing and admin projects
- Firebase console access to the production project
- Administrator access to the dedicated `GoGymGo-Production` AWS member account
- GitHub environment administration for the private `GoGymGo/Platform` repo

## Domain mapping order

1. In the landing Sites project, add `gogymgo.com` and copy the verification
   and routing records supplied by Sites.
2. Request the member-app ACM certificate in `us-east-1`, add only its exact
   DNS validation CNAME, and wait for ACM to report `ISSUED`. Supply that ARN to
   the environment Terraform root, then point `app.gogymgo.com` at the resulting
   CloudFront distribution with a DNS-only Cloudflare CNAME.
3. In the admin Sites project, add `admin.gogymgo.com` and copy the exact
   verification and routing records supplied by Sites.
4. Add those records in Cloudflare DNS. Preserve unrelated mail and
   verification records. Never guess a hosting target or delete an existing
   record without resolving its current owner.
5. Wait for all three providers to show verified TLS certificates, then test
   HTTPS and redirects from a private browser session.
6. In Firebase Authentication settings, add `admin.gogymgo.com` to the
   production project's authorized domains. The member app may use separately
   approved Google or Apple providers, but the admin origin exposes only the
   existing Firebase Email/Password provider and the API rejects every other
   `sign_in_provider`.

## Cloudflare Access gate for admin

After `admin.gogymgo.com` resolves through Cloudflare:

1. In Cloudflare Zero Trust, create a self-hosted Access application for the
   exact hostname `admin.gogymgo.com`.
2. Use an email identity provider or one-time PIN and create an **Allow** policy
   limited to approved GoGymGo and gym-partner operator email addresses. Keep
   the first owner entry and every partner sponsor/approval in the protected
   access register; do not commit it to this repository.
3. Add a final deny-by-default policy and use a short administrator session
   lifetime. Do not use a public bypass rule.
4. Confirm an unapproved email is stopped by Cloudflare before the application
   loads.
5. Confirm the approved owner must then pass Firebase authentication and the
   backend database-admin check. Cloudflare Access is an outer gate, not a
   replacement for either control.

Only approved gym owners and GoGymGo regional directors receive admin-console
credentials. Accounts are created directly by GoGymGo as Firebase
email/password users; the console exposes no self-registration or social-login
path. Keep the Cloudflare allow policy synchronized with the private operator
access register whenever an account is issued or revoked.

## Administrative command defense

Cloudflare and Firebase authenticate entry, but authorization remains the
current database user role and active exact-gym assignment resolved by the API.
Never add platform or gym authority to token claims, public frontend variables,
or client storage. Legal publication/withdrawal additionally compares the
database administrator identity with the protected owner configuration.

The browser may retain only a scoped retry identity for a response-lost
mutation. The API binds that idempotency key to the exact request body and
actor, requires the current optimistic version for stateful commands, validates
the bounded audit reason, and writes the state change plus minimized before and
after audit in one transaction. A stale version, mismatched retry body,
unavailable preflight, disabled release flag, or role/scope conflict fails
closed. Do not bypass these failures with direct database edits or a client-side
success marker.

## GitHub deployment environments

Create separate `staging` and `production` environments. Production deployment
remains manual. Configure environment-scoped values without placing secret
payloads in repository variables:

- `AWS_ACCOUNT_ID`
- `AWS_REGION` (`ca-central-1`)
- `AWS_DEPLOY_ROLE_ARN`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_API_SERVICE` and `ECS_API_TASK_DEFINITION`
- `ECS_WORKER_SERVICE` and `ECS_WORKER_TASK_DEFINITION`
- `ECS_MIGRATION_TASK_DEFINITION`, `ECS_MIGRATION_SUBNETS`, and
  `ECS_MIGRATION_SECURITY_GROUPS`
- `API_URL`
- `MEMBER_WEB_BUCKET`, `MEMBER_WEB_DISTRIBUTION_ID`,
  `MEMBER_WEB_DEPLOY_ROLE_ARN`, and `MEMBER_WEB_URL`
- public API and Firebase configuration required by each frontend

Use distinct AWS accounts, deployment identities, Firebase projects, databases,
secrets, Terraform state and URLs for staging and production. Keep secret values
in AWS Secrets Manager or the hosting provider's encrypted environment storage.

## Verification

- `gogymgo.com` renders the public landing site and posts interest to the API.
- `app.gogymgo.com/demo` works without Firebase, camera, location or API calls.
- `app.gogymgo.com/` opens the member-app welcome screen; its Get Started and
  Sign In actions use production Firebase and the production API.
- `admin.gogymgo.com` rejects an unapproved email at Cloudflare, rejects a
  non-operator Firebase user at the API, permits the unscoped bootstrapped
  owner, routes an assigned partner administrator to only its exact gyms, keeps
  partner staff read-only, and rejects a revoked assignment immediately.
- CORS allows only the reviewed production origins.

Record screenshots and timestamps in the production UAT evidence before the
release tag is created.

Firebase authorized-domain/provider state and Cloudflare Access policy state are
external release gates. Repository tests cannot prove them configured, and no
repository-only delivery should claim that they are.

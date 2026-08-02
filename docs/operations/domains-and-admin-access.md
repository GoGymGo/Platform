# Production domains and admin access

This runbook is an owner-operated launch gate. Do not switch DNS until each
hosting provider reports the custom domain as verified and staging UAT passes.

## Required access

- Cloudflare account authoritative for `gogymgo.com`
- GoGymGo Sites workspace containing the preserved landing and admin projects
- Firebase console access to the production project
- Google Cloud billing and project-owner access for `gogymgo-prod-8cb8b`
- GitHub environment administration for the private `GoGymGo/Platform` repo

## Domain mapping order

1. In the landing Sites project, add `gogymgo.com` and copy the verification
   and routing records supplied by Sites.
2. In production Firebase Hosting, add `app.gogymgo.com` and copy the exact
   verification and routing records supplied by Firebase.
3. In the admin Sites project, add `admin.gogymgo.com` and copy the exact
   verification and routing records supplied by Sites.
4. Add those records in Cloudflare DNS. Preserve unrelated mail and
   verification records. Never guess a hosting target or delete an existing
   record without resolving its current owner.
5. Wait for all three providers to show verified TLS certificates, then test
   HTTPS and redirects from a private browser session.

## Cloudflare Access gate for admin

After `admin.gogymgo.com` resolves through Cloudflare:

1. In Cloudflare Zero Trust, create a self-hosted Access application for the
   exact hostname `admin.gogymgo.com`.
2. Use an email identity provider or one-time PIN and create an **Allow** policy
   limited to approved GoGymGo administrator email addresses. The first entry
   is `s1ck5ense123@gmail.com`.
3. Add a final deny-by-default policy and use a short administrator session
   lifetime. Do not use a public bypass rule.
4. Confirm an unapproved email is stopped by Cloudflare before the application
   loads.
5. Confirm the approved owner must then pass Firebase authentication and the
   backend database-admin check. Cloudflare Access is an outer gate, not a
   replacement for either control.

## GitHub deployment environments

Create separate `staging` and `production` environments. Production deployment
remains manual. Configure environment-scoped values without placing secret
payloads in repository variables:

- `GCP_PROJECT_ID`
- `GCP_REGION` (`northamerica-northeast1`)
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `BACKEND_NAME_PREFIX` when the default is not used
- public API and Firebase configuration required by each frontend

Use distinct deployment identities, Firebase projects, databases, secrets and
URLs for staging and production. Keep secret values in Google Secret Manager or
the hosting provider's encrypted environment storage.

## Verification

- `gogymgo.com` renders the public landing site and posts interest to the API.
- `app.gogymgo.com/demo` works without Firebase, camera, location or API calls.
- `app.gogymgo.com/join` uses production Firebase and the production API.
- `admin.gogymgo.com` rejects an unapproved email at Cloudflare, rejects a
  non-admin Firebase user at the API, and permits the bootstrapped owner.
- CORS allows only the reviewed production origins.

Record screenshots and timestamps in the production UAT evidence before the
release tag is created.

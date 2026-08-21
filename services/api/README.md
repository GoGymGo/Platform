# GoGymGo API

GoGymGo's authoritative backend is a strict TypeScript/NestJS modular monolith. The Expo application is an untrusted client: this service verifies identity, applies competition policy, records append-only entry and audit ledgers, settles winners, and controls every reward award and claim.

## Trust boundaries

- Firebase Admin verifies the bearer token and supplies the account identity. Client-supplied user IDs are never authoritative.
- Administrative operations require Firebase's verified `password` sign-in provider in addition to an active, email-verified database administrator role.
- Accounts must remain active and have a current Firebase-verified email for enrollment, workout evidence/awards, privileged operations, draw eligibility, and reward claims.
- PostgreSQL/PostGIS is the source of truth and durable job queue. Workers claim jobs with bounded database leases; Redis is not required for the initial production system.
- Retryable award, claim, and operator mutations require an idempotency key.
- Coupon codes are encrypted at rest and disclosed only to the authenticated winner after an idempotent claim.
- Physical rewards use sponsor-provided claim instructions or secure claim links; GoGymGo does not collect shipping addresses in this version.
- GoGymGo has no payment-provider, bank-account, tax-form, or cash-payout surface.
- Account legal documents and receipts are versioned, content-hashed, append-only, and server-timestamped; local device state is never authoritative competition consent.

## Local foundation

Requirements:

- Node.js 24 or the version pinned by the deployment runtime
- npm 11+
- PostgreSQL with PostGIS
- Firebase Application Default Credentials or the Firebase Auth emulator

```powershell
Copy-Item .env.example .env
npm.cmd ci --prefix ..\..
npm.cmd run migrate:up --workspace @gogymgo/api
npm.cmd run check --workspace @gogymgo/api
npm.cmd run start:dev --workspace @gogymgo/api
```

The preproduction migration baseline was cleaned before the first Cloud
deployment. Recreate any older local database volume before running
`migrate:up`; do not reuse a migration ledger created by the retired
demo/payment schema.

The verified workout streak schema, API contract, badge integration, migration
steps, and reward semantics are documented in
[gym streak rewards](../../docs/product/streak-rewards.md).

The screen-name search, friend-consent, named challenge, invitation, privacy,
migration, API, and Squad UI integration are documented in
[friends and social challenges](../../docs/product/social-challenges.md).

The physical-prize and coupon-code schema, APIs, operator workflow, encryption,
migration, and mobile marketplace are documented in
[brand rewards marketplace](../../docs/product/brand-rewards-marketplace.md).

The liveness route is `GET http://localhost:3000/v1/health`. In non-production environments, Swagger UI is available at `http://localhost:3000/docs` and the generated contract is committed as `openapi.json`.

## Quality gates

`npm run check` runs formatting verification, strict TypeScript compilation, ESLint, unit tests, HTTP end-to-end tests, OpenAPI generation, the mobile-to-API contract audit, the source-policy/secret audit, and a production build. Run `npm run audit:deps` separately when dependency metadata is available.

Production images install only the AWS runtime and prune development plus
optional dependencies. Firebase Admin's optional Firestore and Google Cloud
Storage clients are intentionally excluded. `npm run audit:deps` audits that
same production dependency boundary and fails on moderate-or-higher findings.

Database integration tests use Testcontainers and require a running Docker engine. A missing Docker engine is an environment limitation, never a passing database test.
Run the focused static-QR lifecycle gate from the repository root with:

```powershell
$env:RUN_DATABASE_INTEGRATION = 'true'
npm.cmd run test:smoke:qr --workspace @gogymgo/api
```

With `RUN_DATABASE_INTEGRATION=true`, the suite also exercises the critical
PostgreSQL-backed trust paths. Evidence-to-ledger coverage proves enrollment
and session idempotency, serialized entrant caps, inactive re-enrollment
rejection, evidence replay rejection, disqualification checks, one award per
eligible day, and exact progress totals. Draw-to-reward coverage proves minimum
entrants, resolved session reviews, disqualification filtering, retry-safe
settlement, inventory-bounded selection, one award per winner, and idempotent
reward claims.
Profile-media coverage proves exact constrained upload actions, retry conflicts,
private completion, moderation-only activation, audited decisions, replacement
isolation, and object cleanup without persisting signed URLs.
Account-legal coverage proves jurisdiction fallback without locale fallback,
immutable publication and withdrawal, exact receipt actions and content hashes,
stale-bundle invalidation, privacy-export inclusion, and enrollment linkage.
Session-review coverage proves deterministic server evidence snapshots, safe
operator aggregates, stale-review rejection, typed fail-closed findings, and
ledger awards bound to the exact reviewed snapshot. Terminal rejection is
snapshot-bound, retry-safe, audited once, and awards no ledger value.

Administrative region, competition, and creator-workout configuration is documented in [the admin operations runbook](../../docs/operations/admin-configuration.md). It includes the audited first-administrator bootstrap procedure; there is intentionally no public privilege-grant endpoint.

The globally paginated human-review inventory, minimized audit search, factual
worker/queue/provider health semantics, and lease recovery procedure are
documented in [review queues and operational health](../../docs/operations/review-queues-and-operational-health.md).

The private avatar upload, moderation, cleanup, and privacy lifecycle is documented in [profile-media operations](../../docs/architecture/profile-media.md).

Server-authoritative Terms and Privacy publication, receipt, withdrawal, and enrollment controls are documented in [account legal documents](../../docs/compliance/legal-documents.md).

The privacy-minimized manual workout review boundary and device controls required for production contests are documented in [session evidence review](../../docs/architecture/session-evidence-review.md).

The production topology and risk decisions are recorded in [the API architecture](../../docs/architecture/api.md). Reward operations are detailed in [brand rewards marketplace](../../docs/product/brand-rewards-marketplace.md). Provisioning lives in [the AWS Terraform foundation](../../infrastructure/aws/terraform/README.md), and ordered release, rollback, reward-incident, and privacy controls live in [the deployment runbook](../../docs/operations/api-deployment.md).

## Module build order

1. Platform configuration, health, errors, logging, security, and OpenAPI.
2. PostgreSQL migrations, Firebase authentication, accounts, profiles, and regions.
3. Competitions, enrollments, sessions, append-only entry ledger, and leaderboards.
4. Draw settlement, regional reward inventory, awards, claims, and coupon-code encryption.
5. Notifications, partnerships, moderation/admin, and executable privacy operations.
6. Observability, infrastructure provisioning, and deployment hardening.

See [the member/API architecture decision](../../docs/architecture/member-api-contract.md) and [the clean-push checklist](../../docs/operations/backend-clean-push.md) for the full contract and publish policy.

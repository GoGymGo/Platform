# GoGymGo API

GoGymGo's authoritative backend is a strict TypeScript/NestJS modular monolith. The Expo application is an untrusted client: this service verifies identity, applies competition policy, records append-only entry and audit ledgers, settles winners, and controls every payout transition.

## Trust boundaries

- Firebase Admin verifies the bearer token and supplies the account identity. Client-supplied user IDs are never authoritative.
- PostgreSQL/PostGIS is the source of truth and durable job queue. Workers claim jobs with bounded database leases; Redis is not required for the initial production system.
- Money is stored as integer minor units with an ISO currency.
- Retryable and money-affecting mutations require an idempotency key.
- Hyperwallet credentials, webhooks, user/payment tokens, and hosted portal actions remain server-side.
- GoGymGo never accepts bank-account, tax-form, or identity-document fields.

## Local foundation

Requirements:

- Node.js 24 or the version pinned by the deployment runtime
- npm 11+
- PostgreSQL with PostGIS
- Firebase Application Default Credentials or the Firebase Auth emulator

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run check
npm.cmd run start:dev
```

The liveness route is `GET http://localhost:3000/v1/health`. In non-production environments, Swagger UI is available at `http://localhost:3000/docs` and the generated contract is committed as `openapi.json`.

## Quality gates

`npm run check` runs formatting verification, strict TypeScript compilation, ESLint, unit tests, HTTP end-to-end tests, OpenAPI generation, the mobile-to-API contract audit, the source-policy/secret audit, and a production build. Run `npm run audit:deps` separately when dependency metadata is available.

Database integration tests use Testcontainers and require a running Docker engine. A missing Docker engine is an environment limitation, never a passing database test.

## Module build order

1. Platform configuration, health, errors, logging, security, and OpenAPI.
2. PostgreSQL migrations, Firebase authentication, accounts, profiles, and regions.
3. Competitions, enrollments, sessions, append-only entry ledger, and leaderboards.
4. Draw settlement, payout claims, Hyperwallet adapter/webhooks, and reconciliation.
5. Notifications, partnerships, moderation/admin, and executable privacy operations.
6. Observability, infrastructure provisioning, and deployment hardening.

See [the frontend architecture decision](../mobile-app/docs/backend-handoff-architecture.md) and [the clean-push prompt](../BACKEND_CLEAN_PUSH_PROMPT.md) for the full contract and publish policy.

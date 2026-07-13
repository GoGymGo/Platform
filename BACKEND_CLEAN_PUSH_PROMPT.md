# GoGymGo Backend Clean-Code and Push Prompt

Use this prompt before every backend implementation or publish session:

> Build only production-aligned GoGymGo backend work on the dedicated backend branch and keep it isolated under `/backend`. Preserve the Expo frontend as an untrusted client and PostgreSQL as the authoritative system of record. Never place Firebase Admin credentials, Hyperwallet credentials, bank information, tax information, identity documents, access tokens, private keys, or populated environment files in source control.
>
> Keep the NestJS application a modular monolith with explicit module ownership. Validate all external input. Derive the authenticated user only from a verified Firebase ID token. Require idempotency for retryable or money-affecting writes. Store money as integer minor units plus ISO currency. Make ledger and operator audit records append-only. Treat PostgreSQL constraints and transactions as part of the business rules, not as optional persistence details.
>
> Keep provider integrations behind interfaces. Hyperwallet must remain server-side and the mobile app may receive only a backend-approved hosted portal action. Never accept or proxy bank-account, tax-form, or identity-document fields through GoGymGo endpoints. Verify and deduplicate provider webhooks before changing payout state.
>
> Before committing a section, run formatting, TypeScript compilation, linting, unit tests, integration tests, migration verification, OpenAPI generation, source-policy checks, dependency audit, and secret scanning appropriate to that section. Inspect `git status`, the complete staged diff, and the commit contents. Stage only intentional files, use a focused commit message, push the dedicated branch, and keep the pull request in draft until the full backend acceptance checks pass.

## Required publish gate

1. Working tree scope is understood and contains no unrelated user changes.
2. No secrets, local environment files, build output, coverage, logs, or dependencies are staged.
3. Database migrations work both on a clean database and against the current migration history.
4. Typecheck, lint, tests, source audit, and production build pass.
5. Money, authentication, authorization, idempotency, webhook, and audit invariants have direct tests.
6. The generated OpenAPI document matches the implemented endpoints.
7. The staged diff and `git diff --check` are clean.
8. The branch is pushed with tracking and the draft pull request lists completed and outstanding backend sections honestly.

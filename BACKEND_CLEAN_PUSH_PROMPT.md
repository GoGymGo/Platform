# GoGymGo backend clean-code and push prompt

Use this prompt before every backend implementation or publish session:

> Build production-aligned GoGymGo backend work under `/backend`. Preserve the
> Expo frontend as an untrusted client and PostgreSQL as the authoritative system
> of record. Never place Firebase credentials, coupon encryption keys, coupon
> plaintext, health/location evidence, access tokens, private keys, or populated
> environment files in source control.
>
> Keep the NestJS application a modular monolith with explicit module ownership.
> Validate all external input. Derive the authenticated user only from a verified
> Firebase token. Require idempotency for retryable value-bearing writes. Make
> entry and operator audit records append-only. Treat PostgreSQL constraints and
> transactions as business rules. Encrypt coupon codes at the API boundary and
> reveal them only to the authenticated award owner.
>
> Before committing, run formatting, TypeScript compilation, linting, unit,
> integration and HTTP tests, migration verification, OpenAPI generation,
> contract/source audits, dependency audit, and secret scanning. Inspect status,
> staged diff, and commit contents; stage only intentional files.

## Required publish gate

1. Working-tree scope is understood and unrelated user changes are preserved.
2. No secrets, local environment, build output, coverage, logs, or dependencies
   are staged.
3. Migrations work from a clean database and current history; destructive
   forward migrations have a verified backup/restore plan.
4. Typecheck, lint, tests, source audit, and production build pass.
5. Authentication, authorization, idempotency, inventory, coupon secrecy, and
   audit invariants have direct tests.
6. Generated OpenAPI matches implemented endpoints.
7. Staged diff and `git diff --check` are clean.
8. A draft pull request lists completed and outstanding gates honestly.

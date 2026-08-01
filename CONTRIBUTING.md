# Contributing to GoGymGo Platform

## Workflow

1. Start from an up-to-date `main` branch.
2. Create a focused branch with the `codex/` prefix for Codex-assisted work.
3. Install from the repository root with `npm ci`.
4. Keep platform-specific UI inside its owning application. Share brand assets and API contracts through `packages/brand` and `packages/contracts`.
5. Run the relevant workspace check and the root integration checks before opening a pull request.
6. Use the pull-request template and wait for every required path-aware workflow to pass.

Never commit environment files, credentials, database dumps, Terraform state, deployment archives, generated production bundles or local caches.

## Contracts

The API OpenAPI document is authoritative. After controller or DTO changes, run `npm run contracts:generate` and commit the generated contract. CI fails when generated output drifts.

## Database changes

Use forward-only migrations. Include integrity constraints, indexes and rollback/incident notes appropriate to the change. Production migrations run through the manually dispatched deployment workflow before API traffic is promoted.

## Production changes

Production requires passing CI, staging UAT and the launch gates in `docs/operations/`. Do not bypass environment-scoped variables, separate deployment identities or manual production approval.

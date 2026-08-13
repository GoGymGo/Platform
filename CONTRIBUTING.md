# Contributing to GoGymGo Platform

GoGymGo Platform is proprietary and does not accept unsolicited public
contributions. A pull request may be submitted only by a person who has written
authorization from GoGymGo and an applicable confidentiality and intellectual
property agreement. Opening a pull request does not grant any license to use
the repository's contents.

## Workflow

1. Start from an up-to-date `main` branch.
2. Create a focused branch with the `agent/` prefix for Codex-assisted work.
3. Install from the repository root with `npm ci`.
4. Keep platform-specific UI inside its owning application. Share brand assets and API contracts through `packages/brand` and `packages/contracts`.
5. Run the relevant workspace check and the root integration checks before opening a pull request.
6. Use the pull-request template and wait for every required workflow to pass.

Runtime ownership and allowed dependency directions are defined in
`docs/architecture/repository-boundaries.md` and enforced by CI. A normal
feature should change no more than two runtime owners. A pull request spanning
three or more runtime owners or more than 75 files requires a concrete plan
under `docs/change-plans/`; unrelated work must still be split.

Run `npm run audit:dependencies` for lockfile or dependency changes. Temporary
security approvals are centralized in
`config/dependency-risk-exceptions.json`, expire within 45 days, and must not be
renewed without reassessing the exposure and upgrade path. Routine Dependabot
PRs are limited to patch/minor changes; major migrations require focused plans
and compatibility tests.

Never commit environment files, credentials, database dumps, Terraform state, deployment archives, generated production bundles or local caches.

## Contracts

The API OpenAPI document is authoritative. After controller or DTO changes, run `npm run contracts:generate` and commit the generated contract. CI fails when generated output drifts.

## Database changes

Use forward-only migrations. Include integrity constraints, indexes and rollback/incident notes appropriate to the change. Production migrations run through the manually dispatched deployment workflow before API traffic is promoted.

## Production changes

Production requires passing CI, staging UAT and the launch gates in `docs/operations/`. Do not bypass environment-scoped variables, separate deployment identities or manual production approval.

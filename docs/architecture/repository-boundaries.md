# Repository ownership boundaries

Status: enforced architecture decision, August 2026

GoGymGo is a modular monorepo, not one application. Each runtime has one owner
and communicates through public contracts instead of importing another
runtime's source.

| Owner          | Paths                                   | May depend on                                        | Must not own                                  |
| -------------- | --------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Member app     | `apps/member-app/app`, `plugins`, `src` | `@gogymgo/brand`, `@gogymgo/contracts`, public API   | Server authority, operator policy, landing UI |
| Admin          | `apps/admin/app`, `worker`              | `@gogymgo/brand`, `@gogymgo/contracts`, operator API | Member state, API implementation, landing UI  |
| Landing        | `apps/landing/app`, `worker`            | `@gogymgo/brand`, public HTTP API                    | Authenticated product or operator behavior    |
| API and worker | `services/api/src`                      | Its modules, database, external providers            | Frontend source or generated client contracts |
| Brand          | `packages/brand/src`                    | No runtime workspace                                 | Product behavior or API shapes                |
| Contracts      | `packages/contracts/src`                | Generated OpenAPI input only                         | Runtime behavior or handwritten server policy |

Infrastructure and deployment code under `infrastructure/` and `.github/` may
compose runtimes, but it may not become a second implementation of product
rules. Documentation and audit tooling may inspect multiple owners read-only.

## Allowed communication

- Member and admin clients use generated OpenAPI contracts and authenticated
  HTTP requests.
- Landing uses only public endpoints and shared brand assets.
- The API remains authoritative for identity, eligibility, verification,
  scoring, entries, draws, rewards, privacy, and operator decisions.
- Database changes are forward-only migrations owned by the API.
- Cross-application visual reuse belongs in `packages/brand`; cross-application
  API shapes belong in `packages/contracts`.

One narrow legacy exception remains: the member app embeds
`services/api/config/legal/public-ca-bc-en.json` as its offline public legal
fallback. The API owns that exact public document bundle; no executable API
source is imported. The boundary audit allowlists only that file pair.

## Enforcement

`node tooling/architecture-policy.mjs` scans runtime imports and workspace
dependencies. CI rejects new application-to-application imports, frontend
imports of API source, API imports of frontend packages, and new dependency
directions that are absent from this decision.

A normal product pull request may change at most two runtime owners—for example
the member app and API. Changes spanning three or more owners, or more than 75
files, require a concrete plan under `docs/change-plans/`. This is enforced by
`tooling/change-scope-policy.mjs` before merge.

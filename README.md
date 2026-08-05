# GoGymGo Platform

Private monorepo for the GoGymGo member application, public landing site, administrator dashboard, API, worker, shared brand assets, generated contracts and cloud infrastructure.

## Applications and services

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/member-app` | `@gogymgo/member-app` | Expo application for iOS, Android and mobile web |
| `apps/admin` | `@gogymgo/admin` | Private operations dashboard |
| `apps/landing` | `@gogymgo/landing` | Public marketing, waitlist and partner site |
| `services/api` | `@gogymgo/api` | NestJS API, worker and database migrations |
| `packages/brand` | `@gogymgo/brand` | Canonical logos, fonts and colour tokens |
| `packages/contracts` | `@gogymgo/contracts` | TypeScript contracts generated from OpenAPI |

Cloud and local infrastructure live under `infrastructure/`. Product, architecture, operations and compliance documentation lives under `docs/`. Start, stop, audit and release helpers live under `tooling/scripts/`.

## Requirements

- Node.js 22.13 or newer (CI and containers use Node.js 24)
- npm 11 or newer
- Docker Desktop for the local PostgreSQL/PostGIS stack
- Terraform 1.15.8 for cloud infrastructure validation
- Firebase and Google Cloud credentials only for connected local or cloud work

## Root commands

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run build
npm.cmd test
```

Target one surface with a workspace command:

```powershell
npm.cmd run start:member
npm.cmd run start:admin
npm.cmd run start:landing
npm.cmd run start:api
```

After API DTO or controller changes, regenerate and commit shared contracts:

```powershell
npm.cmd run contracts:generate
npm.cmd run contracts:check
```

## Connected local preview

Create ignored local environment files from `apps/member-app/.env.example` and `services/api/.env.example`, then run:

```powershell
.\tooling\scripts\start-free-preview.ps1
```

The helper starts PostGIS, migrations, the API, worker, Expo web app and optional Cloudflare quick tunnels. Stop services without deleting the database volume:

```powershell
.\tooling\scripts\stop-free-preview.ps1
```

## Deployment model

- `gogymgo.com`: landing Sites project
- `app.gogymgo.com`: Expo web on Firebase Hosting
- `admin.gogymgo.com`: private admin Sites project
- API and worker: Google Cloud Run
- PostgreSQL/PostGIS: private Cloud SQL

Staging and production use separate Firebase, Google Cloud, database, secret, deployment-identity and URL configuration. Production deployment is manual through the protected `Platform Deployment` GitHub Actions workflow.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [product requirements](docs/product/product-requirements.md), [QR verification architecture](docs/architecture/session-evidence-review.md), [September pilot runbook](docs/operations/september-qr-pilot.md), [member-app QR-link deployment](docs/operations/member-app-native-links.md), [production domains and admin access](docs/operations/domains-and-admin-access.md), and [API deployment](docs/operations/api-deployment.md).

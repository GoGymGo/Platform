# GoGymGo Frontend

This repository contains the active GoGymGo React Native frontend.

## Current Stack

- Expo SDK 57
- Expo Router 57
- React Native 0.86
- React 19.2
- TypeScript 6
- TanStack Query 5 for asynchronous server state
- Node.js 22.13 or newer

## Folder Structure

- `mobile-app/` - Active React Native, Expo Router and TypeScript application.
- `mobile-app/app/` - File-based routes for authentication, onboarding, tabs, workouts and modals.
- `mobile-app/src/` - Shared components, theme, production API contracts, domain calculations and state.
- `mobile-app/docs/` - Product, design, compliance and migration documentation.
- `mobile-app/docs/backend-handoff-architecture.md` - Chosen backend, reward, trust-boundary and integration plan.
- `mobile-app/docs/frontend-readiness-audit.md` - Route/flow inventory, product-language dictionary, code-size priorities, connection status and release evidence.
- `backend/docs/streak-rewards.md` - Gym streak database migration, API contract, badge UI integration, and rollout steps.
- `backend/docs/social-challenges.md` - Alias search (`screenName` in the API), friend requests, named challenges, invitations, migration, and integration steps.
- `backend/docs/brand-rewards-marketplace.md` - Physical-prize and coupon-code marketplace, administration, claims, security, and rollout.

## App Commands

Run commands from `mobile-app/`.

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run web
npx.cmd expo install --check
npx.cmd expo-doctor@latest
npm.cmd audit --omit=dev
```

`npm.cmd run check` runs TypeScript, Expo lint, domain unit tests, the
source/route integrity audit and the production-readiness audit.

Firebase Authentication code is included but requires a Firebase project before account actions can reach a live service. See `mobile-app/docs/Firebase_Auth_Setup.md` and `mobile-app/.env.example`.

The production architecture is a NestJS modular monolith behind Firebase Auth with PostgreSQL/PostGIS and a region-scoped brand rewards marketplace. Contest rewards are physical products or encrypted coupon codes; the app has no payment, bank-account, or payout-provider integration.

`mobile-app/eas.json` includes development, internal preview, and production build profiles. Store identifiers, EAS project linkage, native Firebase files, signing, and final icon/splash assets still need the production owner before store builds.

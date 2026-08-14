# GGG-003 region eligibility and regional waitlist

## Outcome

Members receive an authoritative, current region decision only after a fresh and accurate foreground device-location sample is evaluated against one active PostGIS policy. Unsupported prospective users can submit an explicitly consented regional-update request that does not imply registration. Administrators can review pending decisions and advance regional-update operations without raw coordinates or public workflow-state disclosure.

## Boundaries

- Member app: location sampling, fail-closed eligibility state, status/retry copy, and signed-in regional-update consent.
- API and PostgreSQL: current-policy predicates, sample validation, decision integrity, regional-update normalization/consent/idempotency, administrator authorization, and audit records.
- Admin app: only the existing region-review and regional-waitlist duties; no general operator-authentication redesign.
- Landing app: only the existing regional-update intake contract and honest receipt; no conversion redesign.
- Shared contracts, privacy/operations documentation, and direct regression tests follow the changed interfaces.
- No geography is approved or enabled by this change. No cloud environment, worker duty, gym-selection flow, enrollment implementation, or deployment is in scope.

## Rollout

1. Apply the additive integrity migration before serving the regenerated API contract.
2. Deploy the API with public metadata filtered to enabled policies and all eligibility consumers using the same current-policy predicate.
3. Publish landing, admin, and member clients against that contract. Existing waitlist rows remain legacy-unconsented and must not be treated as outreach authority until consent is renewed.
4. Keep competition geography disabled until the separately authorized artifact reconciliation, legal sign-off, and physical-device UAT gates pass.

## Validation

- Unit tests cover location age/accuracy normalization, mounted-decision expiry, client fail-closed source behavior, canonical regional-update intake, consent, non-regressing status transitions, operator idempotency, and privacy-minimized evidence.
- PostgreSQL/PostGIS integration tests cover inside/outside/boundary decisions, current policy version/state, stale evidence, ownership, constraints, retries, and concurrency-sensitive upserts.
- Contract generation and member/admin/landing source and production-artifact audits prove the same request and receipt shapes across runtimes.
- Final repository gates: governance, dependency audit, critical journeys, database journeys, and the complete check suite.
- Physical-device permission, accuracy, timeout, boundary, and retry UAT remains an external release gate and cannot be replaced with fabricated success.

## Recovery

- Disable the affected region policy to fail all dependent journeys closed; this does not delete verification or audit evidence.
- Roll back member/admin/landing artifacts independently while retaining the additive database columns and stricter decision constraint.
- If regional-update intake must be paused, return a service-unavailable response and retain existing entries without status regression.
- Revert the application commit only after restoring the previous contract consumers. Use the migration `down` only after verifying that canonical-key duplicates cannot be reintroduced and the older API is restored.

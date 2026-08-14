# Region eligibility operations

## Technical policy

Region eligibility is authoritative only when all of the following are true:

- the signed-in member submits a foreground `device_location` reading observed no more than 30 seconds earlier;
- reported horizontal accuracy is finite, non-negative, and at most 50 metres;
- exactly one enabled, non-deleted policy in its current validity window covers the point using PostGIS `ST_Covers` (boundary points are included and polygon holes are excluded);
- the stored approval has non-null decision and expiry timestamps, has not expired, and matches the current policy version; and
- the approval belongs to the bearer principal and occurs after any pilot onboarding reset.

The API hashes coordinates as part of the idempotency request but does not persist them or return them in errors, catalog reads, audits, analytics, or operator views. Stored evidence contains only the containment result, boundary version, accepted freshness/accuracy thresholds, source, and a `coordinatesRetained: false` marker.

The public catalog returns active competition-enabled metadata only. Administrator configuration creates from a validated MultiPolygon and records a canonical geometry digest in the audit event. The generic admin form defaults to disabled. Enabling geography still requires separate legal/product approval and deployment authorization.

## Committed pilot artifact

The reviewed repository artifact is `services/api/config/regions/vancouver-island-gulf-islands-bc.geojson`:

- boundary version: `statcan-2021-islands-trust-2026-01-v1`
- SHA-256: `5615d3c177fb10bed32ee4e6f72ff51e7ea62ac2c490c7cb86cc80778eec6e34`
- tolerance: zero metres

The API test suite checks that exact byte digest and 20 named representative inside/outside points. Before enabling a deployed policy, an authorized operator must reconcile its boundary version and server-computed geometry digest to the approved artifact and rerun physical-device boundary UAT. A green repository test does not approve or deploy geography.

## Regional update intake

Public landing intake and signed-in member intake both require notice version `regional-updates-2026-08-13-v1`. Signed-in intake derives the verified account email and ownership from the bearer principal; public intake remains a non-registration request. The API canonicalizes whitespace/case for duplicate control, returns only `{ "status": "received" }`, preserves contacted/launched/closed state on retries, and blocks outreach transitions for legacy rows without current consent evidence.

Signed-in requests are included in account export and deleted with an account deletion. Public requests are handled through the email-based privacy process because they intentionally have no account. Retention duration and any bulk outreach remain external privacy/legal gates; the absence of an approved retention schedule must not be treated as permission for indefinite outreach.

## Recovery and rollback

1. Disable the affected policy. Current verification and every dependent discovery, enrollment, leaderboard, and streak query immediately fail closed.
2. Do not delete verification, idempotency, consent, or operator-audit evidence during incident response.
3. If the policy geometry or version is suspect, keep it disabled, reconcile the committed digest and representative points offline, and issue a new policy version after approval.
4. If regional-update intake is suspect, return service unavailable and preserve existing status. Never reset contacted, launched, or closed rows to waiting.
5. Restore application layers in API-first order. The additive waitlist fields and decision constraint may remain during an application rollback.

## Release evidence still required

- legal/product approval of the exact enabled geography and regional-update retention policy;
- production PostGIS migration/reconciliation evidence;
- physical iOS and Android tests for permission denied, services disabled, accuracy, timeout, inside/outside/boundary, retry, and expiry while mounted; and
- separate deployment authorization. This repository procedure contacts no cloud environment.

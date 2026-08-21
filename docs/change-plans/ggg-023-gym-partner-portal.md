# GGG-023 gym partner portal and QR poster operations

## Outcome

Give an invitation-only gym partner account one server-authoritative workspace
for its exact active Partner-gym assignments. Partner administrators can prepare,
submit, withdraw, or archive gym-owned Contest proposals and manage an approved
Contest's current poster. Partner staff can inspect only minimized gym, proposal,
poster-history, and aggregate visit projections. GoGymGo administrators retain
first-gym creation, region and Contest configuration, pre-publication poster
preparation, publication, cancellation, settlement, and every global control.

## Boundaries

- PostgreSQL roles and active exact-gym assignments remain authoritative on every
  request and idempotent replay. Firebase token claims never grant portal access;
  operator entry remains verified email/password only and has no registration or
  credential-issuance endpoint.
- The API owns proposal provenance and lifecycle, optimistic versions, body-bound
  idempotency, poster eligibility and pagination. A proposal's gym, original
  proposer, and creation provenance are immutable. Privacy deletion pseudonymizes
  the retained user identity rather than deleting proposal provenance.
- The partner client owns runtime decoding and honest loading, empty, error,
  retry, conflict, read-only, pagination, recovery, and download states. It does
  not infer authority from navigation or App Tour/demo data.
- Partner visit reads are aggregate-only. They contain no member or session ID,
  workout date, precise location, contact detail, evidence, QR payload, or other
  member-level data. Poster history is secret-free and cursor-paginated.
- A platform administrator may issue a draft poster to satisfy controlled
  publication preflight. A partner administrator may issue or recover a poster
  only after GoGymGo has published the submitted proposal. Partner staff never
  receive the active payload or printable artifact.
- Real operator credentials, Firebase/Cloudflare policy, real gym coordinates,
  physical poster placement, provider configuration, staging UAT, deployment and
  feature enablement remain external. This change does not access or mutate them.

## Rollout

1. Apply the forward-only proposal-lifecycle migration before the API. Existing
   gym-owned proposal rows are preserved as submitted review work with immutable
   provenance; new rows begin as drafts.
2. Promote the API, generated contract and admin application from the same exact
   reviewed commit. Keep the existing invitation-only Firebase password and
   Cloudflare outer-gate process unchanged.
3. Reconcile partner assignments with the trusted reason-bound command. Gym
   deactivation/revocation closes active assignment relationships and derived
   roles in the same transaction while preserving audit evidence.
4. In authorized staging, exercise partner-admin and partner-staff accounts for
   two gyms, then revoke one assignment and verify the next read and replay fail
   immediately. Have GoGymGo review and publish a submitted proposal before the
   partner attempts poster recovery or reissue.

## Validation

- Unit and database integration tests cover password/provider enforcement, exact
  role/assignment consistency, active/nondeleted gyms, cross-gym denial,
  revocation, relationship closure, and staff read-only behavior.
- Proposal tests cover immutable ownership, draft/update/submit/withdraw/archive
  transitions, optimistic versions, changed-body replay, replay reauthorization,
  duplicate gym/month slots, admin-only publication, and preservation through
  privacy deletion.
- QR tests cover platform-admin pre-publication preparation, partner post-
  publication eligibility, expected credential versions, exact Contest/gym/
  region scope, reauthorized issue/revoke replay, active recovery, immediate
  revocation, bounded secret-free history, and absence of payload/SVG from
  idempotency and audit storage.
- API and admin tests cover opaque cursor bounds, aggregate-only visit responses,
  runtime decoding, loading/empty/error/retry/conflict/read-only presentation,
  accessible actions and no demo authority. Generated OpenAPI/contracts, privacy
  export schema, source/secret/artifact audits, workspace checks and builds run
  serially on the exact head.
- Docker/Testcontainers/PostGIS validation runs only after fresh authorization;
  repository checks do not claim Firebase, Cloudflare, physical-poster or hosted
  partner UAT.

## Recovery

The migration is additive and remains applied if the client or API release is
rolled back. Proposal ownership and lifecycle history, credential history,
idempotency markers and audit events are never deleted or rewritten. Revoke an
affected poster or assignment through the trusted, reason-bound operation and
correct forward. If a poster response is lost, retry the exact body and key only
while the exact gym authorization remains active; the API reconstructs the prior
authorized result from the authoritative credential row without placing the QR
payload or printable SVG in idempotency storage. Do not create replacement roles,
proposals, posters, approvals or direct SQL repairs to bypass a conflict.

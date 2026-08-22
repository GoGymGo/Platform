# GGG-014 partner intake and authoritative review

## Outcome

Prospective sponsors, gym operators, and enabled Creator applicants receive one
authoritative API receipt for a validated, replay-safe application. Public
requests are rate limited, consented, spam screened, and retained only for the
configured bounded period. A receipt never means approval, activation, a
contract, or promised follow-up. Creator intake remains unavailable unless both
the member release and API release gates are intentionally enabled.

Authorized GoGymGo operators review applications through the global work queue.
The detail read exposes only the type-specific application facts needed for a
decision, declares the permitted transition and current review version, and
prevents self-review. Decisions remain database-authorized, body-bound,
idempotent, optimistically versioned, and append-only audited.

## Boundaries

This duty spans landing, member, API/worker, admin, generated contracts, privacy
operations, and documentation because each surface participates in the same
intake trust boundary. The API and PostgreSQL are authoritative. Landing uses
its existing authenticated API-only forwarding path and never falls back to D1.
Member routes never persist or simulate a submission when the API is absent.
Admin clients runtime-validate both queue detail and the legacy summary list.

Landing interest rows remain read-only leads without an approval lifecycle.
Partner applications use the review queue, but approval still does not create a
campaign, activate a gym, publish Creator content, issue a QR poster, provision
portal access, or form a contract. This change does not contact a provider,
inspect credentials or real data, deploy, enable a flag, or edit the delivery
ledger.

## Rollout

1. Apply the forward-only partner-intake migration before the API or worker.
2. Configure an owner-approved `PARTNER_APPLICATION_RETENTION_DAYS` value from
   30 through 730 before exposing public sponsor or gym intake. Missing policy
   fails closed without storing an application.
3. Deploy API and worker together, then member, admin, and landing artifacts
   from the same reviewed commit. Keep `CREATOR_FEATURES_ENABLED` and the member
   Creator build flag false until program, business, safety, and rights approval
   is recorded separately.
4. In authorized staging, prove one created receipt, an identical duplicate,
   changed-body idempotency conflict, rate limit, spam screen, unavailable API,
   self-review denial, stale decision conflict, audit projection, retention
   purge, privacy export, and account deletion.

## Validation

Run focused DTO, policy, service, controller, privacy, worker, operator, admin
decoder, member domain/service/source, landing request/rendered-copy, OpenAPI,
and generated-contract tests. Then run serial type, lint, unit, E2E, source,
artifact, build, governance, dependency, secret, and clean-diff gates with
reduced concurrency. The forward migration, unique duplicate behavior,
transactional decisions, retention purge, and privacy queries require a clean
disposable PostgreSQL/PostGIS proof; no Docker or database-backed command may
run until fresh authorization is received.

## Recovery

The additive migration remains applied during an application rollback. Disable
or remove public routing to the intake endpoints if the approved retention
policy is missing or the API cannot return an exact receipt. Keep Creator flags
false if client/API parity is uncertain. An ambiguous client request is retried
with the same body-bound key; a changed application uses a new key.

Do not repair conflicts by editing application rows, reusing an idempotency key
for a changed body, bypassing review, or issuing partner capabilities manually.
Restore the last compatible application release, preserve the audit trail, and
correct forward. Reversal of production data, credentials, flags, or deployed
provider state requires a separately reviewed and authorized operation.

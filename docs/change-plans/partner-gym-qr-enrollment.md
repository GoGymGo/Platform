# Partner gym QR enrollment integrity

## Outcome

Make each Contest poster an expiring, revocable, contest-and-gym scoped public
enrollment credential; bind an eligible member's enrollment immutably to that
exact approved Partner gym; and let only appropriately scoped operators issue,
inspect, render, and revoke posters safely under retries.

## Boundaries

- The member app owns honest camera, location, link, loading, error, retry, and
  cancel states. It keeps a QR credential only until enrollment completes and
  uses the authoritative enrollment for later gym-location checks.
- The API owns credential resolution, expiry and revocation checks, exact
  Contest/gym/region assignment, verified member identity, current enrollment
  reads, operator scope, audit records, and idempotent value-bearing actions.
- PostgreSQL owns credential lifecycle consistency and the exact relationship
  between a credential, enrollment, Contest, Partner gym, and downstream
  workout session.
- The admin and partner portal own scoped poster issuance, recovery, inspection,
  download, and revocation presentation. The printable artifact contains only
  the intentionally public enrollment URL; credential lists do not expose it.
- Real gym identity and coordinates, physical poster placement, final native
  application identifiers, signed-device testing, and deployment remain
  external release gates. Competition scoring, Weekly Challenges, and broader
  partner administration remain separately owned features.

## Rollout

1. Apply the forward-only QR integrity migration before starting the updated
   API. Existing credentials receive the owning Contest end as their expiry;
   unscoped retired history receives a terminal fallback expiry.
2. Deploy the API contract and clients from the same tested revision.
3. Configure only a verified real Partner gym, assign it to the exact Contest,
   issue a fresh poster, and revoke any test-era poster before printing.
4. Keep registration closed until real-gym, legal, reward, native/browser, and
   physical-device UAT gates are complete.

## Validation

- Unit and database integration coverage proves malformed, expired, revoked,
  deleted, inactive, unassigned, cross-Contest, cross-gym, replayed, and
  concurrent requests fail closed without conflicting enrollment state.
- Operator coverage proves exact role/gym scope, stable issue/revoke/assignment
  retries, audit evidence, secret-free credential history, and poster scope.
- Member repository, storage, source, journey, native-link, demo-isolation, and
  production-artifact audits prove the real flow cannot fall back to sample
  gym data and does not retain the QR credential after enrollment.
- Generated OpenAPI contracts, migrations, governance, dependency audit, and
  repository checks must pass on the exact published head.

## Recovery

If a client release regresses, revert that client while the API continues to
fail closed. If API rollout fails, return to the prior API artifact while
leaving the additive expiry and integrity constraints applied. Revoke a poster
through the scoped operator action; never delete credential, enrollment, scan,
session, idempotency, or audit history. Issue a new poster only after the
operator verifies the exact Contest and Partner gym shown in the preview.

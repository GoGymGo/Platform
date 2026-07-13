# Payout operations

Hyperwallet is the hosted payee boundary. The mobile client never receives provider credentials and GoGymGo never collects or stores bank account numbers. A claim can become `ready` only from a processed Hyperwallet transfer-method activation notification.

## Operator decision contract

1. Read `GET /v1/operator/payout-claims/{claimId}/review` immediately before deciding. The response contains the amount, currency, competition and draw references, winner rank, account eligibility booleans, safe payee/payment statuses, claim status, and claim version. It excludes email addresses, Firebase identifiers, provider tokens, bank details, tax data, and identity documents.
2. Submit the returned `version` as `expectedVersion` to either `POST /v1/operator/payout-claims/{claimId}/approve` or `POST /v1/operator/payout-claims/{claimId}/release`, together with the idempotency key and decision reason.
3. Treat `PAYOUT_CLAIM_VERSION_STALE` as a mandatory refresh. Never resubmit with a guessed version.
4. Approval and release both run under a row lock and re-check that the winner account is active and its email is present and verified. Release additionally requires the provider-created payee mapping and the webhook-derived `ready` state.

The API records one append-only operator audit event for each successful decision with the exact previous and next claim status and version. An idempotent retry cannot enqueue another approval notification, write a second decision audit, or create another payment.

## Database invariants

PostgreSQL rejects mutation of payout claim ownership, draw winner, provider, amount, currency, or creation time. It also rejects mutation of payment claim ownership, client payment ID, amount, currency, or creation time, and prevents reassignment of a stored Hyperwallet payee token. Claim versions must increment by exactly one and all database claim status changes must follow the application state machine.

These controls reduce application-bug and stale-operator risk; they do not replace provider onboarding, sanctions/KYC decisions, tax reporting, jurisdictional legal review, reconciliation, incident response, or provider sandbox and production certification.

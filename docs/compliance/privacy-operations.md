# Privacy operations

GoGymGo treats privacy requests as controlled operations, not immediate mobile-client mutations. A signed-in user creates one export or deletion request, an authorized operator records a reason and starts or rejects it, and the private worker executes approved requests with a bounded PostgreSQL lease.

This document describes the technical policy. Launch counsel must approve jurisdiction-specific response times, notice text, identity verification, legal holds, and retention periods before production enablement.

## Export workflow

1. `POST /v1/me/privacy-requests` creates a `requested` export with an idempotency key.
2. Operations validates the request and changes it to `processing`.
3. The worker reads a repeatable PostgreSQL snapshot and builds a versioned JSON file. Security credentials, other users' identifiers, provider tokens, and internal case material are excluded explicitly.
4. The worker atomically creates one object at `privacy-exports/{userId}/{requestId}.json`, records its SHA-256 digest, and marks the request complete.
5. The authenticated owner may call `POST /v1/me/privacy-requests/{id}/download-action`. The API returns a V4 read URL lasting no longer than five minutes or the export's remaining lifetime.
6. After seven days, the worker deletes the object and records the deletion time. The bucket lifecycle is a defense-in-depth cleanup if application processing is delayed. The export bucket is private, has public access prevention and uniform bucket-level access, and must not be reused for public media.

## Deletion workflow

External deletion happens before the local database transaction. Each external action is idempotent, so a database failure can be retried safely.

The worker:

- defers deletion while an active competition or open reward claim still requires the account, leaving access intact for operator review;
- deletes the Firebase account, treating an already-absent user as success;
- enumerates and deletes every active, pending, rejected, superseded, removed, or expired profile-media object that has not already been deleted, plus every previous privacy-export object;
- removes push tokens and queued/sent notification records;
- removes idempotency records keyed by the former Firebase UID;
- removes public profile identity and replaces Firebase UID and callsign with namespace-separated HMAC pseudonyms;
- removes precise region evidence detail and free-text decision reasons while preserving the eligibility decision and policy version;
- removes partner contact/payload data and unpublishes creator content metadata;
- clears privacy-request reasons and marks the account `deleted`;
- records an immutable completion event without personal information.

The database retains pseudonymized account legal receipt bundles, competition enrollments, rules acceptance facts, workout evidence, entry ledgers, draws, reward awards, fraud evidence, and operator audit events. Assigned coupon ciphertext is excluded from the user's export, and unassigned codes are never linked to user identity. A September cash fulfillment retains only the exact Award, immutable value/currency, responsible authorized operator, server timestamp, bounded operational reason and append-only audit evidence; it contains no bank, payee, card, wallet, tax, balance, provider or transfer data. The user's export describes the settled reward snapshot and fulfillment time but excludes the private operator reason and operator identity. Legal receipts identify the exact document version, content digest, jurisdiction, locale, required action, and server acceptance time; they do not retain IP addresses or device fingerprints. These records protect contest integrity and meet fraud, dispute, and legal-hold obligations. Retention schedules and any future fulfillment subprocessors require legal approval; the deletion endpoint must not claim that legally retained records were erased.

## Failure and incident behavior

- A lease token prevents a stale worker from finalizing work claimed by another worker.
- Failed attempts store only a bounded failure code and the next retry time. Exception messages and payloads are never persisted.
- Retry delay grows exponentially to six hours. Repeated failures remain visible in the operator queue.
- Object creation uses `ifGenerationMatch=0`; a retry accepts only an existing object carrying a valid SHA-256 metadata value.
- Object deletion treats `404` as success.
- The pseudonymization key must never be logged, exposed to Expo, or committed. Loss of the key does not restore deleted identifiers; compromise of the key requires incident response and rotation planning.

Cloud Storage references:

- <https://docs.cloud.google.com/storage/docs/access-control/signed-urls>
- <https://docs.cloud.google.com/storage/docs/access-control/signing-urls-with-helpers>
- <https://docs.cloud.google.com/storage/docs/uniform-bucket-level-access>
- <https://docs.cloud.google.com/storage/docs/public-access-prevention>
- <https://docs.cloud.google.com/storage/docs/lifecycle>

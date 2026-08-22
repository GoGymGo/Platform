# Privacy operations

GoGymGo treats privacy requests as controlled operations, not immediate mobile-client mutations. A signed-in user creates one export or deletion request, an authorized operator records a reason and starts or rejects it, and the private worker executes approved requests with a bounded PostgreSQL lease.

This document describes the technical policy. Launch counsel must approve jurisdiction-specific response times, notice text, identity verification, legal holds, and retention periods before production enablement.

## Export workflow

1. `GET /v1/me/privacy-requests/capabilities` must report request creation
   enabled. `POST /v1/me/privacy-requests` then creates a `requested` export
   with an idempotency key and exact `EXPORT_MY_DATA` confirmation. A disabled
   deployment returns an unavailable error and stores no request.
2. Operations validates the request and changes it to `processing` with a
   reason, the current `expectedVersion`, and a body-bound idempotency key.
   The deciding administrator is reauthorized from the database before an
   idempotent replay and cannot decide a request owned by the same account.
3. The worker reads a repeatable PostgreSQL snapshot and builds deterministic
   portable JSON schema version 16. The exhaustive table-disposition map covers
   every current authoritative table. It includes the member's account,
   consent/legal, region, Contest/workout/ledger/reward, social, Creator,
   Partner, notification/media, and privacy lifecycle data while excluding
   provider/bearer secrets, raw or hashed device/QR credentials, push tokens,
   coupon inventory, object keys, other-user identifiers, and internal case or
   operator material.
   Partner applications include both account-linked Creator rows and anonymous
   sponsor/gym rows whose canonical contact email matches the account. Their
   review version and configured retention expiry are included in the export.
4. The worker atomically creates one S3 object at `privacy-exports/{userId}/{requestId}.json` with `If-None-Match: *`, records its SHA-256 digest, and marks the request complete.
5. The authenticated owner may call `POST /v1/me/privacy-requests/{id}/download-action`. The API returns a presigned S3 read URL lasting no longer than five minutes or the export's remaining lifetime.
6. After seven days, the worker deletes the object and records the deletion time. The bucket lifecycle is a defense-in-depth cleanup if application processing is delayed. The export bucket is private, has public access prevention and uniform bucket-level access, and must not be reused for public media.

## Deletion workflow

External deletion happens before the local database transaction. Each external action is idempotent, so a database failure can be retried safely.

Deletion creation requires exact `DELETE_MY_ACCOUNT` confirmation. An operator
cannot decide it from client role claims: the API re-resolves the exact verified,
password-authenticated, unscoped database role and current request version.

The worker:

- defers deletion while an active competition or open reward claim still requires the account, leaving access intact for operator review;
- deletes the Firebase account, treating only an authoritative already-absent
  response as success; unavailable or failed identity cleanup leaves the job
  retryable and does not claim account erasure;
- enumerates and deletes every active, pending, rejected, superseded, removed,
  or expired profile-media object that has not already been deleted, using the
  captured exact storage version when one exists and resolving the exact live
  version first for an upload that never completed, plus every previous
  privacy-export object;
- removes push tokens and queued/sent notification records;
- removes owned Challenge memberships/check-ins/content, friendship/block rows,
  private Creator plans/submissions, and Partner gym assignments;
- preserves gym-owned Contest proposal provenance against the pseudonymized
  account while exporting only its minimized lifecycle, version and timestamps;
- removes idempotency records keyed by the former Firebase UID;
- removes public profile identity and replaces Firebase UID and callsign with namespace-separated HMAC pseudonyms;
- removes precise region evidence detail and free-text decision reasons while preserving the eligibility decision and policy version;
- removes partner contact/payload data from account-linked rows and anonymous
  sponsor/gym rows matching the canonical account email, and unpublishes
  creator content metadata;
- clears privacy-request reasons and marks the account `deleted`;
- records an immutable completion event without personal information.

The database retains pseudonymized account legal receipt and verification-consent
evidence, competition enrollment/rules/workout/ledger/scoring/settlement facts,
immutable draw and published Alias/streak result snapshots, reward awards,
fraud evidence, and operator audit events. These are the approved unlinkable or
pseudonymous contest-integrity, dispute, legal-receipt, and hold records; no
direct profile/Firebase identity or private content remains. Assigned coupon
ciphertext is excluded from the user's export, and unassigned codes are never
linked to user identity. A September cash fulfillment retains only the exact
Award, immutable value/currency, responsible authorized operator, server
timestamp, bounded operational reason and append-only audit evidence; it
contains no bank, payee, card, wallet, tax, balance, provider or transfer data.
Gym-owned Contest proposals remain attributable only to the retained
pseudonymized account row: deletion does not erase, reassign or replace their
immutable proposer, gym or creation provenance. The export omits proposer and
reviewer identifiers, but schema version 16 includes status, lifecycle version,
submission, withdrawal, archival and publication timestamps for proposals made
by the requesting account.
The user's export describes the settled reward snapshot and fulfillment time
but excludes the private operator reason and operator identity. Legal receipts
identify the exact document version, content digest, jurisdiction, locale,
required action, and server acceptance time; they do not retain IP addresses or
device fingerprints. Retention schedules and any future fulfillment
subprocessors require legal approval; deletion must not claim that approved
retained facts were erased.

## Failure and incident behavior

- A bounded lease token prevents a stale worker from finalizing work claimed by
  another worker. The owner renews it after export construction and before and
  after every object/identity call; expiry permits takeover, while every
  completion/failure write requires the same still-live token.
- Failed attempts store only a bounded failure code and the next retry time. Exception messages and payloads are never persisted.
- Retry delay grows exponentially to six hours. Repeated failures remain visible in the operator queue.
- Operator queue detail includes lifecycle and bounded retry/lease facts, not
  the export body, deletion payload, owner contact details, signed download
  action, internal worker exception, or operator-only decision history. Audit
  projections recursively remove those same private and credential fields.
- Object creation uses `If-None-Match: *`; a retry accepts only an existing
  object carrying a valid SHA-256 metadata value.
- Object deletion treats `404` as success.
- The pseudonymization key must never be logged, exposed to Expo, or committed. Loss of the key does not restore deleted identifiers; compromise of the key requires incident response and rotation planning.

## Local-device reset

Local reset is not this server workflow. The member app signs out, clears its
query cache and only GoGymGo/Firebase app storage namespaces, recovery keys,
owned cookies, and owned caches. It preserves unrelated app/browser data,
creates no privacy request, and explicitly says that the server account and
history remain. A failed reset says local data may remain and offers retry; it
never implies server deletion.

The implementation depends on S3 presigned-request expiry, conditional writes,
private bucket/public-access blocking, object metadata, idempotent deletes, KMS
encryption, and lifecycle expiry. Repository validation cannot prove the target
account's bucket policy, IAM, KMS key, or lifecycle; those remain deployment
gates.

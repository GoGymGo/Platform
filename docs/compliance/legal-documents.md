# Account legal documents and receipts

GoGymGo treats account Terms and Privacy records as server-authoritative compliance evidence, not as a device preference. This is a technical control, not legal approval: qualified counsel must approve every document, required user action, jurisdiction, locale, effective time, and retention schedule before an operator publishes it.

## Document publication

An administrator publishes an immutable version with `POST /v1/operator/configuration/legal-documents`. The command requires an idempotency key and a reason, computes the canonical content SHA-256 on the server, and records both an append-only document state event and an immutable operator audit event. Published content cannot be edited or deleted.

Documents are keyed by:

- a stable purpose such as `terms_of_service`, `privacy_policy`, or a jurisdiction-specific addendum;
- `GLOBAL`, country, or country-subdivision jurisdiction code;
- locale such as `en-CA` or `fr-CA`;
- an operator-controlled version and server-controlled content digest;
- an `accept`, `acknowledge`, or `none` receipt requirement;
- an effective timestamp.

For a request such as `CA-BC`, the resolver chooses the newest effective published version for each document key in exact-scope, country, then global order. It never falls back between locales. This permits a regional addendum or override without treating North America as one legal ruleset.

`POST /v1/operator/configuration/legal-documents/{id}/withdrawal` appends a withdrawal event. It does not mutate the document. Resolution then safely returns to the previous published version for that key and scope. A new version in the same key, jurisdiction, and locale must have a later effective time than every earlier version, including a withdrawn scheduled version.

## Mobile receipt workflow

1. Before the account legal step, fetch `GET /v1/legal-documents/current?jurisdictionCode=CA-BC&locale=en-CA`.
2. Render the returned titles and content. Do not claim that bundled app copy is current unless its document IDs and SHA-256 values match the server bundle.
3. Use the returned `receiptRequirement` to distinguish affirmative agreement from notice acknowledgment. Do not relabel an acknowledgment as consent.
4. Submit every receipt-required document atomically to `POST /v1/me/legal-receipts` with the returned `bundleSha256`, document IDs, content digests, and exact actions. The API supplies the authoritative acceptance time.
5. Read `GET /v1/me/legal-receipts/status` after sign-in, account switching, app restoration, or a document-change response. AsyncStorage may cache presentation state, but it is not authoritative evidence.
6. Supply the returned `receiptBundleId` to `POST /v1/competitions/{competitionId}/enrollments`. The backend verifies ownership, exact competition jurisdiction, current locale-specific bundle digest, and complete receipts in the same enrollment transaction.

The account bundle is considered configured only when current receipt-required `terms_of_service` and `privacy_policy` documents resolve. Missing configuration fails cash-competition enrollment closed. Additional current document keys with `accept` or `acknowledge` are also required in the atomic bundle.

## Integrity and data minimization

- Legal documents, state events, receipt bundles, and individual receipts are append-only at the database boundary.
- A database trigger rejects a receipt whose action or presented content hash does not match its immutable document.
- Receipt bundles record the account, exact jurisdiction, locale, bundle digest, server acceptance time, and exact document receipts.
- The receipt path intentionally does not collect IP addresses, device fingerprints, free-text user data, or client-authored acceptance times.
- Privacy exports include legal receipt metadata and document digests. Account erasure removes direct account identity but retains the pseudonymous receipt evidence described in the approved retention policy.

The public document endpoint can return `configured: false` so pre-authentication UI can show a controlled unavailable state. Recording a receipt or enrolling while the required bundle is missing returns `LEGAL_DOCUMENTS_NOT_CONFIGURED`. A bundle mismatch returns `LEGAL_DOCUMENTS_CHANGED`; enrollment against a superseded bundle returns `LEGAL_RECEIPT_BUNDLE_STALE` so the app can present the current documents again.

## Launch gates

Before enabling account creation or reward-contest enrollment in a jurisdiction:

- counsel approves and supplies the exact document content, action labels, scope, locale, effective time, and official competition rules;
- an authorized administrator publishes and independently verifies the current bundle through the public endpoint;
- the mobile app completes real-device tests for first acceptance, account switching, stale-document re-presentation, offline behavior, and enrollment;
- operations tests emergency withdrawal and restoration of the prior version;
- privacy, retention, and evidence-access procedures are approved and rehearsed.

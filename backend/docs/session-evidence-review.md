# Session evidence review

## Trust decision

Workout evidence submitted by the Expo app is an untrusted claim. Heart-rate values and face confidence are client-authored; QR and device tokens are reduced to hashes before storage. A complete submission may enter `pending_review`, but it cannot award competition progress or entries until an authorized operator makes an accountable decision.

Manual review is a controlled fallback, not cryptographic verification. Production reward contests remain launch-blocked until required evidence sources have approved server-side verification implementations and real-device/provider UAT.

## Bound review flow

1. An authorized operator reads `GET /v1/operator/sessions/{sessionId}/review`.
2. The API derives a privacy-minimized summary from the immutable session and append-only events. It returns counts, bounded aggregates, declared trust states, rule-required flags, and an `evidenceSnapshotSha256`. Raw QR/device values and their stored hashes are not returned.
3. The operator submits either `POST /v1/operator/sessions/{sessionId}/verify` or `POST /v1/operator/sessions/{sessionId}/reject` with the exact snapshot digest, a reason, and one typed finding for each evidence category.
4. In a row-locked transaction, the API recomputes the digest. A stale or foreign digest fails closed. Approval requires every competition-required category to be `approved` and no category to be `rejected`; rejection requires at least one explicit `rejected` finding.
5. The API, not the operator, builds the stored decision summary and writes the operator, reason, snapshot, findings, and terminal state to the audit log. Approval appends the entry-ledger award exactly once. Rejection appends no value and is retry-safe, allowing settlement to proceed once every session is terminal.

The digest commits to the session identity, competition, eligible date, policy version, exact rules, server start/completion times, state, and every stored event ID, type, timestamp, and payload. Event order is canonicalized so the same evidence always produces the same digest.

## Data minimization

The operator response intentionally excludes:

- raw QR payloads and device-attestation tokens;
- stored QR/token hashes;
- precise location data;
- unrelated identity-document or reward-fulfillment data; and
- arbitrary client-authored evidence summaries.

Only safe aggregates needed for a decision are exposed. Structured logs continue to redact evidence fields.

## Required production integrations

Before enabling production contest verification, choose and implement the evidence providers required by the approved competition policy. The current repository does not claim these controls exist.

- Verify Apple App Attest and Google Play Integrity assertions server-side, including nonce, app identity, timestamp, replay, and device-risk policy.
- Replace generic gym QR claims with short-lived, partner-signed, server-verifiable credentials and replay controls.
- Define an approved source and consent model for heart-rate evidence; a client-posted BPM is not a wearable-provider assertion.
- Define an approved liveness/face-verification vendor and biometric privacy process if face checks remain required.
- Retain only the minimum provider result, reference, policy version, and audit evidence approved by security, privacy, and legal review.
- Exercise success, replay, timeout, provider outage, appeal, and false-positive cases in staging on real iOS and Android devices.

Until those gates pass, the API accurately labels a successful decision as `operator_manual_review`; it never labels the evidence `provider_verified`.

# Static QR pilot verification

## Trust decision

The September 2026 pilot uses one static, versioned gym credential selected at
enrollment plus fresh browser location readings at workout start and finish.
The credential identifies the configured Partner gym; it does not prove that
the browser or location signal is tamper-proof.
The API therefore treats every client field as an untrusted claim and makes the
complete decision using server state and server time.

Wearables, heart-rate evidence, device attestation, Face ID/passcode prompts,
biometric consent and random mid-session checks are outside the pilot. Their
legacy implementation is not reachable from the production member flow.

## One endpoint, two location checks

`POST /v1/gym-scans` accepts an authenticated `GymScanRequest` containing the
opaque credential, a client event UUID and a fresh location accuracy/coordinate
reading. It returns one of `started`, `too_early`, `verified` or `rejected`.

1. The API hashes the credential and resolves only an active credential version.
2. It rejects accuracy worse than 50 metres and uses PostGIS to enforce the
   configured 75 metre gym radius.
3. It row-locks the player and current session so concurrent checks serialize.
4. A first eligible location check starts the authoritative timer.
5. A finish check before 30 minutes returns `too_early` with the remaining server time.
6. A finish check after 30 minutes rechecks the geofence and completes the session.
7. Active sessions expire after four hours. Missing finish checks earn no credit.
8. A unique competition/user/local-date ledger constraint permits at most one
   verified competition day per `America/Vancouver` calendar date.

The location-check event UUID and idempotency key protect separate replay and network-retry
cases. Revocation invalidates the printed credential immediately; reissuing a
poster increments its credential version.

## Data minimization

Raw latitude, longitude and accuracy are used only inside the location-check transaction.
They are not inserted into scan events, session summaries, operator audit events
or application logs. Retained scan data is limited to the gym, credential
version, scan type, server timestamp and outcome. Structured logging redacts the
credential and all coordinate-like fields.

## Operational limitation

One-time static QR selection plus browser GPS is best-effort proximity verification, not tamper-proof
location attestation. The pilot is appropriate only after staging tests at the
real condo gym, owner-approved rules describe the method accurately, and the
reward risk is accepted.

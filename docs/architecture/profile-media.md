# Private profile-media operations

Avatar media uses a private, moderated object lifecycle. The Expo client never receives bucket credentials, and the database never stores a signed URL.

## Owner flow

1. Select a JPEG, PNG, or WebP image. The server remains authoritative for the
   configured byte limit (two MiB by default) and the 64–2,048 pixel dimension
   bounds; client MIME or dimensions are never trusted.
2. Read `GET /v1/me/avatar/capabilities`. Upload remains unavailable when the
   feature is disabled, incompletely configured, or unreachable. If configured,
   call `POST /v1/me/avatar-upload` with an `Idempotency-Key`, exact
   `contentLength`, and `contentType`.
3. Upload the raw bytes with `PUT` to the returned S3 presigned URL and include
   every returned header unchanged. The five-minute signature binds the exact
   object, MIME type, byte length, media ID, and `If-None-Match: *` create-only
   precondition.
4. Call `POST /v1/me/avatar-upload/{mediaId}/complete`. The API binds an exact
   metadata read and bounded full-object read to the same ETag/version, then
   parses the complete container and fully decodes its pixels. It rejects MIME,
   length, media-ID, identity, CRC/container, trailing polyglot, metadata,
   animation, dimension, pixel-count, or decode mismatches. Only the verified
   SHA-256, dimensions, inspection version, byte count, ETag, and optional S3
   version enter `pending_review`.
5. Use `GET /v1/me/avatar` for owner state. `pending_review` media is visible
   only through an owner-authorized short-lived preview. It is never used as
   the profile image, and the client runtime-validates the exact response before
   use. Approved image URLs are keyed by media review version to prevent stale
   cache reuse.
6. Starting a replacement atomically supersedes any older pending upload/review
   under a per-member database lock. `DELETE /v1/me/avatar` atomically revokes
   active and pending presentation. Both paths increment the media/profile
   versions and leave object deletion as durable retryable worker work.

The upload-initiation idempotency key is stored with the media row rather than the generic JSON response cache. This lets a safe retry mint a fresh bounded signature without persisting a bearer-like URL. Reusing the key with different file metadata fails closed.

## Moderation flow

- Pending media appears as `profile_media` in `GET /v1/operator/work-queue`.
- An authorized operator requests `GET /v1/operator/profile-media/{mediaId}/review-action` for a short-lived private read URL. The API rechecks the live object's exact size, MIME, media ID, ETag, and optional version before returning only verified MIME, byte count, dimensions, digest, submission time, review version, expiry, and action URL.
- `POST /v1/operator/profile-media/{mediaId}/decision` requires an idempotency key, reason, and current `expectedVersion`. The database administrator is reauthorized before a replay, self-review is denied, and a changed body, state, or version fails closed. Approval atomically activates the new object and supersedes the previous avatar. Rejection leaves any previous approved avatar active.
- Every decision writes the append-only operator audit ledger. Signed review URLs and image bytes are not written to PostgreSQL or logs.

## Cleanup and privacy

The worker deletes rejected, superseded, removed, and expired-upload objects only after the corresponding upload action has expired. This prevents a still-valid create-only URL from recreating an object after deletion. Cleanup claims one row with `FOR UPDATE SKIP LOCKED`, a bounded lease token, durable attempt/failure code, and scheduled retry. Completion remains conditional on the current token, so an expired owner cannot overwrite a reclaiming worker. Deletion is idempotent and targets the captured S3 version when one exists. For an abandoned upload that never reached completion, the adapter first discovers the live version and deletes that exact version when the provider reports one; this avoids leaving versioned content behind a delete marker. Account erasure likewise waits for active upload actions to expire, then enumerates every undeleted profile-media object with its captured storage version, resolves any uncaptured live version, deletes each object before identity pseudonymization, removes the media rows, and clears the profile pointer. Data exports include media status, verified digest/dimensions/inspection version, and timestamps but exclude storage object keys/version IDs, signatures, and internal moderation reasons.

The API task role receives only the S3 object actions required to presign,
verify, and read the bucket's `avatars/` prefix. It cannot delete content. The
worker role retains bounded delete access for cleanup and privacy execution.
S3 Block Public Access, bucket-owner-enforced object ownership, KMS encryption,
private bucket policy, and lifecycle rules remain deployment gates.

The storage adapter relies on bounded S3 presigned URLs, conditional writes,
object metadata plus ETag/version-bound full reads, and exact-version idempotent
deletes. Cloud policies and lifecycle must be verified in the owning AWS
account before enablement; the repository does not infer them.

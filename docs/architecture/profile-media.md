# Private profile-media operations

Avatar media uses a private, moderated object lifecycle. The Expo client never receives bucket credentials, and the database never stores a signed URL.

## Owner flow

1. Resize and encode the selected image locally. V1 accepts JPEG, PNG, or WebP up to the configured two-megabyte default.
2. Call `POST /v1/me/avatar-upload` with an `Idempotency-Key`, exact `contentLength`, and `contentType`.
3. Upload the raw bytes with `PUT` to the returned S3 presigned URL and include
   every returned header unchanged. The five-minute signature binds the exact
   object, MIME type, byte length, media ID, and `If-None-Match: *` create-only
   precondition.
4. Call `POST /v1/me/avatar-upload/{mediaId}/complete`. The API reads private object metadata plus a bounded 12-byte prefix and rejects a missing object, encoded-content mismatch, size/type mismatch, or media-ID mismatch.
5. Use `GET /v1/me/avatar` for owner state. `pending_review` media is visible only through an owner-authorized short-lived preview. It is not activated on public profile surfaces.
6. `DELETE /v1/me/avatar` removes active and pending selections. Object deletion is durable worker work and is safe to retry.

The upload-initiation idempotency key is stored with the media row rather than the generic JSON response cache. This lets a safe retry mint a fresh bounded signature without persisting a bearer-like URL. Reusing the key with different file metadata fails closed.

## Moderation flow

- Pending media appears as `profile_media` in `GET /v1/operator/work-queue`.
- An authorized operator requests `GET /v1/operator/profile-media/{mediaId}/review-action` for a short-lived private read URL.
- `POST /v1/operator/profile-media/{mediaId}/decision` requires an idempotency key and a reason. Approval atomically activates the new object and supersedes the previous avatar. Rejection leaves any previous approved avatar active.
- Every decision writes the append-only operator audit ledger. Signed review URLs and image bytes are not written to PostgreSQL or logs.

## Cleanup and privacy

The worker deletes rejected, superseded, removed, and expired-upload objects only after the corresponding upload action has expired. This prevents a still-valid create-only URL from recreating an object after deletion. Deletion is idempotent, so concurrent worker attempts cannot restore or duplicate content. Account erasure likewise waits for active upload actions to expire, then enumerates every undeleted profile-media object, deletes each object before identity pseudonymization, removes the media rows, and clears the profile pointer. Data exports include media status and timestamps but exclude storage object keys, signatures, and internal moderation reasons.

The API task role receives only the S3 object actions required to presign,
verify, and read the bucket's `avatars/` prefix. It cannot delete content. The
worker role retains bounded delete access for cleanup and privacy execution.
S3 Block Public Access, bucket-owner-enforced object ownership, KMS encryption,
private bucket policy, and lifecycle rules remain deployment gates.

The storage adapter relies on bounded S3 presigned URLs, conditional writes,
object metadata/ETag or version identity, ranged prefix reads, and idempotent
deletes. Cloud policies and lifecycle must be verified in the owning AWS
account before enablement; the repository does not infer them.

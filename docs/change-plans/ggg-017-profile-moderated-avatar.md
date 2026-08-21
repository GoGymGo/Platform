# GGG-017 profile Alias and moderated avatar

## Outcome

Deliver one authoritative Profile experience where an authenticated member can
manage the canonical Alias, see honest account controls, and optionally submit a
bounded private avatar when the deployment explicitly enables and configures
profile media. Submitted media remains private and non-presentational until a
current administrator approves the exact verified version. Rejected, replaced,
removed, expired, and account-deleted objects remain durable cleanup work.

## Boundaries

This change necessarily coordinates three runtime owners. The member app owns
runtime decoding and accessible Profile states, the API/worker owns Alias and
media authority plus private-storage lifecycle, and the admin app owns the
minimized moderation interaction. Generated contracts describe those public
boundaries. The landing site remains unchanged and gains no member directory.

The repository does not establish an S3 bucket, CORS rule, object lifecycle,
KMS key, IAM role, credential, alert destination, or provider health. The
`PROFILE_MEDIA_ENABLED` default remains `false`. No hosted upload or real-device
claim follows from repository validation.

## Rollout

1. Apply the forward-only profile-media integrity migration before the API and
   worker revision. It revokes legacy approved/pending-review media that never
   passed the new full decoder, retains the rows for durable cleanup, and
   resolves duplicate pending candidates by preserving only the newest. Only
   media completed through the strict inspection version may enter review.
2. Deploy the API and worker with profile media still disabled. Confirm the
   member and operator surfaces report disabled/unconfigured provider state and
   that unrelated Profile, privacy, sign-out, withdrawal, and local reset paths
   remain available.
3. Under separate release authorization, verify the private bucket, public
   access blocking, ownership, encryption, exact signed PUT headers, CORS,
   version/ETag behavior, lifecycle, API/worker IAM split, and cleanup alerts in
   the owning AWS account. Only then enable `PROFILE_MEDIA_ENABLED` in a staged
   environment and run disposable browser and real-device upload/moderation/
   replacement/removal rehearsals.

## Validation

Serial repository validation covers Alias normalization/reservation/uniqueness,
strict image container and metadata inspection, signed action TTL/scope/headers,
ownership, pending/approved/rejected/replaced/removed transitions, stale review
and body-bound idempotency rejection, cleanup lease fencing/retry, privacy export
minimization/deletion, runtime response decoding, cache versioning, accessible
member states, minimized admin facts, generated OpenAPI/contracts, source audits,
and production artifact checks. Database integration uses Testcontainers only
after fresh authorization for the exact commands and resource envelope.

External release validation must separately retain sanitized evidence for S3
CORS on each supported client, create-only conditional writes, private reads,
object identity binding, partial provider failure, cleanup takeover, alerting,
account deletion, and cache revocation on real browsers/devices.

## Recovery

Keep profile media disabled if configuration or provider evidence is missing.
The member app then retains Alias and account controls while presenting avatar
upload as unavailable. If a staged media rollout fails, disable the flag without
discarding database rows; pending and terminal rows remain private and the
worker can resume idempotent cleanup after provider recovery. Roll back runtime
code only after confirming the deployed schema remains forward-compatible. Do
not delete media rows manually, reuse signed URLs, mark cleanup complete, or
claim account erasure while provider work is incomplete.

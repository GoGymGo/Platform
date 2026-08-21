# Competition reminders and push operations

`PUSH_NOTIFICATIONS_ENABLED=false` is the release-safe default. It disables
remote token registration and worker provider calls; it does not disable local
native reminders after a member grants permission and explicitly opts in.

## Member-visible states

Profile presents three independent facts under one opt-in:

- permission: not requested, denied, granted, provisional/quiet, checking, or
  unavailable;
- local schedule: disabled, scheduled with count and Contest IANA timezone,
  unavailable, error, or retry; Weekly Goal reminders use 18:00, Weekly
  Challenge uses 18:15 on each scoring-week close, and Bonus Day uses 09:00;
- remote push: disabled by preference/environment, unavailable, registered,
  error, or retry.

The toggle is never enabled automatically by Weekly Goal selection. Web and App
Tour cannot schedule or register. A denied permission cancels owned local
schedules and disables the owned remote registration. Disable and explicit
sign-out cancel local schedules, then owner-scope the server disable; a failed
server disable retains the device ID and shows retry instead of claiming full
cleanup. Account deletion removes push devices and notification deliveries.

All date keys are converted at the declared Contest IANA timezone, including
the timezone database's current daylight-saving rules. The schedule is capped
at 40 owned notifications and replaces only notifications carrying GoGymGo's
competition owner marker.

## Registration and delivery

`GET /v1/me/push-devices/capabilities` reports only whether registration is
available and the five-device limit. When available, `POST` accepts one Expo
token, platform and random installation UUID under the authenticated member.
The same installation rotates its token in place. Proof of a new token transfers
that token away from a previous installation/account atomically; the old row is
disabled and its token is cleared. A sixth enabled installation disables and
clears the least recently registered device. `DELETE` is idempotent for the
owner and returns not found for another account.

One user/event dedupe key creates one durable delivery. The first claim snapshots
at most five enabled device IDs, consumes one of five attempts and receives a
30-second lease. Accepted and invalid-token tickets are completed per device;
invalid tokens are cleared. Retryable tickets retain only a safe failure code
and move to 1 minute, 5 minute, 30 minute and 2 hour backoff. Every result write
requires the current lease token. Expired leases are reclaimable and visible as
stale in protected system health.

Tokens appear only in the protected device row and the outbound provider body.
They are never returned, logged, exported, shown in admin, placed in notification
payload data, or stored in idempotency response bodies. Provider messages and
raw ticket payloads are parsed in memory and discarded. Notification content is
allow-listed and carries a stable delivery ID for consumer dedupe.

## External release gates

Repository fakes prove no deployed delivery. Before any environment enables
remote push, an authorized release owner must provide and verify:

1. final EAS owner/project linkage and store identifiers;
2. worker-only Expo access-token injection with API/runtime separation;
3. physical iOS and Android tests for request/deny/settings recovery,
   provisional iOS behavior, foreground/background/terminated delivery, token
   rotation, five-device eviction, logout and account deletion;
4. authorized staging tests for partial tickets, invalid tokens, provider
   timeout, ambiguous acceptance, lease expiry/takeover, backoff, exhaustion,
   duplicate suppression and protected health/alert ownership.

Do not send a test notification from a developer or CI environment, probe the
provider from health checks, or describe `configured` as delivered. Provider
acceptance is at-least-once and an ambiguous timeout can result in a duplicate
generic notification with the same stable ID.

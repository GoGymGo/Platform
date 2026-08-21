# Public feedback and conversion measurement

This runbook governs the landing-owned `public_site_feedback` and
`public_site_events` D1 tables. Repository completion does not authorize a
Sites deployment, D1 migration, hosted configuration change, export, retention
deletion, or production enablement. GGG-027 separately owns the historical
interest-submission export and PostgreSQL cutover.

## Minimized public writes

- `POST /api/public-site-feedback` accepts same-origin UTF-8 JSON only, reads at
  most 12,000 bytes, rejects unknown keys and over-length values, and stores a
  category, fixed public-page value, 20-2,000 character message, optional email,
  explicit contact permission, submission UUID, and timestamps. The UUID is
  created for one submit attempt and reused only for retries; `INSERT OR IGNORE`
  makes a lost-response replay safe without creating a visitor identity.
- `POST /api/public-site-events` accepts same-origin UTF-8 JSON only, reads at
  most 256 bytes, and accepts exactly one `eventName` field. The browser sends no
  page, properties, query, fragment, referrer, cookie, member value, IP address,
  user agent, or device value. The server maps each allowed name to one fixed
  GGG-025 action path before writing it.
- Both routes omit credentials and referrers in client requests, return no CORS
  permission, fail closed when D1 or retention configuration is unavailable,
  and never place submitted values in logs, errors, or receipts. Measurement is
  best-effort and its promise is isolated from navigation.
- The honeypot is quietly accepted without a write. D1 minute buckets limit the
  whole endpoint to 20 feedback attempts or 240 event attempts per minute. A
  bucket contains only its route/minute key and aggregate count—never a visitor
  key. This is a repository fallback, not a substitute for reviewed hosted
  abuse controls.

## Retention policy

Writes and owner exports remain unavailable until both exact positive integers
are configured:

| Variable | Allowed bound | Stored data |
| --- | ---: | --- |
| `PUBLIC_SITE_FEEDBACK_RETENTION_DAYS` | 30-180 days | Feedback and optional contact email |
| `PUBLIC_SITE_EVENT_RETENTION_DAYS` | 7-90 days | Anonymous allowlisted events |

Each accepted write deletes at most 100 expired records from its own table and
at most 100 expired aggregate rate buckets. Export queries also exclude rows
older than the configured cutoff even if a cleanup backlog exists. Rate buckets
expire after one day. Privacy-safe operations audit rows are retained for 365
days.

Because traffic-triggered cleanup cannot prove timely deletion when traffic is
idle, production remains blocked until the owner approves a retention policy
and an authorized hosted procedure repeatedly runs the bounded retention route
until `has_more` is false. No schedule or provider setting is created by this
repository change.

## Owner authorization and export

Feedback and event exports return `404` unless all of these are complete:

- `LANDING_D1_EXPORT_ENABLED=yes`;
- `LANDING_D1_EXPORT_OWNER_EMAIL` is one valid exact owner email;
- `LANDING_D1_EXPORT_OWNER_USER_ID` is the corresponding exact Sites user ID;
- both retention values above are valid.

The route requires both platform-authenticated headers. SHA-256 digests of the
normalized supplied and configured values are compared with the Workers
constant-time primitive. There is no landing-owned account or role system.

- `/api/internal/export-public-site-feedback?limit=50` returns at most 100
  minimized feedback rows and an opaque `next_cursor`; an email is emitted only
  when its stored contact consent is exact. Continue with the exact cursor until
  it is `null`.
- `/api/internal/export-public-site-events?limit=50` returns daily aggregate
  counts by allowlisted event and fixed action path. It never returns raw event
  IDs or timestamps, and excludes retired historical event names.
- Unknown, duplicate, malformed, or out-of-range query parameters are rejected.
  Export filenames are fixed, responses are attachment-only JSON with
  `no-store`, `nosniff`, `noindex`, and `default-src 'none'` headers, and every
  successful page writes a count-only operations audit row.

Owner export credentials and a hosted owner-denial/export rehearsal remain
external blockers. Disable `LANDING_D1_EXPORT_ENABLED` immediately after an
approved export and confirm both routes return `404` again. Preserve any export
outside Git according to the private release-artifact policy; never print row
contents into release logs.

## Bounded deletion operation

`POST /api/internal/run-public-site-retention` returns `404` unless
`LANDING_D1_RETENTION_ENABLED=yes`, both exact owner values, and both retention
values are configured. It additionally requires same-origin UTF-8 JSON and the
same two platform-authenticated owner headers. The only request shape is:

```json
{ "kind": "feedback", "limit": 500 }
```

`kind` is exactly `feedback`, `events`, or `audit`; `limit` is 1-500. The route
deletes oldest expired rows only, returns count-only `deleted` and `has_more`
evidence, and records a count-only audit action. Run one kind serially until
`has_more` is false, preserve the count-only evidence, then disable the route
and verify it returns `404`. If D1 is missing, the migration is absent, the
query result is malformed, authorization is not exact, or an audit write fails,
the operation fails without exposing row or configuration values.

## Migration, validation, and recovery

Forward-only migration `0003_spooky_whiplash.sql` adds the aggregate rate table,
count-only operations audit, their cleanup indexes, and the feedback
`created_at` index used by bounded retention. It does not rewrite existing
feedback/events or touch interest submissions.

Before any hosted rollout, an authorized release owner must apply and inspect
the migration, verify the exact D1 binding, approve the retention values and
hosted abuse controls, rehearse owner allow/deny and pagination against non-real
data, run each retention kind to completion, and complete hosted accessibility,
navigation, error, header, and cache UAT. None of that cloud evidence exists in
this repository task.

If application behavior must be recovered, keep the forward migration, disable
both owner-operation flags, and restore the prior application version. Invalid
or absent retention values already stop new feedback/event writes and exports.
Do not drop tables, bulk-delete data, remove the D1 binding, or start a
PostgreSQL cutover during incident response; those actions require the separate
GGG-027/release authority and preserved count evidence.

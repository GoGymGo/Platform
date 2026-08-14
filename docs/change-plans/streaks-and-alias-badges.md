# Streaks and Alias badges

## Outcome

Make every own and shared streak a single `streaks-v1` server projection over
eligible verified workout dates, then render that projection consistently beside
every visible Alias with no more than two compact badges. Missing or failed
server data must remain unavailable instead of becoming a fabricated zero.

## Boundaries

- PostgreSQL remains the source of verified workout dates and enforces the exact
  session, enrollment, Contest, gym, rules-version, and regional calendar-day
  identity contract.
- The API filters to completed verified sessions from active member accounts and
  active historical participation, excludes future dates, calculates all four
  calendar streak dimensions in SQL, and returns at most one summary per member.
- Public consumers receive only the versioned counts when the profile permits
  public statistics. Alias/contact/location/workout detail is selected by the
  owning leaderboard, social, Weekly Challenge, or results workflow.
- The member app formats the canonical compact decomposition and may use isolated,
  visibly labeled App Tour fixtures. Production screens never calculate or cache
  an authoritative streak.
- Friend/block behavior remains GGG-009, Weekly Challenge behavior GGG-010,
  Challenge behavior GGG-011, and final result publication GGG-016.

## Rollout

1. Publish API and generated contracts from the same immutable head.
2. Publish the member artifact only after its runtime projection parser and
   Alias-surface audit pass against `streaks-v1`.
3. No migration or worker rollout is required; the existing partial verified-day
   index and scoring-integrity constraints remain authoritative.
4. In staging, compare own and permitted public summaries for a member with a
   current region, an expired region using the latest-session fallback, hidden
   public stats, zero history, and a verified workout on a DST boundary.

## Validation

- Unit tests cover zero, gaps, grace periods, duplicates, future dates, Monday
  weeks, year boundaries, compact decomposition, version parsing, and 100-subject
  query batching.
- Migrated PostGIS coverage exercises an operator-verified workout, timezone
  fallback, own visibility, and public `showStats` privacy.
- Member tests lock every production Alias surface to `UserAlias`, assert the
  two-badge cap, and prove App Tour fixtures use the production projection shape.
- OpenAPI generation, contract/source audits, critical journeys, repository
  checks, and production-artifact builds run on the exact pull-request head.

## Recovery

If member rendering regresses, roll back the member artifact; the API projection
is read-only and does not alter workout history. If the API query regresses, roll
back the API artifact while retaining the existing verified-day index and scoring
constraints. Do not copy streak counts into client storage or repair them with
direct database writes. Investigate the underlying verified session or profile
privacy record, then rerun the read after the authoritative record is corrected.

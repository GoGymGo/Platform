# Friends, blocks, and private invitation links

## Outcome

Deliver one public Alias and a complete consent-based friendship lifecycle,
immediate bilateral block privacy, and masked expiring single-use private links
that survive authentication without automatic acceptance or a false delivery
claim.

## Boundaries

- Firebase remains the authentication authority; PostgreSQL owns Alias,
  relationship, block, Challenge membership, invitation, and audit state.
- Member, API, migration, privacy, worker, generated contract, and operational
  documentation change together. Weekly Challenge scoring and general Challenge
  product behavior remain independently owned.
- There is no approved email/SMS provider. This feature creates and locally
  shares a link only and performs no cloud inspection, mutation, or deployment.

## Rollout

1. Apply the additive integrity migration before the worker or API revision.
2. Start the worker and verify invitation expiry/purge counters without contact
   or token attributes.
3. Start the API and verify authenticated Alias search, request transitions,
   blocks, masked inspection, explicit redemption, and generic mismatch errors.
4. Publish the member artifact from the same contract head and smoke-test token
   recovery through sign-in, sign-up, password reset, and email verification.

## Validation

Unit coverage owns Alias policy, destination normalization/masking/binding,
repository retry keys, unavailable states, and auth continuation. Migrated
PostGIS coverage owns uniqueness, ownership, crossed-request concurrency,
database block guards, transactional cleanup, link rotation, mismatch,
single-use/replay, privacy export, and erasure. Final checks also regenerate and
audit OpenAPI, run critical journeys, demo/production isolation, dependency and
governance gates, build artifacts, and inspect the exact staged diff.

## Recovery

Keep the additive schema in place and roll back application traffic only if the
previous revision remains compatible. Do not weaken block triggers, re-expose a
hidden user, recover a raw destination/token from storage, or use a production
down migration. Fix forward if relationship integrity or link secrecy is in
doubt; an invitation can be safely replaced because retry rotation invalidates
the previous opaque link.

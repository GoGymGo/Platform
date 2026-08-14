# GGG-015 brand rewards

## Outcome

GoGymGo publishes only approved, region- and competition-scoped sponsor rewards
with truthful bounded availability. PostgreSQL owns catalog, coupon inventory,
award, claim, and fulfillment state. Coupon codes remain encrypted and can be
revealed only by an authenticated winner's idempotent claim. Authorized
operators configure and fulfill rewards through reasoned, versioned,
idempotent transitions without changing immutable award or claim history.

## Boundaries

This change coordinates the API and PostgreSQL boundary, generated contracts,
the member reward catalog and claim screens, and the existing admin reward
controls. Those three runtime owners must move together because the stricter
server contract adds availability, version, and lifecycle fields consumed by
both clients. The change does not settle or publish draws, configure pilot cash
awards, approve sponsor inventory or terms, provision encryption keys, contact
cloud services, or deploy any environment.

## Rollout

1. Review and merge the API migration, generated contract, member client, and
   admin client from the same green commit.
2. Before a release, configure the exact 32-byte reward-code encryption key in
   the secret-bearing runtime and apply the migration through the authorized
   deployment process. Missing or malformed key configuration remains fail
   closed for coupon operations.
3. Load only approved sponsor assets, HTTPS terms, inventory, availability, and
   normalized coupon codes. Publish a reward only after the admin readiness
   checks and database constraints accept the complete configuration.
4. Perform separately authorized staging UAT for catalog visibility, winner and
   non-winner claims, retry after a lost response, and operator fulfillment
   before production promotion.

## Validation

- API unit and non-database endpoint tests cover validation, authorization,
  lifecycle transitions, strict key parsing, and confidentiality contracts.
- Serial PostgreSQL integration tests cover publication prerequisites,
  inventory bounds, encrypted coupon storage, concurrent owner-only claims,
  idempotency, optimistic versions, audit redaction, and immutable history.
- Member tests cover exact runtime decoding, honest empty/error/retry states,
  region-timezone availability, owner-scoped awards, and stable claim retries.
- Admin tests cover publish readiness, safe award projections, and reasoned,
  versioned fulfillment actions.
- Generated-contract, source, production-artifact, governance, dependency,
  critical-journey, full-root, and exact-head CI gates validate the coordinated
  release.

## Recovery

If reward behavior regresses before any award is allocated, archive affected
catalog items through the audited admin action and roll the API, member, and
admin artifacts back together. After awards or claims exist, do not delete,
rewrite, or decrypt history and do not remove the encryption key; archive the
catalog, pause further award allocation, preserve audit and idempotency rows,
and ship a forward fix. A migration rollback is allowed only when the new
tables contain no reward lifecycle data and the authorized release operator has
verified that precondition. Sponsor fulfillment issues are handled through the
bounded audited status controls rather than ad hoc database changes.

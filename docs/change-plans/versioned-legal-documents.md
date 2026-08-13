# Versioned legal documents and consent receipts

## Outcome

Make every legal surface use the same owner-approved, server-authoritative
publication and ensure a member can accept only the exact required document
bundle that is displayed. Preserve immutable document and receipt evidence,
including a new acceptance context after an explicit onboarding reset.

## Boundaries

The member app owns honest document loading, retry, exact action/version display,
and receipt submission. The API owns publication authorization, immutable
document history, current-bundle resolution, and transactional receipt
persistence. Admin owns the operator presentation of the API policy and no
longer offers an impossible destructive delete. Landing already links to the
connected member legal routes and needs no runtime change. Generated contracts
are refreshed from the API, and documentation describes the coordinated
operational boundary. No runtime imports cross ownership boundaries.

## Rollout

Apply the forward-only receipt-context migration before running the new API
image. Deploy the API and member/admin artifacts from the same reviewed commit.
Do not publish legal text through this change: the configured owner must still
approve the exact content separately, and an unavailable or unapproved bundle
continues to fail closed. Rehearse publication, receipt, withdrawal, reset, and
re-acceptance against staging before enabling enrollment.

## Validation

Run direct member legal-domain and source-audit tests, admin rendering tests,
API unit/e2e and migrated PostgreSQL legal workflow tests, OpenAPI regeneration,
production artifact audits, critical journeys, dependency audit, governance,
and the complete repository check. Required GitHub checks must pass on the
exact reviewed head before merge.

## Recovery

If the client or admin presentation regresses, revert those artifacts while the
API continues to fail closed and preserve evidence. The database migration adds
only an immutable acceptance-context discriminator and can coexist with the
prior API during a rolling rollout because it supplies a non-null default. Do
not delete or rewrite document or receipt history during recovery. Withdraw an
incorrectly published legal version through the audited owner-only endpoint so
resolution returns to the previous publication. A code rollback must never
restore bundled-copy fallback as authoritative or bypass owner approval.

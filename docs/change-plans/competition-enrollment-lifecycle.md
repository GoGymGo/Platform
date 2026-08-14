# Competition enrollment and lifecycle integrity

## Outcome

Make Contest discovery, enrollment, immutable Weekly Goal, entrant counts,
withdrawal, publication, and scheduled start/cancellation agree on one
server-authoritative competition and remain correct under retries and concurrent
requests.

## Boundaries

- The member app owns honest loading/error/retry states, stable enrollment and
  withdrawal operation identities, exact-contest count reads, and presentation
  of the server-authoritative Contest status.
- The API owns identity-derived enrollment, exact legal/region/gym evidence,
  capacity serialization, withdrawal cleanup/audit, and exact-contest public
  counts.
- PostgreSQL owns immutable enrollment facts, terminal status transitions, and
  one enrollment per user and competition.
- The admin/API publication path owns current schedule, approved legal,
  published reward, supported QR policy, assigned gym, and active
  contest-specific poster prerequisites.
- The worker owns locked, retry-safe activation or cancellation and uses the
  same participation cleanup semantics as operator cancellation.
- Partner-gym QR issuance remains GGG-005, workout execution remains GGG-006,
  scoring remains GGG-007, and Weekly Challenge behavior remains GGG-010. This
  change only consumes or closes those dependencies at the enrollment boundary.

## Rollout

1. Apply the forward-only enrollment-integrity migration before starting the
   updated API or worker.
2. Deploy API and worker from the same immutable artifact so both use the same
   cancellation cleanup and publication policy.
3. Publish the member/admin artifacts only after their generated API contract
   matches that artifact.
4. Do not publish a Contest until current approved legal documents, a published
   reward, an active assigned gym, and an active contest-specific QR poster are
   visible to the authoritative publication transaction.

## Validation

- Unit coverage proves schedule/status and publication prerequisites, stable
  operation keys, exact API routes, and honest member state derivation.
- Database integration coverage proves entrant-cap serialization, exact-contest
  counts, immutable goals/evidence, irreversible withdrawal, dependent cleanup,
  audit evidence, notification failure rollback, and idempotent lifecycle retry.
- Member and admin journey checks, OpenAPI generation, migration replay, source
  audits, production-artifact audits, governance, dependency audit, and the full
  repository check must pass.

## Recovery

If the client presentation regresses, revert only the client artifacts while
the API continues to fail closed. If API or worker rollout fails, roll back both
to the prior shared artifact; the new database trigger is compatible with the
existing supported status transitions and can remain applied. Do not delete or
rewrite enrollment, audit, ledger, legal, or notification history. Correct an
invalid Contest through the existing versioned cancellation workflow.

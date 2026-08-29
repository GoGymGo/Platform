# Direct Weekly Challenges

## Outcome

Give every authenticated, actively enrolled member one eligible same-goal
Weekly Match for each active seven-day scoring week. Enrollment places the
member into the server-owned queue and pairs them with the earliest eligible,
unblocked entrant. An accepted direct challenge can still establish a friend
match with explicit request provenance. The member sees only the approved Alias
and aggregate streak/progress fields, while settlement produces authoritative
0x, 1x, 2x, or 3x ledger entries and labels every earlier value as projected
rather than banked.

## Boundaries

- PostgreSQL owns request transitions, accepted-request match provenance,
  cross-role participant uniqueness, permanent one-assignment-per-week
  history, and transactional closure state.
- The API owns Firebase-derived identity, exact Contest/region/week/goal/time
  validation, friendship and block precedence, ownership, idempotency, and the
  privacy-safe response projection. Member-supplied identity and time are not
  authoritative.
- Enrollment and match reads own advisory-locked, retry-safe automatic queue
  synchronization. The scoring/lifecycle worker owns solo-row creation at
  settlement, canonical eligible-session evaluation, ledger reconciliation,
  and retry-safe closure.
- The member app derives display state only from API responses. App Tour data
  remains isolated preview data and cannot satisfy a production command.
- Operators configure Contest scoring rules and observe/finalize settlement;
  they do not choose partners. No cloud environment is inspected or changed by
  this repository delivery.

## Rollout

1. Apply `1787187600000_direct_weekly_challenges.ts` before the new API or
   worker. It removes unsettled unconsented legacy pairings, deletes synthetic
   searching placeholders, records accepted-request provenance, and installs
   normalized participant constraints and synchronization triggers.
2. Apply `1788397200000_automatic_weekly_matching.ts` to admit server-created
   same-goal automatic pairs while retaining all direct-request provenance,
   friendship, block, enrollment, period, and one-assignment constraints.
3. Deploy the API and scoring/lifecycle worker from the same immutable artifact.
   Confirm request create/respond/cancel and match reads use the regenerated
   OpenAPI contract.
4. Publish the member artifact from that same contract head. Verify searching,
   incoming, outgoing, accepted, solo, projected, settled, error, and retry
   states with two enrolled accepted-friend accounts.
5. Before enabling a production Contest, complete the external release gate:
   rehearse four scoring weeks with two staging accounts, including one solo
   week, one 2x week, one eligible-extra-workout 3x week, one 0x week,
   relationship closure, settlement retry, and ledger reconciliation. Retain
   exact release, request, match, ledger, and settlement evidence.

## Validation

- Unit coverage proves 0x/1x/2x/3x rules, the required extra workout for 3x,
  provisional-versus-banked presentation, strict runtime response validation,
  and stable retry keys.
- Migrated PostgreSQL coverage proves advisory-locked earliest-waiting automatic
  matching at enrollment/read, accepted-request provenance for direct matches,
  exact week dates, same-goal and unblocked eligibility, cross-role uniqueness,
  permanent one assignment, concurrent acceptance, conflict cancellation,
  relationship, block, withdrawal and Contest cancellation, solo settlement,
  idempotent reconciliation, and privacy-safe response fields.
- Generated OpenAPI/contracts, member source and App Tour audits, API artifact
  audits, critical journeys, database journeys, governance, dependency, lint,
  type, coverage, build, and exact-head CI checks must pass before merge.

## Recovery

Do not bypass eligibility, block checks, direct-request provenance, or permanent
one-assignment history; do not rewrite settled ledger history or represent
projections as banked entries. If the member artifact regresses, roll it back
while retaining the authoritative API response. If API or worker rollout fails,
roll both back to the preceding compatible release and keep the additive
integrity schema in place. A failed request/settlement is retried with the same
idempotency key; materialized progress is rebuilt from the append-only ledger.
Treat constraint or provenance failures as forward-fix incidents. A production
down migration is not a recovery procedure.

# Critical product journey coverage

Status: required merge coverage, August 2026

Critical journeys are tested as connected outcomes in addition to their unit
tests. The member test drives the production repositories with one stateful API
boundary; the API tests use a migrated ephemeral Postgres instance; the admin
test composes the actual publish-readiness and regional timing rules.

| Journey                  | Member contract                                                                                 | Authoritative API                                                                                                                                                                                   | Operator contract                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Registration and sign-in | Valid sign-up/sign-in inputs are normalized before the authenticated journey begins             | Verified email is required before enrollment; the same Firebase principal restores one profile                                                                                                      | Operator routes require an authenticated role                                                                   |
| Account setup            | Legal receipt, region verification and contest selection run in order                           | Legal receipt and region evidence are durable and fail closed                                                                                                                                       | Region validity and contest schedule must cover the release                                                     |
| Gym enrollment and QR    | QR resolution supplies the exact contest and enrollment submits fresh gym presence              | Poster credentials are contest-specific, location-bound and replay-safe                                                                                                                             | A draft cannot publish without an active assigned gym and its contest poster                                    |
| Workout completion       | Session creation, evidence, completion and progress use authenticated, idempotent contracts     | Evidence is accepted once and a verified day is awarded once                                                                                                                                        | Start and completion cutoffs are derived from the configured regional instant                                   |
| Results and rewards      | Runtime-validated pending/settled results, awards and claims remain one connected response path | Final scoring locks immutable entrants/identity/reward slots, deterministic settlement creates bounded awards, snapshot-backed results remain stable, and a repeated claim returns the same outcome | The worker atomically locks, validates, settles, and publishes due results; the admin shows status and immutable evidence without a manual winner-publication control |
| Admin configuration      | Member behavior consumes only server-published policy                                           | Configuration validation rejects invalid rules, schedules and authorization                                                                                                                         | Draft prerequisites become publishable once, then cannot be republished                                         |

Run the fast client/operator journeys with `npm run test:journeys`. Run the
database-backed region, enrollment, QR, workout, result and reward journeys
with `npm run test:journeys:integration`; Docker is required for its ephemeral
Postgres container. The normal API CI runs the same database integration files
with `RUN_DATABASE_INTEGRATION=true`.

Firebase's hosted identity provider is not called from CI. Its network and
provider availability remain an environment smoke test, while repository CI
owns form validation, email normalization, bearer-token enforcement, verified
email policy and stable profile identity.

# Critical journey contract coverage

## Outcome

Prevent feature changes from breaking the connected path from account entry
through setup, gym verification, workout completion, results and reward claim.

## Boundaries

The member app adds a stateful client-contract test, the API extends its real
database workflow, and admin composes its existing configuration rules. No
runtime imports cross owner boundaries and no production behavior changes.

## Rollout

Land the tests and explicit journey commands together. Existing workspace CI
discovers each test automatically; API CI continues to supply the ephemeral
Postgres environment for authoritative integration scenarios.

## Validation

Run member typecheck and tests, the admin production build and tests, API type
and lint, fast journey commands, and the database-backed journey command before
merge. Required GitHub checks must pass on the exact reviewed head.

## Recovery

If a composed test is unstable, revert this test-only pull request while
retaining the existing granular suites. Do not weaken production validation or
skip the underlying database integration gate to make the journey pass.

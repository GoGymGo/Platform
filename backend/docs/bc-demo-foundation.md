# British Columbia demo foundation

## Current state

The BC demo foundation is a local non-cash product test, not a prize
competition. The bootstrap creates:

- one `CA-BC-DEMO` region policy for British Columbia, Canada;
- one month-specific `non_cash_demo` competition in `registration` status;
- seven weekly-goal brackets; and
- append-only audit events for the created region and demo competition.

The region has `competition_enabled=false` and `payout_enabled=false`. Its
boundary is intentionally null because no production-quality BC eligibility
boundary has been approved. The bootstrap accepts only a localhost database,
refuses production, requires explicit confirmation and an audit reason, and
fails if existing records are no longer in the expected disabled state.

The Expo client treats British Columbia as the only demo region. It can:

- read and update the authenticated public identity through `/v1/me`;
- list the disabled BC policy through `/v1/regions`;
- submit minimized postal or foreground-location evidence through
  `/v1/me/region-verifications`; and
- read the current server review status;
- let an authorized operator approve or reject pending BC submissions; and
- create one zero-value demo enrollment after approval.

The client cannot approve its own region. Demo enrollment requires a verified
email, an approved current BC review, an explicit rules acceptance and an age
attestation. It does not create an account legal-receipt bundle.

## Deliberately blocked

Database constraints and triggers force all demo entry, score, prize, winner
and payout values to zero and reject entry-ledger, competition-progress and
draw records. Competition workout sessions are also rejected for this mode;
the separate short-lived demo check-in remains non-eligible.

The following remain blocked:

- publication of counsel-approved BC account terms, privacy notices and
  any future cash competition rules;
- cash competition publication or registration;
- prize-draw entry creation, winner selection or payout-claim creation;
- Hyperwallet payee creation, hosted portal access or payment release; and
- any collection of bank, tax or identity-document data by GoGymGo.

## Local bootstrap

From `backend`:

```powershell
$env:CONFIRM_BC_DEMO_BOOTSTRAP='yes'
$env:BC_DEMO_BOOTSTRAP_REASON='Create the local BC backend foundation for development.'
$env:BC_DEMO_COMPETITION_MONTH='2026-08'
npm.cmd run bootstrap:bc-demo
Remove-Item Env:CONFIRM_BC_DEMO_BOOTSTRAP
Remove-Item Env:BC_DEMO_BOOTSTRAP_REASON
Remove-Item Env:BC_DEMO_COMPETITION_MONTH
```

Re-running the command must report `regionCreated=false`,
`competitionCreated=false` and `competitionUpdated=false`. An existing
bootstrap-owned legacy disabled draft is upgraded once to the guarded
non-cash mode.

## Least-privilege demo operator

After the Firebase account has a verified email and has signed in once, assign
only the local BC review role:

```powershell
$env:CONFIRM_BC_DEMO_OPERATOR_BOOTSTRAP='yes'
$env:BC_DEMO_OPERATOR_FIREBASE_UID='<firebase uid>'
$env:BC_DEMO_OPERATOR_REASON='Authorize this account to review local BC demo submissions.'
npm.cmd run bootstrap:bc-demo-operator
Remove-Item Env:CONFIRM_BC_DEMO_OPERATOR_BOOTSTRAP
Remove-Item Env:BC_DEMO_OPERATOR_FIREBASE_UID
Remove-Item Env:BC_DEMO_OPERATOR_REASON
```

The command is localhost-only, requires the disabled BC foundation to remain
unchanged, and accepts only an active database account with a verified email.
It normalizes the account to `user` plus `operator`, removing a temporary local
`admin` grant, and records `user.bc_demo_operator_bootstrapped` in the
append-only operator audit ledger. It never grants payout or Hyperwallet roles.

## Required work before any cash launch

1. Obtain legal review for BC eligibility, contest structure, age requirements,
   official rules, privacy language and required account receipts. Publish the
   reviewed versions through the existing append-only legal-document system.
2. Create a separate production BC region-policy version with an approved
   boundary. Enabling competition or payout flags must be a later audited
   operator decision, never part of the demo bootstrap.
3. Configure and test Hyperwallet UAT only after an actual payout program and
   legal/compliance approval exist. Production credentials and payment release
   remain separate launch gates.

## Verification

Run:

```powershell
cd backend
$env:RUN_DATABASE_INTEGRATION='true'
npm.cmd exec jest -- --config ./test/jest-integration.json --runInBand test/bc-demo-foundation.integration-spec.ts
npm.cmd run check

cd ../mobile-app
npm.cmd run check
```

The database integration test proves repeat safety, operator-reviewed demo
enrollment, nullable legal-receipt linkage, zero entry-ledger/progress/draw
rows, zero payout claims/payments, a blocked demo workout session and trigger
rejection of direct financial-state writes. It also proves that the bootstrap
fails closed if payout activation is changed.

# British Columbia demo foundation

## Current state

The localhost-only bootstrap creates a development foundation for the regional
brand rewards experience:

- a disabled `CA-BC-DEMO` region policy;
- a month-specific competition in `registration` status;
- seven weekly-goal brackets;
- a published physical reward with sponsor fulfillment instructions; and
- append-only operator audit events.

The region remains `competition_enabled=false` and has no geographic boundary,
because production BC eligibility has not been approved. The bootstrap rejects
remote/production databases, requires explicit confirmation and an audit reason,
and fails if its existing records have been activated or changed unexpectedly.

The client can review the regional marketplace, submit minimized location
evidence, read review status, and create an enrollment only after an authorized
operator approves the review. A verified email, rules acceptance, and age
attestation remain mandatory.

## Local bootstrap

From `backend`:

```powershell
$env:CONFIRM_BC_DEMO_BOOTSTRAP='yes'
$env:BC_DEMO_BOOTSTRAP_REASON='Create the local BC rewards foundation.'
$env:BC_DEMO_COMPETITION_MONTH='2026-08'
npm.cmd run bootstrap:bc-demo
Remove-Item Env:CONFIRM_BC_DEMO_BOOTSTRAP
Remove-Item Env:BC_DEMO_BOOTSTRAP_REASON
Remove-Item Env:BC_DEMO_COMPETITION_MONTH
```

Re-running is safe and reuses the same bootstrap-owned records.

## Least-privilege operator

After a Firebase account with a verified email has signed in:

```powershell
$env:CONFIRM_BC_DEMO_OPERATOR_BOOTSTRAP='yes'
$env:BC_DEMO_OPERATOR_FIREBASE_UID='<firebase uid>'
$env:BC_DEMO_OPERATOR_REASON='Authorize this account to review local BC submissions.'
npm.cmd run bootstrap:bc-demo-operator
Remove-Item Env:CONFIRM_BC_DEMO_OPERATOR_BOOTSTRAP
Remove-Item Env:BC_DEMO_OPERATOR_FIREBASE_UID
Remove-Item Env:BC_DEMO_OPERATOR_REASON
```

The command normalizes the account to `user` plus `operator` and records the
change in the append-only audit ledger.

## Production gates

Before enabling a real BC contest, approve its geographic boundary, official
rules, privacy/age terms, sponsor inventory, image and trademark rights,
fulfillment ownership, redemption/expiry language, substitution policy, and
support process. Publish the reviewed legal versions through the append-only
legal document system and load sufficient catalog inventory before contest
publication.

## Verification

```powershell
cd backend
$env:RUN_DATABASE_INTEGRATION='true'
npm.cmd exec jest -- --config ./test/jest-integration.json --runInBand test/bc-demo-foundation.integration-spec.ts
npm.cmd run check

cd ../mobile-app
npm.cmd run check
```

The integration test proves bootstrap repeat safety, reward catalog creation,
operator-reviewed enrollment, and physical absence of legacy financial tables.

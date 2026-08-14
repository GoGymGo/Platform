# September 2026 connected QR pilot

## Fixed configuration

- Region: Vancouver Island + Gulf Islands
- Reviewed region artifact SHA-256: `5615d3c177fb10bed32ee4e6f72ff51e7ea62ac2c490c7cb86cc80778eec6e34`
- Time zone: `America/Vancouver`
- Competition: September 1, 2026 00:00 through October 1, 2026 00:00
- Verification: approved static gym QR, live location, 75 m radius
- Minimum session: 30 minutes using server time
- Completion period: 15 minutes after the competition ends for workouts started in time
- Session expiry: the earlier of four hours or the completion-period deadline
- Minimum entrants: one
- Reward: one $100 CAD cash reward sponsored by GoGymGo
- Daily limit: one verified competition day per local calendar date

Run the idempotent configuration command only against the intended environment:

```powershell
$env:DATABASE_URL='<secret-managed target connection>'
$env:APPLY_PILOT_CONFIGURATION='yes'
$env:CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256='<owner- and counsel-approved exact digest>'
npm.cmd run configure:september-2026-island-pilot --workspace @gogymgo/api
```

The command refuses to publish the public legal bundle unless the approval
digest matches the exact committed content. Run it once without the value to
obtain the expected digest, complete owner and counsel review, then rerun with
that exact value. Never copy the digest forward after legal content changes.

## Staging order

1. Apply all migrations and deploy the same image digest to the API and worker.
2. Reconcile the exact committed regional boundary digest and representative
   points using `docs/operations/region-eligibility.md`, then configure it only
   after the separate geography approval gate.
3. Have the configured GoGymGo owner verify email and sign in once, then run
   the audited administrator bootstrap.
4. Create the real condo gym with its verified name, street address and measured
   coordinates; keep the radius at 75 m.
5. Assign the gym to the September competition, issue the poster and print it.
6. Run the protected pilot configuration to publish the owner-approved Privacy,
   Terms and Official Contest Rules version. Unapproved versions are never served.
7. Reset testing-era onboarding with the explicit reset command.
8. Use one real account to complete email, location, legal, age, goal and join.
9. At the condo, complete one 30-minute workout with start and finish location
   checks, verify finishing during the 15-minute completion period still counts,
   and verify a missing-finish test earns no credit.
10. Rehearse draw settlement and the audited $100 cash handoff record.
11. Only after the legal, gym, reward and UAT gates pass, rerun the command with
    `PUBLISH_PILOT_COMPETITION=yes` to open registration.

## Production gate

Do not publish until CI, dependency audit, staging UAT, billing, domains, legal
approval, gym setup, reward publication and administrator bootstrap all pass.
Create `v0.1.0-beta.1` only after production UAT succeeds.

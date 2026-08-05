# September 2026 connected QR pilot

## Fixed configuration

- Region: Vancouver Island + Gulf Islands
- Time zone: `America/Vancouver`
- Competition: September 1, 2026 00:00 through October 1, 2026 00:00
- Verification: approved static gym QR, live location, 75 m radius
- Minimum session: 30 minutes using server time
- Session expiry: four hours
- Minimum entrants: two
- Reward: one $100 CAD cash reward sponsored by GoGymGo
- Daily limit: one verified competition day per local calendar date

Run the idempotent configuration command only against the intended environment:

```powershell
$env:DATABASE_URL='<secret-managed target connection>'
$env:APPLY_PILOT_CONFIGURATION='yes'
npm.cmd run configure:september-2026-island-pilot --workspace @gogymgo/api
```

## Staging order

1. Apply all migrations and deploy the same image digest to the API and worker.
2. Configure the production-shaped regional boundary.
3. Have `s1ck5ense123@gmail.com` verify email and sign in once, then run the
   audited administrator bootstrap.
4. Create the real condo gym with its verified name, street address and measured
   coordinates; keep the radius at 75 m.
5. Assign the gym to the September competition, issue the poster and print it.
6. Draft Privacy, Terms and official contest rules in admin. The owner must check
   the exact-version approval control; unapproved documents are never served.
7. Reset testing-era onboarding with the explicit reset command.
8. Use two real accounts to complete email, location, legal, age, goal and join.
9. At the condo, complete one 30-minute entry/exit scan and verify a missing-exit
   test earns no credit.
10. Rehearse draw settlement and the audited $100 cash handoff record.
11. Only after the legal, gym, reward and UAT gates pass, rerun the command with
    `PUBLISH_PILOT_COMPETITION=yes` to open registration.

## Production gate

Do not publish until CI, dependency audit, staging UAT, billing, domains, legal
approval, gym setup, reward publication and administrator bootstrap all pass.
Create `v0.1.0-beta.1` only after production UAT succeeds.

# September 2026 connected QR pilot

## Fixed configuration

- Region: Vancouver Island + Gulf Islands
- Reviewed region artifact canonical LF repository-byte SHA-256: `5d341887130e81061ec23689ead15aee0c3433d481b90092a143f70a25409aa7`
- Time zone: `America/Vancouver`
- Competition: September 1, 2026 00:00 through October 1, 2026 00:00
- Verification: approved static gym QR, live location, 75 m radius
- Minimum session: 30 minutes using server time
- Completion period: 15 minutes after the competition ends for workouts started in time
- Session expiry: the earlier of four hours or the completion-period deadline
- Minimum entrants: one
- Reward: exactly one $100 CAD cash reward sponsored by GoGymGo, 10,000 cents
  CAD, inventory one and settled slot one
- Daily limit: one verified competition day per local calendar date

Run the idempotent configuration command only against the intended environment:

```powershell
$env:DATABASE_URL='<secret-managed target connection>'
$env:APPLY_PILOT_CONFIGURATION='yes'
$env:CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256='<owner- and counsel-approved exact digest>'
$env:PILOT_REWARD_IMAGE_URL='<approved public HTTPS image URL>'
$env:PILOT_REWARD_TERMS_URL='<approved public HTTPS reward terms URL>'
$env:CONFIRM_PILOT_REWARD_APPROVAL_SHA256='<owner-approved exact reward digest>'
npm.cmd run configure:september-2026-island-pilot --workspace @gogymgo/api
```

The command refuses to publish the public legal bundle unless the approval
digest matches the exact committed content. Run it once without the value to
obtain the expected digest, complete owner and counsel review, then rerun with
that exact value. Never copy the digest forward after legal content changes.
The reward has its own printed digest bound to sponsor, title, type, 10,000-cent
CAD value, inventory, manual instructions, image and terms. The command also
refuses placeholder URLs, a claim/provider URL, a second published reward or a
digest mismatch. No real approval value belongs in source control.

## Staging order

1. Apply all migrations and deploy the same image digest to the API and worker.
2. Reconcile the exact committed regional boundary digest and representative
   points using `docs/operations/region-eligibility.md`, then configure it only
   after the separate geography approval gate.
3. Have the configured GoGymGo owner verify email and sign in once, then run
   the audited administrator bootstrap.
4. Create the real condo gym with its verified name, street address and measured
   coordinates; keep the radius at 75 m.
5. Assign the gym to the September competition, issue the poster and verify the
   preview shows the exact real gym, September Contest, credential version, and
   Contest-end expiry before printing it. Never print App Tour, sample, or demo
   output.
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

## Manual cash handoff record

1. Confirm Winners Circle is settled and the admin panel shows exactly one
   pending September cash Award with the immutable value `$100 CAD`.
2. Hand the cash to that displayed winner in person, outside GoGymGo. Do not
   enter or collect bank, payee, card, wallet, tax, balance or transfer details.
3. Immediately select that authoritative Award in Pilot Operations, enter a
   bounded operational reason, and record the already-completed handoff.
4. A retry with the same request key and identical body returns the same record.
   A changed body, stale version, second attempt, wrong winner/contest/reward,
   revoked or unsettled Award fails closed. Reload the panel before deciding
   whether any retry is appropriate.
5. Confirm the panel and the winner's My Rewards view show fulfilled at the
   server timestamp. The action records evidence only: it sends no webhook,
   contacts no payment provider and does not claim GoGymGo initiated a transfer.

Never edit or delete a cash fulfillment or its audit evidence. If the panel
reports an integrity error, stop the handoff workflow and escalate for database
review; use a forward-only corrective change while preserving the original
record.

## Poster control and recovery

- A poster is a public enrollment link scoped in the database to one exact
  Contest, assigned Partner gym, credential version, and expiry. It is not an
  operator secret, but it must not be retained by the member app after the
  authoritative enrollment has pinned that gym.
- Issue, recover, inspect, and revoke posters only through the authenticated
  operator/partner portal. Mutation retries reuse the browser's pending
  idempotency key, and every successful issue or revocation writes audit
  evidence. The credential-history response intentionally omits the QR payload.
- Revocation is immediate. Replace every displayed physical copy when a poster
  is revoked or reissued; do not delete credential, enrollment, scan, session,
  idempotency, or audit history.
- Before opening registration, scan the printed artifact from a signed-out and
  signed-in browser, deny and then grant camera/location permission, cancel and
  retry, verify a stale or revoked poster fails without enrollment, and confirm
  the current-enrollment read shows the exact real gym.
- Final iOS/Android identifiers, association-file publication, physical-device
  camera/App Link testing, real coordinates, and physical placement remain
  external release gates. Do not describe native handoff as live until the
  checklist in `member-app-native-links.md` passes.

## Production gate

Do not publish until CI, dependency audit, staging UAT, billing, domains, legal
approval, gym setup, reward publication and administrator bootstrap all pass.
Create `v0.1.0-beta.1` only after production UAT succeeds.

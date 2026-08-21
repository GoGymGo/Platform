# Gym partner portal operations

This is the owner-operated runbook for invitation-only Partner access. The
database is authoritative: a verified Firebase email/password session is only
an identity input, and it grants no Partner authority without an exact active
assignment to an active, nondeleted gym. The portal has no signup, invitation,
password-reset, role-grant, or credential-issuance endpoint.

## Authority and projections

| Surface                                      | GoGymGo administrator       | Partner administrator                                   | Partner staff                 |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------- | ----------------------------- |
| Global region, gym and Contest configuration | Write                       | None                                                    | None                          |
| Assigned active gym summary                  | All gyms                    | Assigned gyms                                           | Assigned gyms                 |
| Gym-owned proposal                           | Review and publish          | Create, edit draft/withdrawn, submit, withdraw, archive | Read only                     |
| QR poster before proposal publication        | Issue, recover and revoke   | None                                                    | History only                  |
| QR poster after proposal publication         | Issue, recover and revoke   | Issue, recover and revoke for exact assigned gym        | History only                  |
| Gym visits                                   | Global operational controls | Aggregate assigned-gym counts                           | Aggregate assigned-gym counts |

Partner reads are minimized, runtime-validated projections. They omit internal
user and session identifiers, contact data, precise gym coordinates, visit or
workout dates, evidence detail, QR payloads and SVG from history, and every
other gym's records. Competitions, aggregate visits and credential history use
bounded server pagination with opaque cursors. A malformed page or cursor fails
closed rather than being rendered as authority.

## Provision or revoke an assignment

GoGymGo first records the approved operator, accountable sponsor, access level,
exact gym and ticket reason in the private access register. Create a dedicated
enabled Firebase email/password identity, verify its email, and have it sign in
once so the database user exists. Do not reuse a member, social-provider, shared,
specialist-operator or platform-administrator identity.

From a trusted administrative environment with the runtime database and
Firebase Admin identity already supplied by the secret manager:

```powershell
$env:PARTNER_OPERATOR_EMAIL='<verified partner email>'
$env:PARTNER_GYM_LOCATION_ID='<approved gym UUID>'
$env:PARTNER_ACCESS_LEVEL='admin' # or staff
$env:PARTNER_ACCESS_ACTION='grant' # or revoke
$env:PARTNER_ACCESS_REASON='<approved access-ticket reason>'
$env:CONFIRM_PARTNER_ACCESS='yes'
npm.cmd run partner:access --workspace @gogymgo/api
```

The command locks the user and exact assignment, verifies the current Firebase
provider and account state, rejects role and gym conflicts, derives global
Partner role flags only from assignments whose gyms are still active and not
deleted, and writes append-only audit evidence. An identical completed grant or
revoke is a no-op. It never creates an identity or grants platform `admin`.

Revocation takes effect on the next request and on an idempotent replay. Gym
deactivation or deletion closes every assignment for that gym and reconciles
each affected account's Partner role flags in the same transaction. It also
revokes active posters and clears their active payload. After any access change,
verify that an allowed exact-gym read succeeds, a different gym fails, staff
mutations fail, and the revoked account cannot replay a prior mutation.

## Proposal lifecycle and platform review

One gym-owned proposal reserves its exact gym and month until archived. Its
Contest, gym, original proposer and creation time are immutable provenance.
Partner administrators use optimistic lifecycle versions and a bounded reason:

- `draft` may be edited, submitted or archived;
- `submitted` is read-only for the Partner while GoGymGo reviews it, and may be
  withdrawn by that Partner or published only by a GoGymGo administrator;
- `withdrawn` may be edited, resubmitted or archived;
- `published` cannot be withdrawn or archived by the Partner;
- `archived` is terminal and preserves the proposal and audit history.

Platform publication transactionally requires the proposal to still be
`submitted`. A platform administrator can prepare a draft poster for controlled
publication preflight, but that does not make the proposal public or give the
Partner poster authority. Partner issue and recovery become eligible only after
platform publication. Cancellation and archival revoke active credentials and
clear their recoverable payload.

Account deletion removes assignments and pseudonymizes the retained user row.
It does not delete or reassign proposal ownership: the immutable foreign key
continues to reference only that pseudonymized account so Contest provenance is
preserved without direct identity. Privacy export schema 13 includes that
account's minimized proposal lifecycle and timestamps, but not proposer or
reviewer identifiers.

## Poster issue, retry and recovery

Issue and revoke requests require the latest exact credential version (or
explicit `null` when no credential exists), a bounded reason and one body-bound
`Idempotency-Key`. Every replay resolves current role, assignment, gym, Contest,
region and proposal eligibility again. A stale version or changed body must be
refreshed and reviewed; do not guess a version or create a replacement key to
bypass a conflict.

The active `gym_qr_credentials.qr_payload` value is sensitive and is the single
authoritative recoverability source for the current poster. It is never copied
to idempotency response storage, audit events, logs, credential history or
privacy exports. A successful lost-response replay reconstructs the exact prior
poster only from its still-authorized authoritative credential. Revocation,
supersession, gym deactivation/deletion, proposal archival or Contest
cancellation clears the value; recovery or replay then fails honestly and does
not issue a new credential. Keep database access and at-rest controls restricted
accordingly, and never query or paste the value into operational tickets.

Before printing, review the exact Contest, gym, version and expiry. Replace all
physical copies after reissue or revocation. App Tour and demo output are not
valid authority or printable production evidence.

## Release evidence and external gates

Repository proof covers authorization, lifecycle, privacy projections,
contracts and client states. In an authorized environment, separately record:

1. migration version, release commit and assignment ticket;
2. admin, Partner-admin, Partner-staff, normal-member, cross-gym, inactive-gym
   and revoked-assignment results;
3. submit/review/publish and stale-version results;
4. pre-publication platform poster and post-publication Partner poster results;
5. lost-response replay, revoke, payload-clearing and secret-free history;
6. privacy export and deletion/provenance evidence.

Firebase provider configuration, Cloudflare Access policy, real operator
credentials, real coordinates, physical placement, mobile-camera/native-link
behavior and hosted staging/production UAT remain external release gates. A
repository-only result must not claim any of them are configured or passed.

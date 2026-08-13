# September 2026 Island pilot

## Region

- Code: `vancouver-island-gulf-islands-bc`
- Display name: `Vancouver Island + Gulf Islands`
- Timezone: `America/Vancouver`
- Minimum age: 19
- Policy version: `2026-09-pilot-v1`
- Boundary version: `statcan-2021-islands-trust-2026-01-v1`

The boundary includes the Vancouver Island landmass and land inside these BC
Local Trust Areas:

- Denman Island
- Ballenas-Winchelsea (stored by BC as Executive Islands)
- Gabriola Island
- Galiano Island
- Hornby Island
- Lasqueti Island
- Mayne Island
- North Pender Island
- Salt Spring Island
- Saturna Island
- South Pender Island
- Thetis Island

Bowen Island, the Gambier Island Local Trust Area, mainland British Columbia
and locations outside Canada are excluded.

The build uses the Statistics Canada 2021 British Columbia cartographic land
boundary and the BC Government Local Trust Areas layer. It intersects the trust
areas with the cartographic land boundary so surrounding water is not eligible.
No additional distance tolerance is applied.

The generated GeoJSON is stored at
`config/regions/vancouver-island-gulf-islands-bc.geojson`.

## Competition

- Month: September 2026
- Registration: opens immediately when the competition is published and
  remains available until the competition ends, reaches its entrant cap, or is
  cancelled
- Competition: September 1 at 12:00 a.m. PDT through October 1 at 12:00 a.m.
  PDT
- Minimum entrants: 1
- Entrant cap: none
- Weekly goals: one through seven days
- Minimum verified session: 30 minutes
- Heart-rate sample requirement: none for the pilot
- Device attestation: not required for the pilot
- Presence check: not used in the pilot
- Partner-gym QR: required
- Gym geofence: 75 m with a 50 m maximum accepted accuracy reading
- Contest QR flow: scan once to select the Partner gym, then use fresh start and finish location checks around the 30-minute workout
- Completion period: a workout started in time may finish up to 15 minutes after the competition ends
- Session expiry: the earlier of four hours or the completion-period deadline; a missing finish location check earns no credit
- Reward: one $100 CAD cash reward sponsored by GoGymGo

The competition remains a draft until at least one real, in-stock reward has
been created and published. Do not use placeholder sponsor, prize, coupon or
fulfillment data to bypass this publication gate.

## Rebuild and verify

From the monorepo root with the preview database running:

```powershell
$env:DATABASE_URL = 'postgresql://gogymgo:gogymgo@127.0.0.1:5432/gogymgo'
npm.cmd run configure:september-2026-island-pilot --workspace @gogymgo/api
```

The dry run regenerates the boundary artifact and verifies 20 representative
inside/outside points. To apply missing configuration after an administrator
has been bootstrapped:

```powershell
$env:APPLY_PILOT_CONFIGURATION = 'yes'
$env:CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256 = '<exact digest printed by the command>'
npm.cmd run configure:september-2026-island-pilot --workspace @gogymgo/api
```

The configuration command is idempotent for the region policy and competition
month. Its first apply attempt prints the exact canonical public legal
configuration SHA-256 and refuses publication. After the configured owner and
counsel approve that exact content, rerun with the digest in
`CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256`. A content change produces a different
digest and requires new approval. The command uses the backend's audited
operator services for database writes.

After the real gym has been assigned and the legal, reward and UAT gates pass,
publish the competition through the same audited competition service.
Publication immediately opens registration:

```powershell
$env:APPLY_PILOT_CONFIGURATION = 'yes'
$env:CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256 = '<same approved exact digest>'
$env:PUBLISH_PILOT_COMPETITION = 'yes'
npm.cmd run configure:september-2026-island-pilot --workspace @gogymgo/api
```

The command creates and publishes the sole real $100 CAD cash reward and refuses
to publish if any additional pilot reward is published. It never creates
placeholder sponsor or fulfillment data.

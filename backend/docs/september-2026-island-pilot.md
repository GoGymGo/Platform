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
- Minimum entrants: 100
- Entrant cap: none
- Weekly goals: one through seven days
- Minimum verified session: 30 minutes
- Heart-rate sample requirement: none for the pilot
- Device attestation: not required for the pilot
- Presence check: required
- Partner-gym QR: not required

The competition remains a draft until at least one real, in-stock reward has
been created and published. Do not use placeholder sponsor, prize, coupon or
fulfillment data to bypass this publication gate.

## Rebuild and verify

From `backend` with the preview database running:

```powershell
$env:DATABASE_URL = 'postgresql://gogymgo:gogymgo@127.0.0.1:5432/gogymgo'
npm.cmd run configure:september-2026-island-pilot
```

The dry run regenerates the boundary artifact and verifies 20 representative
inside/outside points. To apply missing configuration after an administrator
has been bootstrapped:

```powershell
$env:APPLY_PILOT_CONFIGURATION = 'yes'
npm.cmd run configure:september-2026-island-pilot
```

The configuration command is idempotent for the region policy and competition
month. It uses the backend's audited operator services for database writes.

After a real reward has been created and published, publish the competition
through the same audited competition service. Publication immediately opens
registration:

```powershell
$env:APPLY_PILOT_CONFIGURATION = 'yes'
$env:PUBLISH_PILOT_COMPETITION = 'yes'
npm.cmd run configure:september-2026-island-pilot
```

The command refuses to publish if no published reward remains available through
the October 1 competition end. It never creates placeholder reward data.

# Landing intake authority and historical cutover

The GoGymGo API is the only write authority for new regional-update and
partnership submissions. The landing routes accept bounded, same-origin JSON
and forward it to the API with an idempotency key over an authenticated channel.
They do not write D1 or fall back to D1. If forwarding is unavailable, the form
shows an error and does not report success.

This runbook documents a future cutover. It does not authorize provider access,
credential inspection, export, import, deployment, binding removal, or deletion.
Those operations remain **BLOCKED** until the data owner separately approves the
exact environment, identities, artifact paths, commands, release commits, and
rollback window. Never paste records, private headers, database URLs, or secrets
into tickets, logs, terminals captured for evidence, or Git.

## Live intake gate

The two runtimes fail closed independently:

- Landing requires an exact `GOGYMGO_API_URL` (HTTPS, or loopback for local
  testing) and a `GOGYMGO_LANDING_FORWARDING_SECRET` of at least 32 characters.
- API requires `LANDING_INTAKE_ENABLED=true`, the matching
  `LANDING_INTAKE_FORWARDING_SECRET`, and an approved whole-number
  `LANDING_INTAKE_RETENTION_DAYS` from 30 through 730.
- Keep `LANDING_INTAKE_ENABLED=false` until the additive PostgreSQL migration is
  applied and both reviewed releases are ready. Deploy API before landing.
- Verify method, content type, body bound, origin, schema, consent, rate-limit,
  idempotent replay, invalid secret, timeout, upstream failure, and successful
  form behaviour. A success receipt is valid only after the API commits.

Forwarder secrets authenticate the server-to-server route; they are not owner
credentials and must not be exposed to browsers or admin views. API audit and
provenance surfaces contain source labels and deterministic hashes, not raw
headers or source records.

## Historical export authorization

The legacy Sites D1 binding remains attached and read-only for this cutover. Use
only `/api/internal/export-interest-submissions`; do not use raw D1 commands or
`SELECT *`. The route emits only the versioned allowlist of historical interest
fields needed by the importer and performs no insert, update, delete, retention,
or audit mutation.

Before a separately authorized export, record and review all of:

1. One new UUID for `LANDING_D1_EXPORT_ID`.
2. One exact UTC millisecond timestamp for
   `LANDING_D1_EXPORT_CUTOFF_EXCLUSIVE`. It must be after the last legacy D1
   writer is disabled and must not change between pages.
3. The exact Sites owner email and immutable owner user ID. Both must match the
   authenticated identity.
4. The private, non-repository directory for page files and the assembled
   artifact.
5. The approved release commit and the short enable/disable window.

The route is hidden unless every variable is valid and
`LANDING_D1_EXPORT_ENABLED=yes`. Its default remains `no`. Fetch page one with a
limit from 1 through 100, save the response without printing it, then follow the
opaque `next_cursor` exactly. Keep the same limit. Stop only when
`next_cursor` is `null`. Each page binds its export ID, cutoff, sequence,
request cursor, total source count, minimized records, per-record SHA-256,
page-count, and content SHA-256. A cursor from another export or cutoff is
rejected.

Disable the export gate and verify the route is hidden immediately after the
last page. Enabling, downloading, and disabling are separate provider-impacting
operations and each requires the authorization described above.

## Offline artifact preparation

The following command is local and opens no database or provider connection. It
parses every page with an exact schema and fixed format signature, verifies each
record/page digest, verifies cursor order and the frozen cutoff, rejects missing
or repeated source IDs, reconciles the total count, and writes a new file only
(`wx`) so an existing artifact cannot be overwritten.

```powershell
npm.cmd run pilot:prepare-landing-d1-artifact --workspace @gogymgo/api -- --output '<private-path>\landing-interest-artifact.json' '<private-path>\page-1.json' '<private-path>\page-2.json'
```

Pass every page in numerical order. The output reports counts plus records,
page-chain, and artifact SHA-256 values only. Preserve those values as the
reconciliation manifest. The fixed signature is a format/type marker; the
content digests provide deterministic integrity checking and are not a claim of
third-party cryptographic attestation.

Validate an assembled artifact offline before any database authorization:

```powershell
npm.cmd run pilot:import-landing-d1 --workspace @gogymgo/api -- '<private-path>\landing-interest-artifact.json'
```

Validate-only is the default. It reads neither `DATABASE_URL` nor any provider
credential.

## Separately authorized PostgreSQL rehearsal and import

Apply the forward migration first. Then use `--database-dry-run` against the
exact approved disposable or staging PostgreSQL target. Database modes require
`CONFIRM_LANDING_D1_IMPORT_SHA256` to equal the validated artifact digest and a
30-730 day retention value. The importer uses one serializable transaction and
explicitly rolls back a dry run or any failure.

```powershell
$env:DATABASE_URL = '<approved target connection string>'
$env:LANDING_INTAKE_RETENTION_DAYS = '<approved days>'
$env:CONFIRM_LANDING_D1_IMPORT_SHA256 = '<exact artifact SHA-256>'
npm.cmd run pilot:import-landing-d1 --workspace @gogymgo/api -- '<private-path>\landing-interest-artifact.json' --database-dry-run
```

Review the count-only output. Each source ID maps once through
`landing_intake_source_records`. Destination IDs for inserted records are
deterministic. An `(audience,email)` already present in PostgreSQL is preserved,
not overwritten; later source duplicates map to that same destination. A rerun
with the identical artifact verifies its hashes and mappings and creates none.
A changed artifact or reused source ID with a changed hash is rejected.

Only after the owner approves the exact dry-run digest, target, migration state,
counts, and rollback window may the same command be considered with `--commit`
instead. Preserve these non-sensitive results:

- artifact source count and unique/duplicate business-key counts;
- mapped provenance count and distinct destination count;
- inserted, existing, and source-duplicate mapping counts;
- records SHA-256, artifact SHA-256, and reconciliation SHA-256;
- a same-artifact rerun showing zero new mappings.

Do not claim success if any count or digest differs. Do not repair a mismatch by
editing the artifact, deleting provenance, or overwriting authoritative rows.
Roll back, retain the evidence privately, and investigate.

## Retention, privacy, and operator visibility

New public intake receives the approved expiry; the worker deletes expired
anonymous waitlist and interest rows in bounded batches. Imported rows receive
an expiry derived from their original creation time. Signed-in member waitlist
rows are not treated as anonymous public intake.

A verified account privacy export includes anonymous regional updates and
interest submissions matching its canonical email, without provenance hashes.
Account deletion removes those rows; provenance mappings cascade. Operator
views show the contact fields already needed for intake review plus source and
expiry, never source-record hashes, artifact hashes, forwarding headers, or
owner secrets.

## Disable legacy storage and recover safely

Removing the D1 binding is a final, separately authorized release operation,
not part of export or import. Before proposing it, require:

- successful exact-count/digest production reconciliation and zero-new-mapping
  rerun;
- verified API-only form success and honest failure behaviour on the exact
  release;
- a private preserved artifact and reconciliation manifest;
- an approved rollback rehearsal that restores the prior landing release with
  the binding and keeps the export gate disabled.

Review the exact removal of the `d1` entry from
`apps/landing/.openai/hosting.json`, deploy only after explicit approval, and
verify the deployed revision and disabled export route. Do not delete the D1
database or archive as part of binding removal.

For application rollback, disable public intake, restore the prior reviewed
release, and leave the additive PostgreSQL schema and committed data intact.
For export rollback, set `LANDING_D1_EXPORT_ENABLED=no`. For import failure, the
transaction rolls back. Any reversal of already committed records, D1 deletion,
archive deletion, credential change, or provider mutation needs its own reviewed
procedure and authorization.

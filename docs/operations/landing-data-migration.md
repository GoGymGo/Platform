# Landing interest data migration

The landing page now sends gym-goer and partnership forms to the GoGymGo API.
Its legacy Sites D1 database remains attached only until the historical records
are migrated and verified.

## Export

The current landing database is a Sites-managed D1 binding. It does not appear
in the domain owner's Cloudflare account, and a Cloudflare API token from that
account cannot read it. Do not create a Cloudflare token for the current export.

The landing project includes a disabled, read-only export route at
`/api/internal/export-interest-submissions`. It returns `404` unless both
`LANDING_D1_EXPORT_ENABLED=yes` and `LANDING_D1_EXPORT_OWNER_EMAIL` are set in
the hosted environment. When enabled, the route also requires the matching
Sites-authenticated owner email, sends no-store headers and downloads the rows
in the JSON shape accepted by the importer.

For a Sites-managed export:

1. Verify that Site access is still limited to the owner, with no groups,
   editors or external visitors.
2. Review the exact saved version and hosted environment changes. Do not deploy
   or enable the route without the owner's explicit approval.
3. Set the two export variables, deploy the approved version and sign in as the
   configured owner.
4. Visit `/api/internal/export-interest-submissions` and save the download under
   `GoGymGo Archive/source-releases`, outside Git.
5. Confirm the JSON is readable and record its file hash and row count without
   printing submission contents.
6. Immediately disable the export variable and deploy the reviewed disabled
   configuration. Confirm the route returns `404` again.

If a future D1 database is owned directly by a GoGymGo Cloudflare account, the
Wrangler path below may be used with a temporary read-only token.

Use a Cloudflare API token with D1 read access. Do not commit the token or the
export. Store the export under `GoGymGo Archive/source-releases`.

```powershell
$env:CLOUDFLARE_API_TOKEN = '<temporary token>'
npx.cmd wrangler d1 list --json
npx.cmd wrangler d1 execute <database-name-or-id> --remote --json --command "SELECT * FROM interest_submissions ORDER BY created_at" > '<archive-path>\landing-interest-submissions.json'
```

## Import and verify

Run the API migration first, then import into the intended staging or production
PostgreSQL database. The importer is idempotent on `(audience, email)`, runs in a
transaction and refuses to commit unless every unique source record is present.

```powershell
$env:DATABASE_URL = '<target PostgreSQL connection string>'
$env:CONFIRM_LANDING_D1_IMPORT = 'yes'
npm.cmd run pilot:import-landing-d1 --workspace @gogymgo/api -- '<archive-path>\landing-interest-submissions.json'
```

The importer reports source rows, unique source rows, duplicates within the
source, destination duplicates, inserted rows, updated rows and verified rows.
Preserve that count-only output as migration evidence without logging submission
contents.

After the script reports equal unique and verified counts, show the owner the
exact binding change and obtain approval. Only then remove the `d1` binding from
`apps/landing/.openai/hosting.json`, save a new Sites version and deploy it. Keep
the export as a private release artifact.

# Landing interest data migration

The landing page now sends gym-goer and partnership forms to the GoGymGo API.
Its legacy Sites D1 database remains attached only until the historical records
are migrated and verified.

## Export

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

After the script reports equal imported and verified counts, remove the `d1`
binding from `apps/landing/.openai/hosting.json`, save a new Sites version and
deploy it. Keep the export as a release artifact.

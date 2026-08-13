# PR #24 salvage audit

Audit date: August 13, 2026

Pull request #24, “Complete cross-platform UI and platform remediation,” was a
valid historical release branch but is no longer a safe merge unit. Its final
tree changed 337 files against its original base and now conflicts with
protected `main`.

## Current-tree comparison

Comparing final PR commit `36747b3de831018f78b9107830e377cfa9cc3274`
with current `main` at the start of this audit produced 141 differing files:

- 72 under applications;
- 48 under the API;
- 8 operational or architecture documents;
- 4 GitHub files;
- 3 shared-contract files; and
- 6 infrastructure, tooling, lockfile, or repository files.

The old tree had 1,975 lines not present on current `main`, while current
`main` had 6,361 replacement lines not present in the old tree. Only two files
existed exclusively in PR #24:

- `services/api/src/modules/storage/google-cloud-private-object-storage.ts`;
- its unit test.

Those files are intentionally obsolete. PR #47 retired the Google Cloud
storage runtime and standardized private object storage on AWS S3. Restoring
them would reverse an explicit architecture and security decision.

## Disposition

- UI, contest, QR, scoring, admin, API, deployment, and compliance work has
  either been absorbed or superseded by the current implementations and tests.
- Later PRs #40–#47 completed browser release, contest correctness, admin auth,
  capability centralization, test discovery, and storage retirement.
- PRs #49–#51 added reviewed-source deployments, removed the CodeQL finding,
  and made dependency updates independently reviewable.
- No commit or file should be cherry-picked from PR #24 without a new,
  feature-specific defect report against current `main`.

PR #24 should therefore be closed as superseded. This record preserves the
release history without allowing a stale aggregate branch to bypass current
architecture and change-scope controls.
